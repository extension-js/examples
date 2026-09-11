#!/usr/bin/env node
// Replays the journal examples/source-guard.ts writes before every edit.
// A run killed mid-edit leaves truncated sources, and this undoes them.

import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
const JOURNAL_DIR = path.join(REPO_ROOT, '.source-guard')

export function restoreGuardedSources() {
  let names = []
  try {
    names = fs.readdirSync(JOURNAL_DIR)
  } catch {
    return []
  }
  const restored = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const journalPath = path.join(JOURNAL_DIR, name)
    let record = null
    try {
      record = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
    } catch {
      // Ignore
    }
    const usable =
      record &&
      typeof record.file === 'string' &&
      typeof record.original === 'string'
    if (usable) {
      try {
        if (fs.readFileSync(record.file, 'utf8') !== record.original) {
          fs.writeFileSync(record.file, record.original, 'utf8')
          restored.push(record.file)
        }
      } catch {
        // Ignore
      }
    }
    fs.rmSync(journalPath, {force: true})
  }
  return restored
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const restored = restoreGuardedSources()
  console.log(
    restored.length
      ? `[restore-guarded-sources] reverted ${restored.length} file(s):\n` +
          restored.map((f) => `  ${path.relative(REPO_ROOT, f)}`).join('\n')
      : '[restore-guarded-sources] nothing to revert'
  )
}
