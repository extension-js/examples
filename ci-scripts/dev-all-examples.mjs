#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const examplesDir = path.join(repoRoot, 'examples')
const resultsDir = path.join(repoRoot, 'test-results', 'dev-results')

const argv = process.argv.slice(2)
/** parse --timeout=SECONDS and --minAlive=SECONDS */
function getArgSeconds(name, def) {
  const flag = `--${name}=`
  const found = argv.find((a) => a.startsWith(flag))
  if (!found) return def
  const v = Number(found.slice(flag.length))
  return Number.isFinite(v) && v > 0 ? v : def
}

const timeoutMs = Number(process.env.DEV_TIMEOUT_MS) || getArgSeconds('timeout', 120) * 1000
const minAliveMs = Number(process.env.DEV_MIN_ALIVE_MS) || getArgSeconds('minAlive', 15) * 1000

function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true})
}

function listExamples() {
  return fs
    .readdirSync(examplesDir, {withFileTypes: true})
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      const pkg = path.join(examplesDir, name, 'package.json')
      return fs.existsSync(pkg)
    })
    .sort()
}

/**
 * Run local `extension dev ./examples/<slug>` with timeout safeguards.
 * Consider success if the process stays alive for at least `minAliveMs` without crashing.
 * Always kill the process after success or timeout to avoid hanging jobs.
 * @param {string} slug
 * @returns {Promise<{slug:string, ok:boolean, timedOut:boolean, code:number|null, signal:string|null, logPath:string|null}>}
 */
function runDev(slug) {
  return new Promise((resolve) => {
    const extBin = process.platform === 'win32' ? 'extension.cmd' : 'extension'
    const cmd = path.join(repoRoot, 'node_modules', '.bin', extBin)
    const args = ['dev', path.join('./examples', slug)]
    const cwd = repoRoot

    /** capture a bounded buffer of logs */
    const maxBuffer = 2 * 1024 * 1024
    /** @type {Buffer[]} */
    const chunks = []
    let total = 0
    const append = (buf) => {
      total += buf.length
      chunks.push(buf)
      while (total > maxBuffer && chunks.length > 1) {
        const first = chunks.shift()
        total -= first ? first.length : 0
      }
    }

    /** Spawn dev process detached so we can kill the entire group */
    const child = spawn(cmd, args, {
      cwd,
      env: {
        ...process.env,
        // ensure config/cache go inside workspace to avoid sandbox EPERM on $HOME
        XDG_CONFIG_HOME: path.join(resultsDir, '.xdg-config'),
        XDG_CACHE_HOME: path.join(resultsDir, '.xdg-cache'),
        HOME: repoRoot,
        // best-effort disable telemetry if supported by the CLI
        EXTENSION_TELEMETRY_DISABLED: '1',
        EXTENSION_DISABLE_TELEMETRY: '1',
      },
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let settled = false
    let ok = false
    let timedOut = false
    let code = null
    let signal = null

    const onSettle = () => {
      if (settled) return
      settled = true
      clearTimeout(aliveTimer)
      clearTimeout(hardTimer)
      // attempt to kill process group
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {}
      // also ensure child is dead
      try {
        child.kill('SIGKILL')
      } catch {}

      let logPath = null
      if (!ok) {
        try {
          ensureDir(resultsDir)
          logPath = path.join(resultsDir, `${slug}.log`)
          const out = Buffer.concat(chunks).toString('utf8')
          const header = [
            `slug: ${slug}`,
            `ok: ${ok}`,
            `timedOut: ${timedOut}`,
            `exitCode: ${code}`,
            `signal: ${signal}`,
            `command: ${cmd} ${args.join(' ')}`,
            '',
            '=== output (tail, clipped to 2MB) ===',
            '',
          ].join('\n')
          fs.writeFileSync(logPath, `${header}\n${out}`, 'utf8')
        } catch {}
      }

      resolve({slug, ok, timedOut, code, signal, logPath})
    }

    const aliveTimer = setTimeout(() => {
      // If the process is still running after minAliveMs, we consider it healthy enough.
      ok = true
      onSettle()
    }, minAliveMs)

    const hardTimer = setTimeout(() => {
      timedOut = true
      ok = false
      onSettle()
    }, timeoutMs)

    child.stdout.on('data', (d) => append(Buffer.isBuffer(d) ? d : Buffer.from(String(d))))
    child.stderr.on('data', (d) => append(Buffer.isBuffer(d) ? d : Buffer.from(String(d))))

    child.on('error', () => {
      ok = false
      onSettle()
    })
    child.on('exit', (c, s) => {
      code = typeof c === 'number' ? c : null
      signal = s || null
      // If it exited before minAliveMs, use code to decide success
      if (!settled) {
        ok = code === 0
      }
      onSettle()
    })
  })
}

async function main() {
  const slugs = listExamples()
  if (slugs.length === 0) {
    console.log('No examples found to dev.')
    return
  }
  console.log(`Running dev for ${slugs.length} examples (minAlive=${Math.round(minAliveMs / 1000)}s, timeout=${Math.round(timeoutMs / 1000)}s)`)

  /** @type {Array<{slug:string, ok:boolean, timedOut:boolean, code:number|null, signal:string|null, logPath:string|null}>} */
  const results = []
  for (const slug of slugs) {
    console.log(`\n=== Dev start: ${slug} ===`)
    const r = await runDev(slug)
    const mark = r.ok ? '✅' : r.timedOut ? '⏰' : '❌'
    console.log(`${mark} ${slug} ${r.ok ? '(started successfully)' : '(failed)'}`)
    results.push(r)
  }

  // Write summary JSON
  try {
    ensureDir(resultsDir)
    const summaryPath = path.join(resultsDir, 'summary.json')
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          timeoutMs,
          minAliveMs,
          total: results.length,
          passed: results.filter((r) => r.ok).length,
          failed: results.filter((r) => !r.ok).length,
          results,
        },
        null,
        2
      ),
      'utf8'
    )
    console.log(`\nWrote summary: ${path.relative(repoRoot, summaryPath)}`)
  } catch {}

  const failures = results.filter((r) => !r.ok).length
  if (failures > 0) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


