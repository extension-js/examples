#!/usr/bin/env node
// Every .json file in this repo must parse as STRICT JSON — no comments, no
// unquoted keys, no trailing commas. TypeScript happens to tolerate JSONC in
// tsconfig.json, but hand-copying a JSONC/JSON5-ish file into docs or another
// tool is exactly how extension.js.org#200 shipped a tsconfig example users
// couldn't paste (JSON parse error). Templates are user-facing: keep them
// copy-paste safe.
//
// Usage: node scripts/assert-strict-json.mjs
// Exits non-zero listing every offending file.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.extension',
  'playwright-report',
  'test-results'
])

const bad = []
let checked = 0

function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (SKIP_DIRS.has(entry.name)) continue
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(p)
    } else if (entry.name.endsWith('.json')) {
      checked++
      // Strip a UTF-8 BOM: Chrome tolerates it in manifests, JSON.parse does
      // not, and the reload-harness corpus showed wild files ship it.
      const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')
      try {
        JSON.parse(raw)
      } catch (err) {
        bad.push(`${path.relative(ROOT, p)} — ${err.message}`)
      }
    }
  }
}

walk(ROOT)

if (bad.length) {
  console.error(
    `assert-strict-json: ${bad.length} of ${checked} .json files are not strict JSON:\n` +
      bad.map((line) => `  ${line}`).join('\n') +
      '\nFix them (quote keys, drop comments and trailing commas) — JSONC/JSON5 is not allowed in this repo.'
  )
  process.exit(1)
}

console.log(`assert-strict-json: ${checked} .json files parse as strict JSON`)
