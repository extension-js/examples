#!/usr/bin/env node
/**
 * Regression gate: run `extension dev` inside a pnpm-workspace monorepo.
 *
 * Under pnpm strict hoisting, transitive deps of extension-develop (e.g.
 * @rspack/dev-server, webpack/hot) are NOT hoisted to the user's node_modules.
 * If the HMR entry injection relies on bare module IDs instead of absolute
 * paths, dev mode fails with "Module not found" on the first compilation.
 *
 * This script copies the sidebar-monorepo-turbopack example to a temp dir,
 * installs `extension` via pnpm, runs `extension dev`, and asserts the first
 * compilation succeeds without resolution errors.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const exampleSource = path.join(
  repoRoot,
  'examples',
  'sidebar-monorepo-turbopack'
)

const compileSuccessHints = ['compiled successfully', 'compiled with warnings']
const readyHint = 'Extension ready for development'
const failureHints = [
  'compiled with errors',
  'Module parse failed',
  'JavaScript parse error',
  'Unhandled rejection',
  "Can't resolve '@rspack/dev-server",
  "Can't resolve 'webpack/hot/dev-server",
  "Can't resolve 'Extension.js/hot/dev-server"
]

function commandFor(tool) {
  if (process.platform !== 'win32') return tool
  if (tool === 'pnpm') return 'pnpm.cmd'
  return tool
}

function getExtensionSpec() {
  const override = process.env.EXTENSION_SPEC?.trim()
  if (override) return override

  const rootPkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  )
  const spec =
    rootPkg?.devDependencies?.extension || rootPkg?.dependencies?.extension
  if (!spec || typeof spec !== 'string') {
    throw new Error(
      'Could not resolve extension version from examples package.json'
    )
  }
  return spec.trim()
}

function run(command, args, cwd, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(commandFor(command), args, {
      cwd,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PNPM_CONFIG_FROZEN_LOCKFILE: 'false',
        npm_config_frozen_lockfile: 'false',
        ...extraEnv
      }
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => {
      stdout += d.toString()
      process.stdout.write(d)
    })
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
      process.stderr.write(d)
    })
    child.on('close', (code) => resolve({code: code ?? 1, stdout, stderr}))
    child.on('error', (e) =>
      resolve({code: 1, stdout, stderr: String(e?.message || e)})
    )
  })
}

function runDevUntilReady(cwd, extraEnv = {}, timeoutMs = 90_000) {
  return new Promise((resolve) => {
    const child = spawn(
      commandFor('pnpm'),
      [
        'exec',
        'extension',
        'dev',
        'packages/extension',
        '--no-browser',
        '--no-telemetry'
      ],
      {
        cwd,
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...extraEnv
        }
      }
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
        const t = setTimeout(done, ms)
        child.once('close', () => {
          clearTimeout(t)
          done()
        })
      })

    const kill = async () => {
      if (childClosed) return
      if (process.platform === 'win32' && child.pid) {
        try {
          await run('taskkill', ['/PID', String(child.pid), '/T', '/F'], cwd)
        } catch { /* ignore */ }
        await waitClose()
        return
      }
      try {
        child.kill('SIGTERM')
      } catch { /* ignore */ }
      await waitClose(1500)
      if (!childClosed) {
        try {
          child.kill('SIGKILL')
        } catch { /* ignore */ }
        await waitClose()
      }
    }

    const finish = async (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      await kill()
      resolve(result)
    }

    const check = () => {
      const output = `${stdout}\n${stderr}`
      for (const hint of failureHints) {
        if (output.includes(hint)) {
          void finish({code: 1, stdout, stderr, error: `matched: ${hint}`})
          return
        }
      }
      if (compileSuccessHints.some((h) => output.includes(h))) sawCompile = true
      if (output.includes(readyHint)) sawReady = true
      if (sawCompile && sawReady) {
        void finish({code: 0, stdout, stderr, error: null})
      }
    }

    child.stdout?.on('data', (d) => {
      stdout += d.toString()
      process.stdout.write(d)
      check()
    })
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
      process.stderr.write(d)
      check()
    })
    child.on('close', (code) => {
      childClosed = true
      void finish({code: code ?? 1, stdout, stderr, error: null})
    })
    child.on(
      'error',
      (e) =>
        void finish({code: 1, stdout, stderr, error: String(e?.message || e)})
    )

    const timer = setTimeout(
      () =>
        void finish({
          code: 1,
          stdout,
          stderr,
          error: `timed out (${timeoutMs}ms)`
        }),
      timeoutMs
    )
  })
}

async function main() {
  if (!fs.existsSync(exampleSource)) {
    throw new Error(`Example not found: ${exampleSource}`)
  }

  const extensionSpec = getExtensionSpec()
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'extjs-pnpm-monorepo-')
  )
  const workDir = path.join(tempRoot, 'sidebar-monorepo-turbopack')

  try {
    console.log(`\n══ pnpm monorepo dev regression check ══`)
    console.log(`Extension spec: ${extensionSpec}`)
    console.log(`Temp workspace: ${workDir}\n`)

    fs.cpSync(exampleSource, workDir, {recursive: true})
    fs.rmSync(path.join(workDir, 'node_modules'), {
      recursive: true,
      force: true
    })

    // Remove stale lockfiles so pnpm resolves fresh
    for (const lock of ['pnpm-lock.yaml', 'package-lock.json']) {
      const lockPath = path.join(workDir, lock)
      if (fs.existsSync(lockPath)) fs.rmSync(lockPath)
    }

    // Inject `extension` as a root devDependency
    const pkgPath = path.join(workDir, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    pkg.devDependencies = pkg.devDependencies || {}
    pkg.devDependencies.extension = extensionSpec
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

    console.log('► pnpm install')
    const install = await run(
      'pnpm',
      ['install', '--no-frozen-lockfile'],
      workDir
    )
    if (install.code !== 0) {
      throw new Error(`pnpm install failed (code ${install.code})`)
    }

    console.log('\n► extension dev packages/extension --no-browser')
    const dev = await runDevUntilReady(workDir)
    const output = `${dev.stdout}\n${dev.stderr}\n${dev.error || ''}`

    if (dev.code !== 0) {
      throw new Error(
        `Dev failed (code ${dev.code}).\n${dev.error || ''}\n` +
          failureHints
            .filter((h) => output.includes(h))
            .map((h) => `  matched failure hint: ${h}`)
            .join('\n')
      )
    }

    console.log('\n✔ pnpm monorepo dev compilation succeeded')
  } finally {
    try {
      fs.rmSync(tempRoot, {recursive: true, force: true})
    } catch { /* ignore */ }
  }
}

main().catch((err) => {
  console.error(`\n✖ pnpm monorepo dev regression check failed`)
  console.error(err)
  process.exit(1)
})
