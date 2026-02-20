import {spawn, spawnSync} from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {chromium} from 'playwright'

function runUntilMatch(
  command,
  args,
  options = {},
  matcher,
  timeoutMs = 60000
) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      ...options,
      stdio: 'pipe',
      detached: true
    })
    let stdout = ''
    let stderr = ''
    let matched = false
    let timedOut = false
    let resolved = false

    const stopProcess = (signal) => {
      try {
        if (child.pid) {
          process.kill(-child.pid, signal)
          return
        }
      } catch {
        // Fall back to child.kill on platforms without process groups.
      }
      try {
        child.kill(signal)
      } catch {
        // best-effort only
      }
    }

    const finalize = (status = null, signal = null) => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      clearTimeout(killTimer)
      resolvePromise({
        status,
        signal,
        stdout,
        stderr,
        matched,
        timedOut
      })
    }

    const onChunk = (chunk, isErr = false) => {
      const text = chunk.toString()
      if (isErr) stderr += text
      else stdout += text
      if (!matched && matcher.test(`${stdout}${stderr}`)) {
        matched = true
        stopProcess('SIGTERM')
      }
    }

    child.stdout?.on('data', (chunk) => onChunk(chunk))
    child.stderr?.on('data', (chunk) => onChunk(chunk, true))

    const timer = setTimeout(() => {
      timedOut = true
      stopProcess('SIGTERM')
    }, timeoutMs)

    const killTimer = setTimeout(() => {
      stopProcess('SIGKILL')
      finalize(null, 'SIGKILL')
    }, timeoutMs + 5000)

    child.on('close', (status, signal) => finalize(status, signal))
    child.on('error', () => finalize(null, null))
  })
}

async function main() {
  const chromiumBinary =
    process.env.EXTENSION_TEST_CHROMIUM_BINARY || chromium.executablePath()

  if (!chromiumBinary || !existsSync(chromiumBinary)) {
    console.log('Skipping banner check: Chromium binary not available.')
    process.exit(0)
  }

  const workspace = mkdtempSync(join(tmpdir(), 'extjs-banner-fixture-'))
  const projectPath = join(workspace, 'javascript-banner-fixture')

  const runCommand = (command, args, cwd) => {
    const result = spawnSync(command, args, {
      cwd,
      env: {...process.env, NO_COLOR: '1'},
      encoding: 'utf8'
    })
    if ((result.status || 0) !== 0) {
      throw new Error(
        `Command failed: ${command} ${args.join(' ')}\n\n${result.stdout || ''}\n${result.stderr || ''}`
      )
    }
  }

  try {
    runCommand(
      'pnpm',
      [
        'extension',
        'create',
        projectPath,
        '--template',
        'javascript',
        '--install',
        'false'
      ],
      process.cwd()
    )

    const manifestPathCandidates = [
      join(projectPath, 'src', 'manifest.json'),
      join(projectPath, 'manifest.json')
    ]
    const manifestPath = manifestPathCandidates.find((candidate) =>
      existsSync(candidate)
    )
    if (!manifestPath) {
      throw new Error('Could not locate fixture manifest.json')
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    manifest.key = Buffer.from('examples-banner-fixture-key').toString('base64')
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    runCommand('pnpm', ['install'], projectPath)

    const result = await runUntilMatch(
      'pnpm',
      [
        'extension',
        'dev',
        projectPath,
        '--browser',
        'chromium',
        '--chromium-binary',
        chromiumBinary
      ],
      {
        cwd: process.cwd(),
        env: {...process.env, NO_COLOR: '1'}
      },
      /Extension ID\s+[a-z]{32}/i,
      90000
    )

    const output = `${result.stdout}\n${result.stderr}`
    if (result.timedOut) {
      throw new Error(`Banner check timed out.\n\n${output}`)
    }
    if (!result.matched) {
      throw new Error(`Banner check did not find Extension ID.\n\n${output}`)
    }
    if (!/Browser\s+Chromium/i.test(output)) {
      throw new Error(
        `Banner check did not find Chromium browser line.\n\n${output}`
      )
    }

    console.log('Banner check passed (Chromium + Extension ID).')
  } finally {
    rmSync(workspace, {recursive: true, force: true})
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
