#!/usr/bin/env node
/**
 * Regression gate: run `extension dev` inside a Yarn Berry Plug'n'Play project.
 *
 * Yarn PnP is the strictest linker in the ecosystem: a package may only require
 * modules it DECLARES, even if the module is physically present in the tree.
 * npm's flat node_modules, yarn-classic, and pnpm's default public store all
 * make undeclared-but-present transitive packages resolvable by hoisting, so a
 * dev-server that prepends a bare specifier for a package extension-develop does
 * not declare (the historical `webpack/hot/dev-server`) works there by accident
 * — and only explodes in the field under PnP with a "Module not found". That is
 * exactly what broke issue #486; the pnpm monorepo gate could never catch it.
 *
 * This script copies the single-package `typescript` example (the same template
 * the #486 reporter used — sidebar + action HTML surfaces get the HMR runtime
 * prepended) into a temp dir, installs `extension` with Yarn Berry pinned to the
 * `pnp` nodeLinker, runs `extension dev`, and asserts the first compilation
 * reaches "ready" with no resolution errors.
 *
 * Override the runtime under test with EXTENSION_SPEC=<version|path> (defaults
 * to the `extension` spec pinned in the examples root package.json).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const exampleSource = path.join(repoRoot, 'examples', 'typescript')

const compileSuccessHints = ['compiled successfully', 'compiled with warnings']
const readyHint = 'Extension ready for development'
const failureHints = [
  'compiled with errors',
  'Module parse failed',
  'JavaScript parse error',
  'Unhandled rejection',
  'Module not found',
  "Can't resolve '@rspack/dev-server",
  "Can't resolve '@rspack/core",
  "Can't resolve 'webpack/hot/dev-server",
  // The user-facing form after extension-develop's brand scrubber rewrites
  // `webpack` -> `Extension.js` in console output (the shape #486 was reported
  // with). Matching it keeps the assertion honest even if a future regression
  // re-brands the same underlying resolution failure.
  "Can't resolve 'Extension.js/hot/dev-server"
]

function commandFor(tool) {
  if (process.platform !== 'win32') return tool
  if (tool === 'yarn') return 'yarn.cmd'
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
        // Corepack downloads the yarn version from `packageManager` on demand;
        // auto-download without an interactive prompt (CI has no stdin) and
        // don't let it re-pin and mutate the fixture package.json.
        COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
        COREPACK_ENABLE_AUTO_PIN: '0',
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
      commandFor('yarn'),
      ['exec', 'extension', 'dev', '.', '--no-browser', '--no-telemetry'],
      {
        cwd,
        ...(process.platform === 'win32' ? {shell: true} : {detached: true}),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
          COREPACK_ENABLE_AUTO_PIN: '0',
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
        } catch {
          /* ignore */
        }
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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'extjs-yarn-pnp-'))
  const workDir = path.join(tempRoot, 'typescript')

  try {
    console.log(`\n══ Yarn PnP dev regression check (issue #486) ══`)
    console.log(`Extension spec: ${extensionSpec}`)
    console.log(`Temp workspace: ${workDir}\n`)

    fs.cpSync(exampleSource, workDir, {recursive: true})

    // Strip everything that would pin the fixture to another package manager or
    // a stale install, so Yarn Berry resolves a fresh PnP tree from scratch.
    for (const junk of ['node_modules', 'dist', '.extension', '.yarn']) {
      fs.rmSync(path.join(workDir, junk), {recursive: true, force: true})
    }
    for (const lock of [
      'pnpm-lock.yaml',
      'package-lock.json',
      'yarn.lock',
      '.pnp.cjs',
      '.pnp.loader.mjs'
    ]) {
      fs.rmSync(path.join(workDir, lock), {force: true})
    }

    // Pin Yarn Berry (Corepack resolves it) and force the strict PnP linker.
    const pkgPath = path.join(workDir, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    // Default to the exact yarn the #486 reporter used (4.17.1). Overridable,
    // but note `npmMinimalAgeGate` below requires yarn >= 4.10.
    pkg.packageManager = process.env.YARN_VERSION
      ? `yarn@${process.env.YARN_VERSION}`
      : 'yarn@4.17.1'
    pkg.devDependencies = pkg.devDependencies || {}
    pkg.devDependencies.extension = extensionSpec

    // Pre-canary validation hook: point `extension-develop` (where the HMR entry
    // injection lives) at a locally built tarball via a forced resolution, so
    // this gate can prove a fix is green under PnP BEFORE a canary is published.
    // Build one with: (cd programs/develop && npm pack) and pass its path.
    const developTarball = process.env.EXTENSION_DEVELOP_TARBALL?.trim()
    if (developTarball) {
      const abs = path.resolve(developTarball)
      if (!fs.existsSync(abs)) {
        throw new Error(`EXTENSION_DEVELOP_TARBALL not found: ${abs}`)
      }
      pkg.resolutions = {...(pkg.resolutions || {}), 'extension-develop': `file:${abs}`}
      console.log(`Overriding extension-develop -> ${abs}`)
    }

    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

    // nodeLinker: pnp is Berry's default, but pin it explicitly so the gate is
    // immune to a global/user .yarnrc.yml flipping it to node-modules (which
    // hoists and would silently defeat the whole point of this check).
    fs.writeFileSync(
      path.join(workDir, '.yarnrc.yml'),
      [
        'nodeLinker: pnp',
        'enableGlobalCache: true',
        // Bypass Berry's supply-chain min-age delay so a freshly cut canary
        // pinned in the examples root installs immediately (yarn >= 4.10).
        'npmMinimalAgeGate: 0',
        ''
      ].join('\n')
    )

    console.log('► yarn install (PnP)')
    const install = await run('yarn', ['install'], workDir)
    if (install.code !== 0) {
      throw new Error(`yarn install failed (code ${install.code})`)
    }

    console.log('\n► yarn exec extension dev . --no-browser')
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

    console.log('\n✔ Yarn PnP dev compilation succeeded')
  } finally {
    try {
      fs.rmSync(tempRoot, {recursive: true, force: true})
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(`\n✖ Yarn PnP dev regression check failed`)
  console.error(err)
  process.exit(1)
})
