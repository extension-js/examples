#!/usr/bin/env node
// ███████╗ █████╗ ███████╗ █████╗ ██████╗ ██╗
// ██╔════╝██╔══██╗██╔════╝██╔══██╗██╔══██╗██║
// ███████╗███████║█████╗  ███████║██████╔╝██║
// ╚════██║██╔══██║██╔══╝  ██╔══██║██╔══██╗██║
// ███████║██║  ██║██║     ██║  ██║██║  ██║██║
// ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
//
// Safari manifest-integrity guard.
//
// Safari was historically uncovered by the examples matrix (chromium + firefox
// only), which let two real bugs ship undetected:
//   1. Safari resolved no manifest_version (its chromium:/firefox: prefixed
//      keys never matched), so the emitted manifest was invalid.
//   2. A no-background example injected background.service_worker but no build
//      entry emitted it, failing the first build.
//
// This guard builds a representative set of examples for `--browser safari` in
// the Xcode-free `--no-browser` mode (so it runs fast on any macOS CI box, and
// even on non-macOS since the failure is at the compile/emit stage, before the
// converter) and asserts the emitted dist/safari manifest is internally
// consistent: it has a manifest_version and every concrete file it references
// exists on disk.
//
// Usage:
//   node scripts/assert-safari-manifest-integrity.mjs                 # representative set
//   node scripts/assert-safari-manifest-integrity.mjs --all           # every buildable example
//   node scripts/assert-safari-manifest-integrity.mjs --examples=init,content
import fs from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const EXAMPLES_DIR = path.join(REPO_ROOT, 'examples')

// Representative examples chosen to cover the manifest surface that previously
// broke on Safari: no background, declared background + content scripts, an
// action popup, and a multi-file (classic-concat) content script.
const DEFAULT_SET = [
  'init',
  'content',
  'action',
  'content-multi-one-entry'
]

// ── CLI resolution (mirrors scripts/build-with-manifest.mjs) ────────────────
function resolveCli() {
  const explicit = process.env.EXTENSION_CLI_PATH
  if (explicit && fs.existsSync(explicit)) return {kind: 'node', cliPath: explicit}
  const monorepoCli = path.resolve(
    REPO_ROOT,
    '..',
    '..',
    'programs',
    'extension',
    'dist',
    'cli.cjs'
  )
  if (fs.existsSync(monorepoCli)) return {kind: 'node', cliPath: monorepoCli}
  return {kind: 'bin'}
}

function listAllExamples() {
  return fs
    .readdirSync(EXAMPLES_DIR, {withFileTypes: true})
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) =>
      fs.existsSync(path.join(EXAMPLES_DIR, name, 'package.json'))
    )
    .sort()
}

