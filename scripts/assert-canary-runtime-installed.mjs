#!/usr/bin/env node
// Pins the contract that the installed `extension` canary resolves its
// `extension-develop` runtime from this workspace's own node_modules,
// never from a surrounding monorepo's programs/develop. Captures the
// resolver-escape regression where the workspace walker climbed past
// node_modules into an outer extension.js checkout and either threw
// "Local extension-develop runtime is not built" or silently loaded the
// wrong runtime.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath, pathToFileURL} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const probePathCjs = path.join(__dirname, 'probe-extension-develop-resolve.cjs')
const probePathEsm = path.join(
  __dirname,
  'probe-extension-develop-resolve-esm.mjs'
)
// `--import` requires a URL form for absolute paths so the loader thread can
// resolve the registration module the same way on POSIX and Windows.
const probeEsmImportArg = pathToFileURL(probePathEsm).href

const installedExtensionBin = path.join(
  repoRoot,
  'node_modules',
  'extension',
  'bin',
  'extension.cjs'
)
const installedExtensionDevelopRoot = path.join(
  repoRoot,
  'node_modules',
  'extension-develop'
)

if (!fs.existsSync(installedExtensionBin)) {
  console.error(`✖ Canary not installed: missing ${installedExtensionBin}`)
  console.error('  Run `pnpm install` in _FUTURE/examples first.')
  process.exit(1)
}

if (!fs.existsSync(installedExtensionDevelopRoot)) {
  console.error(
    `✖ Missing installed runtime: ${installedExtensionDevelopRoot}`
  )
  process.exit(1)
}

const fakeProject = fs.mkdtempSync(
  path.join(os.tmpdir(), 'extjs-resolve-probe-')
)
fs.writeFileSync(
  path.join(fakeProject, 'manifest.json'),
  JSON.stringify(
    {manifest_version: 3, name: 'probe', version: '0.0.1'},
    null,
    2
  )
)

const result = await new Promise((resolve) => {
  const child = spawn(
    process.execPath,
    [installedExtensionBin, 'dev', fakeProject, '--no-telemetry'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_OPTIONS:
          `${process.env.NODE_OPTIONS ?? ''} --require ${probePathCjs} --import ${probeEsmImportArg}`.trim(),
        // Strip any stale env override that could mask resolver behavior.
        EXTENSION_DEVELOP_ROOT: ''
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )

  let stdout = ''
  let stderr = ''
  let killedOnMarker = false
  child.stdout.on('data', (d) => (stdout += d.toString()))
  child.stderr.on('data', (d) => {
    stderr += d.toString()
    // The ESM resolve hook lives in the loader worker thread and cannot
    // exit the main process directly, so kill from the parent as soon as
    // the marker line shows up. Avoids waiting for `extension dev` to
    // crash on the fake project (no package.json).
    if (!killedOnMarker && /__EXT_DEV_RESOLVED__::/.test(stderr)) {
      killedOnMarker = true
      child.kill('SIGKILL')
    }
  })

  const killTimer = setTimeout(() => {
    child.kill('SIGKILL')
  }, 60_000)

  child.on('close', (code) => {
    clearTimeout(killTimer)
    resolve({code: code ?? 1, stdout, stderr, killedOnMarker})
  })
  child.on('error', (err) => {
    clearTimeout(killTimer)
    resolve({
      code: 1,
      stdout,
      stderr: String(err?.message || err),
      killedOnMarker
    })
  })
})

fs.rmSync(fakeProject, {recursive: true, force: true})

const match = result.stderr.match(/__EXT_DEV_RESOLVED__::(.+)$/m)

if (!match) {
  if (
    /Local extension-develop runtime is not built/.test(
      `${result.stdout}\n${result.stderr}`
    )
  ) {
    console.error(result.stdout)
    console.error(result.stderr)
    console.error(
      '✖ Resolver-escape regression: the canary CLI walked into an outer ' +
        'workspace and demanded its programs/develop be compiled. The ' +
        'walker must bail when startDir is inside node_modules.'
    )
    process.exit(1)
  }

  console.error(result.stdout)
  console.error(result.stderr)
  console.error(
    '✖ Probe never observed extension-develop being loaded ' +
      `(exit ${result.code})`
  )
  process.exit(1)
}

const resolvedRaw = match[1].trim()
// CJS hook emits a filesystem path; ESM hook emits a `file://` URL. Normalize
// both to a filesystem path before checking the local-install prefix.
const resolvedPath = resolvedRaw.startsWith('file://')
  ? fileURLToPath(resolvedRaw)
  : resolvedRaw
const expectedPrefix = installedExtensionDevelopRoot + path.sep

if (!resolvedPath.startsWith(expectedPrefix)) {
  console.error(
    '✖ extension-develop resolved outside the local install:\n' +
      `  expected prefix: ${expectedPrefix}\n` +
      `  resolved:        ${resolvedPath}`
  )
  process.exit(1)
}

console.log(`✔ extension-develop resolved to ${resolvedPath}`)
