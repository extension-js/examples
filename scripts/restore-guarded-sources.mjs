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

function readJournal(journalPath) {
  let record = null
  try {
    record = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
  } catch {
    return null
  }
  const usable =
    record &&
    typeof record.file === 'string' &&
    typeof record.original === 'string'
  if (!usable) return null
  // Journals written before the timestamp existed fall back to their mtime.
  let at = typeof record.at === 'number' ? record.at : Number.NaN
  if (!Number.isFinite(at)) {
    try {
      at = fs.statSync(journalPath).mtimeMs
    } catch {
      at = Number.POSITIVE_INFINITY
    }
  }
  return {file: record.file, original: record.original, at}
}

export function restoreGuardedSources() {
  let names = []
  try {
    names = fs.readdirSync(JOURNAL_DIR)
  } catch {
    return []
  }
  // Every process that guards a file writes its own journal. The oldest one
  // was captured before any of them edited, so it holds the true original.
  const journalPaths = []
  const oldestByFile = new Map()
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const journalPath = path.join(JOURNAL_DIR, name)
    journalPaths.push(journalPath)
    const record = readJournal(journalPath)
    if (!record) continue
    const known = oldestByFile.get(record.file)
    if (!known || record.at < known.at) oldestByFile.set(record.file, record)
  }
  const restored = []
  for (const [file, record] of oldestByFile) {
    try {
      if (fs.readFileSync(file, 'utf8') !== record.original) {
        fs.writeFileSync(file, record.original, 'utf8')
        restored.push(file)
      }
    } catch {
      // Ignore
    }
  }
  for (const journalPath of journalPaths) fs.rmSync(journalPath, {force: true})
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
