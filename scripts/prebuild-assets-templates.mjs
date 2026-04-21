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
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

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
  'new-browser-flags',
  // HTML_TEMPLATES
  'action',
  'new',
  'sidebar'
]

function hasBuiltDist(exampleDir) {
  for (const channel of ['chrome', 'chromium', 'chrome-mv3']) {
    if (fs.existsSync(path.join(exampleDir, 'dist', channel, 'manifest.json'))) {
      return true
    }
  }
  return false
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
    return {name, status: 'cached'}
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
  return {name, status: 'built'}
}

export default async function globalSetup() {
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
