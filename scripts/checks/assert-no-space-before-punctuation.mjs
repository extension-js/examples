#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
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
const MARKUP_EXTENSIONS = new Set(['.vue', '.svelte', '.jsx', '.tsx', '.html'])

// A line break between a closing inline tag and sentence punctuation
// collapses to a rendered space, so the panel shows "docs ." instead of "docs."
const SPLIT_PUNCTUATION = /<\/(?:a|span)>\n\s*[.,;:!?]/g

const bad = []
let checked = 0

function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (SKIP_DIRS.has(entry.name)) continue

    const p = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      walk(p)
    } else if (MARKUP_EXTENSIONS.has(path.extname(entry.name))) {
      checked++

      const source = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

      for (const match of source.matchAll(SPLIT_PUNCTUATION)) {
        const line = source.slice(0, match.index).split('\n').length

        bad.push(`${path.relative(ROOT, p)}:${line}`)
      }
    }
  }
}

walk(EXAMPLES)

if (bad.length) {
  console.error(
    `assert-no-space-before-punctuation: ${bad.length} markup spots put a line break between a closing tag and punctuation:\n` +
      bad.map((line) => `  ${line}`).join('\n') +
      '\nPut the punctuation right after the closing tag on the same line so no space renders before it.'
  )

  process.exit(1)
}

console.log(
  `assert-no-space-before-punctuation: ${checked} markup files keep punctuation next to its closing tag`
)
