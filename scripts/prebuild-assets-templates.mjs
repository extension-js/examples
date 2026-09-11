#!/usr/bin/env node
// Pre-build every template referenced by examples/template.assets.spec.ts
// before Playwright workers start.
//
// Why this exists: resolveBuiltExtensionPath() in extension-fixtures.ts calls
// `build-with-manifest.mjs build` at module-load time when dist/ is missing.
// Playwright runs 4 workers in parallel and each worker re-imports the spec,
// so without a prebuild step multiple workers race the same build and one can
// observe a half-written dist/ ("manifest missing" chrome errors). Building
// serially here guarantees every worker finds a complete dist/ when it imports.

import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {restoreGuardedSources} from './restore-guarded-sources.mjs'
import {isCompleteDist, prodDistPath, publishProdDist} from './prod-dist.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const EXAMPLES_DIR = path.join(REPO_ROOT, 'examples')
const BUILD_SCRIPT = path.join(__dirname, 'build-with-manifest.mjs')

// Kept in sync with template.assets.spec.ts. Order is irrelevant; uniqueness
// matters because the spec references the same template from multiple suites
// (e.g. `content` appears in CONTENT_TEMPLATES and BG_TEMPLATES).
const TEMPLATES = [
  // CONTENT_TEMPLATES
  'content',
  'content-css-modules',
  'content-sass',
  'content-less',
  'content-sass-modules',
  'content-less-modules',
  'content-main-world',
  'content-multi-one-entry',
  'content-multi-three-entries',
  'content-typescript',
  'content-env',
  // TAILWIND_CONTENT_TEMPLATES
  'content-react',
  'content-preact',
  'content-vue',
  'content-svelte',
  // PILL_CONTENT_TEMPLATES / FRAMEWORK_TEMPLATES / mixed-context
  'javascript',
  'typescript',
  'react',
  'preact',
  'vue',
  'svelte',
  // Standalone templates with bespoke suites
  'content-custom-font',
  'newtab-browser-flags',
  // HTML_TEMPLATES
  'action',
  'newtab',
  'sidebar',
  // Templates whose STATIC spec asserts on a clean production dist.
  // Without prebuilding these, their first dist is created by a dev-mode
  // sibling spec (template.dev.spec.ts / template.reload.spec.ts), which
  // bakes the dev reload runtime + dev-mode bundle artifacts into the
  // build. The static test (e.g. sidebar-antd interop assertion,
  // content-env env-injection assertion, action-locales locale rebuild
  // verifier) then reads that dev-flavored dist and trips on artifacts
  // that wouldn't appear in a real prod build (e.g. WebSocket reload
  // connection attempts, `(void 0).EXTENSION_PUBLIC_*` substitutions).
  'sidebar-antd',
  'content-env',
  'action-locales'
]

// Only a complete `dist/chrome` counts. Accepting `dist/chromium` here used
// to leave a dev-flavored tree as the one the static specs read.
function hasBuiltDist(exampleDir) {
  return isCompleteDist(path.join(exampleDir, 'dist', 'chrome'))
}

function installDeps(exampleDir, {clean = false} = {}) {
  if (!fs.existsSync(path.join(exampleDir, 'package.json'))) return true
  // Mirror scripts/build-all.mjs: install per-example with --ignore-workspace
  // so pnpm never merges this into the repo's workspace. When `clean` is set,
  // wipe node_modules first — some prior Extension.js installs have been
  // observed to leave node_modules with top-level dirs missing key files
  // (e.g. svelte's transitive clsx with no dist/), which only a clean install
  // recovers from.
  if (clean) {
    fs.rmSync(path.join(exampleDir, 'node_modules'), {
      recursive: true,
      force: true
    })
  }
  const r = spawnSync(
    'pnpm',
    ['install', '--no-frozen-lockfile', '--prod=false', '--ignore-workspace'],
    {cwd: exampleDir, stdio: 'inherit'}
  )
  return r.status === 0
}

function runBuild(exampleDir) {
  return spawnSync(
    process.execPath,
    [BUILD_SCRIPT, 'build', '--browser=chrome'],
    {
      cwd: exampleDir,
      stdio: 'inherit',
      env: {...process.env, EXTENSION_SKIP_INSTALL: '1'}
    }
  )
}

