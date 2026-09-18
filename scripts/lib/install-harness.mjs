import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
export const examplesRoot = path.join(repoRoot, 'examples')

export const SECOND_RUN_HINT = 'Run the command again to proceed'
export const COMPILE_SUCCESS_HINTS = [
  'compiled successfully',
  'compiled in ',
  'compiled with warnings'
]
export const READY_HINT = 'Extension ready for development'

const OUTPUT_ROOTS = ['dist', 'build', '.extension']
const CHROME_CHANNELS = ['chrome', 'chromium', 'chrome-mv3']

const WINDOWS_COMMANDS = {
  pnpm: 'pnpm.cmd',
  npm: 'npm.cmd',
  npx: 'npx.cmd',
  yarn: 'yarn.cmd',
  corepack: 'corepack.cmd',
  bun: 'bun.exe',
  bunx: 'bunx.exe'
}

export function commandFor(tool) {
  if (process.platform !== 'win32') return tool

  return WINDOWS_COMMANDS[tool] || tool
}

// The override is opt-in per caller. Consolidating these gates gave every one
// of them an EXTENSION_SPEC hook that only the linker checks used to have, so
// a stray value in the environment could point a pinned contract at another
// package while still reading as a pass.
export function getExtensionSpec({allowOverride = false} = {}) {
  const override = process.env.EXTENSION_SPEC?.trim()
  if (allowOverride && override) return override

  const rootPackage = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  )
  const spec =
    rootPackage?.devDependencies?.extension ||
    rootPackage?.dependencies?.extension

  if (!spec || typeof spec !== 'string') {
    throw new Error(
      'Could not resolve extension version spec from examples package.json'
    )
  }

  return spec.trim()
}

export function parseExamplesArg(defaults) {
  const arg = process.argv.find((value) => value.startsWith('--examples='))
  if (!arg) return defaults

  const requested = arg
    .slice('--examples='.length)
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)

  return requested.length > 0 ? requested : defaults
}

export function removeBuildOutputs(dir) {
  for (const root of OUTPUT_ROOTS) {
    fs.rmSync(path.join(dir, root), {recursive: true, force: true})
  }
}

export function prepTempExample(slug) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `extjs-${slug}-`))
  const exampleDir = path.join(tempRoot, slug)

  fs.cpSync(path.join(examplesRoot, slug), exampleDir, {recursive: true})
  fs.rmSync(path.join(exampleDir, 'node_modules'), {
    recursive: true,
    force: true
  })

  removeBuildOutputs(exampleDir)

  return {tempRoot, exampleDir}
}

export function hasBuiltManifest(dir, channels = CHROME_CHANNELS) {
  for (const root of OUTPUT_ROOTS) {
    for (const channel of channels) {
      if (fs.existsSync(path.join(dir, root, channel, 'manifest.json'))) {
        return true
      }
    }
  }

  return false
}

function spawnOptions(cwd, env, {stdin = 'inherit', detached = false} = {}) {
  return {
    cwd,
    ...(process.platform === 'win32' ? {shell: true} : {detached}),
    stdio: [stdin, 'pipe', 'pipe'],
    env: {...process.env, ...env}
  }
}

export function run(command, args, cwd, env = {}, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(
      commandFor(command),
      args,
      spawnOptions(cwd, env, options)
    )

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
      process.stdout.write(chunk)
    })

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
      process.stderr.write(chunk)
    })

    child.on('close', (code) =>
      resolve({code: code ?? 1, stdout, stderr, error: null})
    )

    child.on('error', (error) => {
      const message = String(error?.message || error)
      resolve({code: 1, stdout, stderr: message, error: message})
    })
  })
}

// Task runners that allocate a pseudo-terminal (Nx) make the CLI believe it
// writes to a TTY, so its banners arrive wrapped in ANSI color escapes.
const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PR-TZcf-ntqry=><]/g

export function stripAnsi(value) {
  return value.replace(ANSI_PATTERN, '')
}

// Starts a long-running `extension dev` command and resolves as soon as the
// output shows both a successful compile and the ready banner (code 0), a
// failure hint (code 1), an exit, or the timeout. The dev process group is
// always torn down before resolving.
export function runDevUntilReady(
  command,
  args,
  cwd,
  {env = {}, failureHints = [], timeoutMs = 90_000} = {}
) {
  return new Promise((resolve) => {
    const child = spawn(
      commandFor(command),
      args,
      spawnOptions(cwd, env, {stdin: 'ignore', detached: true})
    )

    let stdout = ''
    let stderr = ''
    let settled = false
    let sawCompile = false
    let sawReady = false
    let childClosed = false

    const waitClose = (ms = 8000) =>
      new Promise((done) => {
        if (childClosed) return done()

        const timeout = setTimeout(done, ms)
        child.once('close', () => {
          clearTimeout(timeout)
          done()
        })
      })

    const kill = async () => {
      if (childClosed) return

      if (process.platform === 'win32' && child.pid) {
        await run('taskkill', ['/PID', String(child.pid), '/T', '/F'], cwd)
        await waitClose()

        return
      }

      // Kill the whole process group so grandchild dev-server processes don't
      // linger as orphans on CI.
      try {
        if (child.pid) process.kill(-child.pid, 'SIGTERM')
      } catch {
        /* ignore */
      }

      await waitClose(1500)

      if (!childClosed) {
        try {
          if (child.pid) process.kill(-child.pid, 'SIGKILL')
        } catch {
          /* ignore */
        }

        await waitClose()
      }
    }

    const finish = async (result) => {
      if (settled) return

      settled = true
      clearTimeout(timer)

      await kill()

      resolve({stdout, stderr, ...result})
    }

    const check = () => {
      const output = stripAnsi(`${stdout}\n${stderr}`)
      const failure = failureHints.find((hint) => output.includes(hint))

      if (failure) {
        void finish({code: 1, error: `matched failure hint: ${failure}`})

        return
      }

      if (COMPILE_SUCCESS_HINTS.some((hint) => output.includes(hint))) {
        sawCompile = true
      }

      if (output.includes(READY_HINT)) sawReady = true
      if (sawCompile && sawReady) void finish({code: 0, error: null})
    }

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
      process.stdout.write(chunk)
      check()
    })

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
      process.stderr.write(chunk)
      check()
    })

    child.on('close', (code) => {
      childClosed = true
      void finish({code: code ?? 1, error: null})
    })

    child.on(
      'error',
      (error) => void finish({code: 1, error: String(error?.message || error)})
    )

    const timer = setTimeout(
      () => void finish({code: 1, error: `timed out after ${timeoutMs} ms`}),
      timeoutMs
    )
  })
}
