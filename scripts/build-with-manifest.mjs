#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const CWD = process.cwd()
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname)
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')

// Some environments may not allow writing to the user's home directory.
// The Extension.js CLI writes telemetry under $XDG_CONFIG_HOME (or ~/.config),
// so default it to a repo-local folder to keep builds reliable.
const XDG_CONFIG_HOME =
  process.env.XDG_CONFIG_HOME || path.join(REPO_ROOT, '.xdg-config')

try {
  fs.mkdirSync(XDG_CONFIG_HOME, {recursive: true})
} catch {
  /* noop */
}

function run(command, args, opts = {}) {
  const r = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...opts
  })

  if (r.error) throw r.error
  if (r.status !== 0) process.exit(r.status ?? 1)
}

// Resolve the CLI we should use.
// Priority:
//   1. EXTENSION_CLI_PATH env var (explicit override)
//   2. Monorepo local CLI at ../../programs/extension/dist/cli.cjs
//      (when this examples repo sits inside the extension.js monorepo)
//   3. Published `extension` binary on PATH (via node_modules/.bin)
function resolveCliInvocation() {
  const explicit = process.env.EXTENSION_CLI_PATH
  if (explicit && fs.existsSync(explicit)) {
    return {kind: 'node', cliPath: explicit}
  }
  const monorepoCli = path.resolve(
    REPO_ROOT,
    '..',
    '..',
    'programs',
    'extension',
    'dist',
    'cli.cjs'
  )
  if (fs.existsSync(monorepoCli)) {
    return {kind: 'node', cliPath: monorepoCli}
  }
  return {kind: 'bin'}
}

function main() {
  const mode = process.argv[2] || 'build' // build | dev | preview
  const extraArgs = process.argv.slice(3)

  // No manifest rewriting.
  // Extension.js resolves manifest.json recursively (e.g. src/manifest.json),
  // so this script must never create a temporary root manifest.json.
  const env = {...process.env, XDG_CONFIG_HOME}

  // Ensure the root workspace binary is available from any example dir.
  const binDir = path.join(REPO_ROOT, 'node_modules', '.bin')
  env.PATH = env.PATH ? `${binDir}${path.delimiter}${env.PATH}` : binDir

  if (process.env.EXTENSION_SKIP_INSTALL !== undefined) {
    env.EXTENSION_SKIP_INSTALL = process.env.EXTENSION_SKIP_INSTALL
  }

  const invocation = resolveCliInvocation()
  if (invocation.kind === 'node') {
    run(process.execPath, [invocation.cliPath, mode, ...extraArgs], {
      cwd: CWD,
      env
    })
  } else {
    run('extension', [mode, ...extraArgs], {
      cwd: CWD,
      env
    })
  }
}

main()
