#!/usr/bin/env node
// Every spec file under examples/ must be collected by at least one project
// in the root playwright.config.ts. The projects are testMatch allow-lists,
// so a template whose slug no project claims used to be skipped silently:
// examples/playwright/template.spec.ts sat uncollected while its README
// claimed CI coverage (BUGS_TO_FIX 124). This guard makes that class of
// drift a hard failure instead of silence.
//
// Exemption: a spec nested inside a template that ships its OWN
// playwright.config.ts (for example examples/playwright/e2e/) belongs to
// the scaffolded project and runs under the template's config, not ours.
// The template's top-level template.spec.ts is never exempt.
//
// Usage: node scripts/assert-spec-coverage.mjs
// Exits non-zero listing every spec file no project collects.
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const EXAMPLES = path.join(ROOT, 'examples')
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.extension',
  'playwright-report',
  'test-results'
])

// Walk examples/ for spec files the root config is expected to collect.
function specsOnDisk() {
  const found = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (SKIP_DIRS.has(entry.name)) continue
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (entry.name.endsWith('.spec.ts')) found.push(p)
    }
  }
  walk(EXAMPLES)
  return found
}

// A spec is template-internal when it lives BELOW a template root that has
// its own playwright.config.ts. The scaffolded user project runs it.
function isTemplateInternal(absPath) {
  const rel = path.relative(EXAMPLES, absPath)
  const parts = rel.split(path.sep)
  if (parts.length < 3) return false
  const templateRoot = path.join(EXAMPLES, parts[0])
  return (
    fs.existsSync(path.join(templateRoot, 'playwright.config.ts')) ||
    fs.existsSync(path.join(templateRoot, 'playwright.config.mjs'))
  )
}

// Ask Playwright itself what it collects. The JSON report lists one suite
// per collected file, with paths relative to the configured testDir.
function specsCollected() {
  const result = spawnSync(
    'npx',
    ['playwright', 'test', '--list', '--reporter=json'],
    {cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024}
  )
  if (result.status !== 0) {
    console.error('►►► playwright test --list failed')
    console.error(result.stderr || result.stdout)
    process.exit(1)
  }
  const report = JSON.parse(result.stdout)
  const files = new Set()
  for (const suite of report.suites ?? []) {
    files.add(path.resolve(EXAMPLES, suite.file))
  }
  return files
}

const collected = specsCollected()
const missing = []
let checked = 0
let internal = 0

for (const spec of specsOnDisk()) {
  if (isTemplateInternal(spec)) {
    internal++
    continue
  }
  checked++
  if (!collected.has(spec)) missing.push(path.relative(ROOT, spec))
}

if (missing.length > 0) {
  console.error(
    '►►► Spec files collected by NO project in playwright.config.ts:'
  )
  for (const file of missing.sort()) console.error(`►►►   ${file}`)
  console.error(
    '►►► Add the template slug to a project testMatch or leave it to the ' +
      'catch-all `other` project. Silence is not an option.'
  )
  process.exit(1)
}

console.log(
  `►►► Spec coverage OK: ${checked} spec files collected, ` +
    `${internal} template-internal specs exempt.`
)
