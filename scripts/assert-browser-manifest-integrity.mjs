#!/usr/bin/env node
// ██████╗ ██████╗  ██████╗ ██╗    ██╗███████╗███████╗██████╗
// ██╔══██╗██╔══██╗██╔═══██╗██║    ██║██╔════╝██╔════╝██╔══██╗
// ██████╔╝██████╔╝██║   ██║██║ █╗ ██║███████╗█████╗  ██████╔╝
// ██╔══██╗██╔══██╗██║   ██║██║███╗██║╚════██║██╔══╝  ██╔══██╗
// ██████╔╝██║  ██║╚██████╔╝╚███╔███╔╝███████║███████╗██║  ██║
// ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚══╝╚══╝ ╚══════╝╚══════╝╚═╝  ╚═╝
//
// Browser manifest-integrity guard.
//
// The examples matrix historically covered only chromium + firefox, which let
// real engine-family fallback bugs ship undetected:
//   - Safari resolved no manifest_version (its chromium:/firefox: prefixed keys
//     never matched) → invalid manifest, and a no-background example failed the
//     first build.
//   - Gecko forks (waterfox/librewolf) fell through exact-string checks into the
//     chromium default → wrong manifest shape / reload helper.
//
// This guard builds a representative set of examples for one target per "shape"
// — a Safari target, a chromium fork, and a gecko fork — in the Xcode-free
// `--no-browser` mode (fast, and the family-fallback failures surface at the
// compile/emit stage, before any browser launches). It then asserts the emitted
// manifest is internally consistent AND matches the engine family:
//   - chromium family (safari/brave) → manifest_version 3, background.service_worker
//   - gecko family   (waterfox)      → manifest_version 2, background.scripts
// and that every concrete file the manifest references exists on disk.
//
// Usage:
//   node scripts/assert-browser-manifest-integrity.mjs                 # representative set
//   node scripts/assert-browser-manifest-integrity.mjs --all           # every buildable example
//   node scripts/assert-browser-manifest-integrity.mjs --examples=init,content
//   node scripts/assert-browser-manifest-integrity.mjs --targets=safari,brave
import fs from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const EXAMPLES_DIR = path.join(REPO_ROOT, 'examples')

// Representative examples chosen to cover the manifest surface that previously
// broke: no background, declared background + content scripts, an action popup,
// and a multi-file (classic-concat) content script.
const DEFAULT_SET = ['init', 'content', 'action', 'content-multi-one-entry']

// One target per engine "shape": Safari (chromium-shaped MV3 bundle from the
// converter), a chromium fork, and a gecko fork. Forks get the same coverage as
// Safari — chromium-fork HTML pages and gecko-fork declared backgrounds now
// build, via normalizeBrowserForManifestFields in the develop pipeline.
const ALL_TARGETS = [
  {browser: 'safari', family: 'chromium', note: 'safari (chromium-shaped MV3)'},
  {browser: 'brave', family: 'chromium', note: 'chromium fork'},
  {browser: 'waterfox', family: 'gecko', note: 'gecko fork'}
]

// Per-family manifest expectations. A target falling back to the wrong family
// (the bug class this guard exists to catch) trips both the manifest_version and
// the forbidden-background-key assertions.
const FAMILY_RULES = {
  chromium: {
    manifestVersion: 3,
    backgroundKey: 'service_worker',
    forbiddenBackgroundKey: 'scripts'
  },
  gecko: {
    manifestVersion: 2,
    backgroundKey: 'scripts',
    forbiddenBackgroundKey: 'service_worker'
  }
}

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