function buildOne(name) {
  const exampleDir = path.join(EXAMPLES_DIR, name)
  if (!fs.existsSync(path.join(exampleDir, 'src', 'manifest.json'))) {
    return {name, status: 'skipped (no src/manifest.json)'}
  }
  if (hasBuiltDist(exampleDir) && !process.env.FORCE_PREBUILD) {
    return publishProdDist(exampleDir)
      ? {name, status: 'cached (republished)'}
      : {name, status: 'FAILED (publish)'}
  }
  // A warm tree whose dist/ a prior run wiped still has its published copy,
  // and that copy is the only thing the static specs read.
  if (isCompleteDist(prodDistPath(exampleDir)) && !process.env.FORCE_PREBUILD) {
    return {name, status: 'cached (published)'}
  }
  if (!installDeps(exampleDir)) {
    return {name, status: 'FAILED (install)'}
  }
  let r = runBuild(exampleDir)
  if (r.status !== 0 || !hasBuiltDist(exampleDir)) {
    // One retry after wiping node_modules — catches partial/corrupted installs
    // (e.g. top-level dep dirs missing dist/ files).
    if (!installDeps(exampleDir, {clean: true})) {
      return {name, status: 'FAILED (install after wipe)'}
    }
    r = runBuild(exampleDir)
  }
  if (r.status !== 0) {
    return {name, status: `FAILED (exit ${r.status})`}
  }
  if (!hasBuiltDist(exampleDir)) {
    return {name, status: 'FAILED (no dist after build)'}
  }
  if (!publishProdDist(exampleDir)) {
    return {name, status: 'FAILED (publish)'}
  }
  return {name, status: 'built'}
}

const DEBUG_PORT_BAND = [9222, 9223, 9224, 9225]

function isPortBound(port) {
  return new Promise((resolve) => {
    const socket = net.connect({host: '127.0.0.1', port})
    const settle = (value) => {
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(500)
    socket.on('connect', () => settle(true))
    socket.on('timeout', () => settle(false))
    socket.on('error', () => settle(false))
  })
}

function listenerPids(port) {
  const r = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8'
  })
  return String(r.stdout || '')
    .split('\n')
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0)
}

function describePid(pid) {
  const r = spawnSync('ps', ['-o', 'command=', '-p', String(pid)], {
    encoding: 'utf8'
  })
  return String(r.stdout || '').trim()
}

// The CLI derives its debugging port from 9222 up. A browser already holding
// one kills the run mid-edit, which is how source corruption starts.
async function assertDebuggingPortsFree() {
  if (process.env.ALLOW_BUSY_CDP_PORT === '1') return
  const foreign = []
  for (const port of DEBUG_PORT_BAND) {
    if (!(await isPortBound(port))) continue
    for (const pid of listenerPids(port)) {
      const command = describePid(pid)
      // Only reap what this checkout launched. Anything else is the owner's
      // browser, and the run stops rather than closing their window.
      if (command.includes(REPO_ROOT)) {
        console.log(
          `[prebuild-assets-templates] reaping orphaned harness browser ` +
            `pid ${pid} on port ${port}`
        )
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          // Already gone.
        }
      } else {
        foreign.push(`port ${port}: pid ${pid} ${command.slice(0, 120)}`)
      }
    }
  }
  if (!foreign.length) return
  throw new Error(
    `[prebuild-assets-templates] debugging port(s) still held by a browser ` +
      `this checkout did not launch:\n  ${foreign.join('\n  ')}\n` +
      `The reload specs edit example sources, and losing a dev server to a ` +
      `port clash leaves those edits on disk. Close the browser, or set ` +
      `ALLOW_BUSY_CDP_PORT=1 to run anyway.`
  )
}

export default async function globalSetup() {
  // Always first: a source left truncated by a killed run poisons every
  // build below, and every later run, until someone reverts it by hand.
  const reverted = restoreGuardedSources()
  if (reverted.length) {
    console.log(
      `[prebuild-assets-templates] reverted ${reverted.length} source file(s) ` +
        `left edited by an interrupted run:\n` +
        reverted.map((f) => `  ${path.relative(REPO_ROOT, f)}`).join('\n')
    )
  }
  // List-only callers (scripts/assert-spec-coverage.mjs) need Playwright to
  // collect specs, not to run them. Building templates there wastes minutes
  // and pollutes stdout while a JSON report is being captured.
  if (process.env.SKIP_PREBUILD === '1') {
    console.log('[prebuild-assets-templates] skipped (SKIP_PREBUILD=1)')
    return
  }
  await assertDebuggingPortsFree()
  const only = process.env.PREBUILD_ONLY
  const targets = only ? only.split(',').map((s) => s.trim()) : TEMPLATES
  const results = []
  const failures = []
  for (const name of targets) {
    const r = buildOne(name)
    results.push(r)
    if (r.status.startsWith('FAILED')) failures.push(r)
  }
  const summary = results
    .map((r) => `  ${r.status.padEnd(36)} ${r.name}`)
    .join('\n')
  console.log(`\n[prebuild-assets-templates] summary\n${summary}\n`)
  if (failures.length) {
    throw new Error(
      `[prebuild-assets-templates] ${failures.length} template(s) failed to build`
    )
  }
}

// Allow standalone invocation: `node scripts/prebuild-assets-templates.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  globalSetup().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
