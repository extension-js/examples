import {spawn, spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {chromium} from '@playwright/test'

const FIXTURE_KEY = Buffer.from('examples-banner-fixture-key').toString(
  'base64'
)
const CARD_BROWSER_ROW = /^\s*Browser\s+Chromium\b/m

// Chromium names an extension that declares `key` after the SHA-256 of the
// decoded key, first 32 hex digits spelled a to p. Matching that exact id
// proves the browser loaded this manifest, not that some id got printed.
function extensionIdFromKey(base64Key) {
  const hex = createHash('sha256')
    .update(Buffer.from(base64Key, 'base64'))
    .digest('hex')
    .slice(0, 32)

  return [...hex]
    .map((digit) => String.fromCharCode(97 + parseInt(digit, 16)))
    .join('')
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function runUntil(command, args, options = {}, isDone, timeoutMs = 60000) {
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
      clearInterval(poller)
      resolvePromise({
        status,
        signal,
        stdout,
        stderr,
        matched,
        timedOut
      })
    }

    const check = () => {
      if (!matched && isDone(`${stdout}${stderr}`)) {
        matched = true
        stopProcess('SIGTERM')
      }
    }

    const onChunk = (chunk, isErr = false) => {
      const text = chunk.toString()
      if (isErr) stderr += text
      else stdout += text

      check()
    }

    child.stdout?.on('data', (chunk) => onChunk(chunk))
    child.stderr?.on('data', (chunk) => onChunk(chunk, true))

    // ready.json can gain its extensionId after the last line of output, so
    // the condition is polled too rather than only checked on new output.
    const poller = setInterval(check, 500)

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
    // A skip exits 0, so in CI it would read as a pass for a check that never
    // ran. That hid this check's stale assertion from 4.1.0 onwards.
    if (process.env.CI) {
      console.error(
        `Banner check cannot run: no Chromium binary at ${chromiumBinary || '(none)'}.\n` +
          'Restore the Playwright browser cache in this job, or set EXTENSION_TEST_CHROMIUM_BINARY.'
      )

      process.exit(1)
    }

    console.log(
      'Skipping banner check: no Chromium binary. Run `pnpm test:install chromium` to enable it.'
    )

    process.exit(0)
  }

  const workspace = mkdtempSync(join(tmpdir(), 'extjs-banner-fixture-'))
  const projectPath = join(workspace, 'javascript-banner-fixture')
  const readyPath = join(
    projectPath,
    'dist',
    'extension-js',
    'chromium',
    'ready.json'
  )
  const expectedId = extensionIdFromKey(FIXTURE_KEY)

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
    manifest.key = FIXTURE_KEY
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    runCommand('pnpm', ['install'], projectPath)

    // The card shows at most three rows and Profile outranks Extension ID, so
    // the id is read from ready.json, where the CLI keeps it for machines.
    // Snapshot it on match, because shutdown rewrites the status to stopped.
    let ready = null
    const result = await runUntil(
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
        // Headless so the check needs no display in CI and takes no window
        // focus on a developer machine. The extension still loads.
        env: {...process.env, NO_COLOR: '1', EXTENSION_HEADLESS: '1'}
      },
      (output) => {
        // Case-sensitive and line-anchored, or the echoed `--browser chromium`
        // argument satisfies it before any card is printed.
        if (!CARD_BROWSER_ROW.test(output)) return false

        const snapshot = readJson(readyPath)
        if (!snapshot?.extensionId) return false

        ready = snapshot

        return true
      },
      90000
    )

    const output = `${result.stdout}\n${result.stderr}`

    if (result.timedOut) {
      const lastReady = readJson(readyPath)

      throw new Error(
        `Banner check timed out waiting for the Chromium card and ready.json extensionId.\n\n` +
          `ready.json: ${lastReady ? JSON.stringify(lastReady, null, 2) : '(missing)'}\n\n${output}`
      )
    }

    if (!result.matched) {
      throw new Error(
        `Banner check: dev exited before the Chromium card and ready.json extensionId appeared.\n\n${output}`
      )
    }

    if (ready.status !== 'ready') {
      throw new Error(
        `Banner check: ready.json status is "${ready.status}", expected "ready".\n\n${output}`
      )
    }

    if (ready.extensionId !== expectedId) {
      throw new Error(
        `Banner check: ready.json extensionId is ${ready.extensionId}, expected ${expectedId} from the manifest key.\n\n${output}`
      )
    }

    console.log(
      `Banner check passed (Chromium card, extension id ${expectedId} from the manifest key).`
    )
  } finally {
    rmSync(workspace, {recursive: true, force: true})
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
