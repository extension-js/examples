#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
const EXAMPLES = path.join(ROOT, 'examples')

const legacy = []
let checked = 0

for (const entry of fs.readdirSync(EXAMPLES, {withFileTypes: true})) {
  if (!entry.isDirectory()) continue

  checked++

  // The CLI serves the root public folder and only warns about the legacy
  // next-to-manifest one, so a template that keeps it there compiles noisy.
  const nested = path.join(EXAMPLES, entry.name, 'src', 'public')

  if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
    legacy.push(path.relative(ROOT, nested))
  }
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
  `assert-public-folder-location: ${checked} templates keep public at the template root`
)
