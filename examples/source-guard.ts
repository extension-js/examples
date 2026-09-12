// Journals the pristine text of every example source a spec is about to edit.
// A killed run leaves the journal behind, and globalSetup replays it.

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import {getDirname} from './dirname.js'

const JOURNAL_DIR = path.resolve(
  getDirname(import.meta.url),
  '..',
  '.source-guard'
)

const guarded = new Map<string, string>()
let handlersInstalled = false

function journalFileFor(absolutePath: string): string {
  const key = crypto
    .createHash('sha1')
    .update(absolutePath)
    .digest('hex')
    .slice(0, 16)
  return path.join(JOURNAL_DIR, `${key}.json`)
}

function writeIfChanged(absolutePath: string, original: string): void {
  try {
    if (fs.readFileSync(absolutePath, 'utf8') === original) return
  } catch {
    // Source vanished mid-run, so fall through and rewrite it.
  }
  try {
    fs.writeFileSync(absolutePath, original, 'utf8')
  } catch {
    // Ignore
  }
}

// SIGKILL cannot be trapped, which is why the journal exists. These handlers
// only shorten the window for the signals a runner actually sends first.
//
// Playwright loads spec files inside the runner, so a module-scope guard
// installs these on the runner too. Exiting from here would cut off its own
// SIGINT watcher (report, worker teardown), and a worker keeps a no-op
// listener so the runner decides when it goes. When another listener remains
// the handler only puts the originals back and keeps the baseline, since the
// run still has a moment to write again before the exit handler runs. When
// nothing else listens, the process is ours to end, so it releases and
// re-raises the signal for the default disposition.
function installHandlers(): void {
  if (handlersInstalled) return
  handlersInstalled = true
  process.on('exit', () => restoreGuardedSources())
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.once(signal, () => {
      if (process.listenerCount(signal) > 0) {
        for (const [file, original] of guarded) writeIfChanged(file, original)
        return
      }
      restoreGuardedSources()
      process.kill(process.pid, signal)
    })
  }
}

// Record `file` as pristine and hand back its original text. Repeat calls
// return the first reading, so a cascade of edits cannot poison the baseline.
export function guardSource(file: string): string {
  const absolutePath = path.resolve(file)
  const known = guarded.get(absolutePath)
  if (known !== undefined) return known
  const original = fs.readFileSync(absolutePath, 'utf8')
  guarded.set(absolutePath, original)
  installHandlers()
  try {
    fs.mkdirSync(JOURNAL_DIR, {recursive: true})
    fs.writeFileSync(
      journalFileFor(absolutePath),
      JSON.stringify({file: absolutePath, original}),
      'utf8'
    )
  } catch {
    // Ignore
  }
  return original
}

// Restore `file` and drop its journal entry. Safe to call more than once.
export function releaseSource(file: string): void {
  const absolutePath = path.resolve(file)
  const original = guarded.get(absolutePath)
  if (original === undefined) return
  writeIfChanged(absolutePath, original)
  guarded.delete(absolutePath)
  try {
    fs.unlinkSync(journalFileFor(absolutePath))
  } catch {
    // Ignore
  }
}

export function restoreGuardedSources(): void {
  for (const file of [...guarded.keys()]) releaseSource(file)
}
