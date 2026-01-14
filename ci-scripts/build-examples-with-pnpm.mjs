#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import path from 'node:path'

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname)
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')

function run(command, args, opts = {}) {
  const r = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...opts
  })
  if (r.error) throw r.error
  if (r.status !== 0) process.exit(r.status ?? 1)
}

// Convenience wrapper used by some local/CI flows.
// Builds all examples via pnpm, delegating to the workspace scripts.
run('pnpm', ['run', 'build:examples'], {cwd: REPO_ROOT})