function selectTargets() {
  const flag = process.argv.find((a) => a.startsWith('--targets='))
  if (!flag) return ALL_TARGETS
  const wanted = new Set(
    flag
      .slice('--targets='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  return ALL_TARGETS.filter((t) => wanted.has(t.browser))
}

function runDev(cli, exampleDir, browser) {
  return new Promise((resolve) => {
    const args = [exampleDir, '--browser', browser, '--no-browser', '--logs=info']
    const env = {
      ...process.env,
      EXTENSION_AUTHOR_MODE: 'development',
      EXTENSION_AUTO_EXIT_MS: process.env.EXTENSION_AUTO_EXIT_MS || '9000',
      EXTENSION_FORCE_KILL_MS: process.env.EXTENSION_FORCE_KILL_MS || '15000',
      EXTENSION_SKIP_INSTALL: '1'
    }
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
    setTimeout(() => child.kill('SIGKILL'), 45000).unref()
  })
}

// Concrete (non-glob, non-URL) files the manifest references that must exist.
function collectReferencedFiles(manifest) {
  const files = new Set()
  const add = (v) => {
    if (typeof v !== 'string') return
    const f = v.trim().replace(/^\/+/, '')
    if (!f) return
    if (/^(https?:)?\/\//i.test(v)) return
    if (/[*?[\]{}]/.test(f)) return
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

function validate(slug, target, result) {
  const problems = []
  const lower = result.out.toLowerCase()
  const rules = FAMILY_RULES[target.family]

  if (lower.includes('were not emitted to disk')) {
    problems.push('build reported "files were not emitted to disk"')
  }
  if (lower.includes('compiled with errors')) {
    problems.push('build reported "compiled with errors"')
  }
  const compiledOk =
    lower.includes('compiled successfully') ||
    lower.includes('extension ready for development')
  if (!compiledOk) problems.push('build did not report a successful compile')

  const distDir = path.join(EXAMPLES_DIR, slug, 'dist', target.browser)
  const manifestPath = path.join(distDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    problems.push(`dist/${target.browser}/manifest.json was not emitted`)
    return problems
  }

  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    problems.push(`dist/${target.browser}/manifest.json is not valid JSON: ${err.message}`)
    return problems
  }

  // Engine-family shape — a target that fell back to the wrong family fails here.
  if (manifest.manifest_version !== rules.manifestVersion) {
    problems.push(
      `manifest_version is ${JSON.stringify(manifest.manifest_version)} (expected ${rules.manifestVersion} for the ${target.family} family)`
    )
  }

  if (manifest.background) {
    if (manifest.background[rules.forbiddenBackgroundKey] !== undefined) {
      problems.push(
        `background.${rules.forbiddenBackgroundKey} is set, but the ${target.family} family expects background.${rules.backgroundKey} — looks like a wrong-family fallback`
      )
    }
    if (manifest.background[rules.backgroundKey] === undefined) {
      problems.push(
        `background is present but background.${rules.backgroundKey} is missing (expected for the ${target.family} family)`
      )
    }
  }

  for (const ref of collectReferencedFiles(manifest)) {
    if (!fs.existsSync(path.join(distDir, ref))) {
      problems.push(`manifest references "${ref}" but it was not emitted to disk`)
    }
  }

  return problems
}

async function main() {
  const cli = resolveCli()
  const targets = selectTargets()
  const examples = selectExamples()
  console.log(
    `►►► Browser manifest-integrity guard — ${targets.length} target(s) × ${examples.length} example(s) via ${
      cli.kind === 'node' ? cli.cliPath : 'extension (PATH)'
    }`
  )

  const failures = []
  let totalChecks = 0
  for (const target of targets) {
    console.log(`\n— ${target.browser} (${target.note}) —`)
    for (const slug of examples) {
      totalChecks++
      const exampleDir = path.join(EXAMPLES_DIR, slug)
      if (!fs.existsSync(path.join(exampleDir, 'package.json'))) {
        failures.push({slug, target: target.browser, problems: ['example not found']})
        console.log(`  ✗ ${slug} — not found`)
        continue
      }
      fs.rmSync(path.join(exampleDir, 'dist', target.browser), {
        recursive: true,
        force: true
      })

      const result = await runDev(cli, exampleDir, target.browser)
      const problems = validate(slug, target, result)
      if (problems.length === 0) {
        console.log(`  ✓ ${slug}`)
      } else {
        failures.push({slug, target: target.browser, problems})
        console.log(`  ✗ ${slug}`)
        problems.forEach((p) => console.log(`      - ${p}`))
      }
    }
  }

  if (failures.length > 0) {
    console.error(
      `\n►►► Browser manifest-integrity FAILED for ${failures.length}/${totalChecks} check(s).`
    )
    process.exit(1)
  }
  console.log(
    `\n►►► Browser manifest-integrity PASSED for all ${totalChecks} check(s).`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
