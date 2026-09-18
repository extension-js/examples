#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
const EXAMPLES = path.join(ROOT, 'examples')

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.extension'])

const legacy = []
let checked = 0

// Monorepo templates keep the project at packages/<name>, so a fixed
// examples/<slug>/src/public probe never sees theirs. Walk instead.
function findLegacyPublic(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (SKIP_DIRS.has(entry.name)) continue
    if (!entry.isDirectory()) continue

    const full = path.join(dir, entry.name)

    // The CLI serves the root public folder and only warns about the legacy
    // next-to-manifest one, so a template that keeps it there compiles noisy.
    if (entry.name === 'public' && path.basename(dir) === 'src') {
      legacy.push(path.relative(ROOT, full))

      continue
    }

    findLegacyPublic(full)
  }
}

for (const entry of fs.readdirSync(EXAMPLES, {withFileTypes: true})) {
  if (!entry.isDirectory()) continue

  checked++
  findLegacyPublic(path.join(EXAMPLES, entry.name))
}

// A walk that matches nothing would report every template as clean.
if (checked < 40) {
  console.error(
    `assert-public-folder-location: scanned only ${checked} templates, ` +
      'expected at least 40. The scan stopped matching.'
  )

  process.exit(1)
}

if (legacy.length) {
  console.error(
    `assert-public-folder-location: ${legacy.length} of ${checked} templates keep public next to the manifest:\n` +
      legacy.map((line) => `  ${line}`).join('\n') +
      '\nMove each folder to the template root (examples/<name>/public) so extension dev and build stop warning.'
  )

  process.exit(1)
}

console.log(
  `assert-public-folder-location: ${checked} templates scanned, none keep public next to a manifest`
)