function selectExamples() {
  if (process.argv.includes('--all')) return listAllExamples()
  const flag = process.argv.find((a) => a.startsWith('--examples='))
  if (flag) {
    return flag
      .slice('--examples='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return DEFAULT_SET
}

function runSafariDev(cli, exampleDir) {
  return new Promise((resolve) => {
    const args = [exampleDir, '--browser', 'safari', '--no-browser', '--logs=info']
    const env = {
      ...process.env,
      EXTENSION_AUTHOR_MODE: 'development',
      EXTENSION_AUTO_EXIT_MS: process.env.EXTENSION_AUTO_EXIT_MS || '9000',
      EXTENSION_FORCE_KILL_MS: process.env.EXTENSION_FORCE_KILL_MS || '15000',
      // Avoid pnpm shim auto-install churn; deps are already present.
      EXTENSION_SKIP_INSTALL: '1'
    }
    // Ensure the workspace bin is reachable when falling back to the published CLI.
    const binDir = path.join(REPO_ROOT, 'node_modules', '.bin')
    env.PATH = env.PATH ? `${binDir}${path.delimiter}${env.PATH}` : binDir

    const command = cli.kind === 'node' ? process.execPath : 'extension'
    const fullArgs = cli.kind === 'node' ? [cli.cliPath, 'dev', ...args] : ['dev', ...args]

    const child = spawn(command, fullArgs, {cwd: exampleDir, env})
    let out = ''
    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (out += d.toString()))
    child.on('error', (err) => resolve({out: `${out}\nspawn error: ${err.message}`, code: 1}))
    child.on('close', (code) => resolve({out, code}))
    // Hard safety timeout in case auto-exit fails.
    setTimeout(() => child.kill('SIGKILL'), 45000).unref()
  })
}

// Files the manifest references that must exist on disk (concrete, non-glob).
function collectReferencedFiles(manifest) {
  const files = new Set()
  const add = (v) => {
    if (typeof v !== 'string') return
    const f = v.trim().replace(/^\/+/, '')
    if (!f) return
    if (/^(https?:)?\/\//i.test(v)) return // external URL
    if (/[*?[\]{}]/.test(f)) return // glob (e.g. web_accessible_resources)
    files.add(f)
  }

  add(manifest?.background?.service_worker)
  add(manifest?.background?.page)
  if (Array.isArray(manifest?.background?.scripts)) manifest.background.scripts.forEach(add)

  if (Array.isArray(manifest?.content_scripts)) {
    for (const cs of manifest.content_scripts) {
      if (Array.isArray(cs?.js)) cs.js.forEach(add)
      if (Array.isArray(cs?.css)) cs.css.forEach(add)
    }
  }

  add(manifest?.action?.default_popup)
  add(manifest?.side_panel?.default_path)
  add(manifest?.options_page)
  add(manifest?.options_ui?.page)
  add(manifest?.devtools_page)
  add(manifest?.chrome_url_overrides?.newtab)
  if (manifest?.icons) Object.values(manifest.icons).forEach(add)
  if (manifest?.action?.default_icon) {
    const di = manifest.action.default_icon
    if (typeof di === 'string') add(di)
    else if (di && typeof di === 'object') Object.values(di).forEach(add)
  }

  return [...files]
}

function validateExample(slug, result) {
  const problems = []
  const lower = result.out.toLowerCase()

  if (lower.includes('were not emitted to disk')) {
    problems.push('build reported "files were not emitted to disk"')
  }
  if (lower.includes('compiled with errors')) {
    problems.push('build reported "compiled with errors"')
  }
  const compiledOk =
    lower.includes('compiled successfully') ||
    lower.includes('extension ready for development')
  if (!compiledOk) {
    problems.push('build did not report a successful compile')
  }

  const distSafari = path.join(EXAMPLES_DIR, slug, 'dist', 'safari')
  const manifestPath = path.join(distSafari, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    problems.push('dist/safari/manifest.json was not emitted')
    return problems
  }

  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    problems.push(`dist/safari/manifest.json is not valid JSON: ${err.message}`)
    return problems
  }

  // Safari Web Extensions are MV3. A missing manifest_version is exactly the
  // regression this guard exists to catch.
  if (manifest.manifest_version !== 3) {
    problems.push(
      `manifest_version is ${JSON.stringify(manifest.manifest_version)} (expected 3)`
    )
  }

  for (const ref of collectReferencedFiles(manifest)) {
    if (!fs.existsSync(path.join(distSafari, ref))) {
      problems.push(`manifest references "${ref}" but it was not emitted to disk`)
    }
  }

  return problems
}

async function main() {
  const cli = resolveCli()
  const examples = selectExamples()
  console.log(
    `►►► Safari manifest-integrity guard — ${examples.length} example(s) via ${
      cli.kind === 'node' ? cli.cliPath : 'extension (PATH)'
    }`
  )

  const failures = []
  for (const slug of examples) {
    const exampleDir = path.join(EXAMPLES_DIR, slug)
    if (!fs.existsSync(path.join(exampleDir, 'package.json'))) {
      failures.push({slug, problems: ['example not found in examples/']})
      console.log(`  ✗ ${slug} — not found`)
      continue
    }
    // Clean prior safari output so this run is authoritative.
    fs.rmSync(path.join(exampleDir, 'dist', 'safari'), {recursive: true, force: true})

    const result = await runSafariDev(cli, exampleDir)
    const problems = validateExample(slug, result)
    if (problems.length === 0) {
      console.log(`  ✓ ${slug}`)
    } else {
      failures.push({slug, problems})
      console.log(`  ✗ ${slug}`)
      problems.forEach((p) => console.log(`      - ${p}`))
    }
  }

  if (failures.length > 0) {
    console.error(
      `\n►►► Safari manifest-integrity FAILED for ${failures.length}/${examples.length} example(s).`
    )
    process.exit(1)
  }
  console.log(`\n►►► Safari manifest-integrity PASSED for all ${examples.length} example(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
