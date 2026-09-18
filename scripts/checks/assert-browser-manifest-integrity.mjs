#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const EXAMPLES_DIR = path.join(REPO_ROOT, 'examples')

// Representative examples chosen to cover the manifest surface that previously
// broke: no background, declared background + content scripts, an action popup,
// and a multi-file (classic-concat) content script.
const DEFAULT_SET = ['init', 'content', 'action', 'content-multi-one-entry']

// One target per engine "shape": Safari (MV3 with a background script list),
// a chromium fork, and a gecko fork. Forks get the same coverage as Safari:
// chromium-fork HTML pages and gecko-fork declared backgrounds now build, via
// normalizeBrowserForManifestFields in the develop pipeline.
const ALL_TARGETS = [
  {
    browser: 'safari',
    family: 'webkit',
    note: 'webkit (MV3, background.scripts)'
  },
  {browser: 'brave', family: 'chromium', note: 'chromium fork'},
  {browser: 'waterfox', family: 'gecko', note: 'gecko fork'}
]

// Per-family manifest expectations. A target falling back to the wrong family
// (the bug class this guard exists to catch) trips both the manifest_version and
// the forbidden-background-key assertions. Safari never starts an MV3 service
// worker, so the webkit family keeps MV3 but lists background.scripts instead.
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
  },
  webkit: {
    manifestVersion: 3,
    backgroundKey: 'scripts',
    forbiddenBackgroundKey: 'service_worker'
  }
}

function resolveCli() {
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

  if (fs.existsSync(monorepoCli)) return {kind: 'node', cliPath: monorepoCli}

  return {kind: 'bin'}
}

function projectDir(slug) {
  const exampleDir = path.join(EXAMPLES_DIR, slug)
  const monorepoDir = path.join(exampleDir, 'packages', 'extension')

  return fs.existsSync(monorepoDir) ? monorepoDir : exampleDir
}

// True when the example's own manifest declares a background, under the plain
// key or any browser-prefixed one such as "chromium:background".
function declaresBackground(slug) {
  const manifestPath = path.join(projectDir(slug), 'src', 'manifest.json')

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

    return Object.keys(manifest).some((key) => /(^|:)background$/.test(key))
  } catch {
    return false
  }
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

// Same reason as selectTargets: an empty selection is a broken invocation, not
// a pass.
function assertSelection(examples, targets) {
  if (examples.length > 0 && targets.length > 0) return

  console.error(
    `►►► Nothing to check: ${examples.length} example(s) x ` +
      `${targets.length} target(s).`
  )

  process.exit(1)
}

// "Safari extensions can only be built on macOS", says the CLI, so a webkit
// build on Linux fails in under a second with nothing emitted. Skipping it
// there keeps the other engines gating; asking for it explicitly still fails.
const WEBKIT_BROWSERS = new Set(['safari'])
const canBuildWebkit = process.platform === 'darwin'

function selectTargets() {
  const flag = process.argv.find((a) => a.startsWith('--targets='))

  if (!flag) {
    if (canBuildWebkit) return ALL_TARGETS

    const runnable = ALL_TARGETS.filter((t) => !WEBKIT_BROWSERS.has(t.browser))

    console.log(
      `►►► Skipping ${[...WEBKIT_BROWSERS].join(', ')} on ${process.platform}: ` +
        `Safari extensions can only be built on macOS. ` +
        `${runnable.length} target(s) still checked.`
    )

    return runnable
  }

  const wanted = new Set(
    flag
      .slice('--targets='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )

  const selected = ALL_TARGETS.filter((t) => wanted.has(t.browser))

  const impossible = selected.filter(
    (t) => WEBKIT_BROWSERS.has(t.browser) && !canBuildWebkit
  )

  if (impossible.length > 0) {
    console.error(
      `►►► Cannot build ${impossible.map((t) => t.browser).join(', ')} on ` +
        `${process.platform}: Safari extensions can only be built on macOS.`
    )

    process.exit(1)
  }

  // An unknown name here used to leave an empty list, and the run then printed
  // PASSED for all 0 check(s). A typo must not silently disable the guard.
  if (selected.length === 0) {
    console.error(
      `►►► No target matches --targets=${[...wanted].join(',')}. ` +
        `Known targets: ${ALL_TARGETS.map((t) => t.browser).join(', ')}.`
    )

    process.exit(1)
  }

  return selected
}

function runDev(cli, exampleDir, browser) {
  return new Promise((resolve) => {
    const args = [
      exampleDir,
      '--browser',
      browser,
      '--no-browser',
      '--logs=info'
    ]
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
    const fullArgs =
      cli.kind === 'node' ? [cli.cliPath, 'dev', ...args] : ['dev', ...args]

    const child = spawn(command, fullArgs, {cwd: exampleDir, env})
    let out = ''
    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (out += d.toString()))
    child.on('error', (err) =>
      resolve({out: `${out}\nspawn error: ${err.message}`, code: 1})
    )

    child.on('close', (code) => resolve({out, code}))
    setTimeout(() => child.kill('SIGKILL'), 45000).unref()
  })
}

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

  if (Array.isArray(manifest?.background?.scripts)) {
    manifest.background.scripts.forEach(add)
  }

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
    lower.includes('compiled in ') ||
    lower.includes('compiled with warnings') ||
    lower.includes('ready for development')

  if (!compiledOk) problems.push('build did not report a successful compile')

  const distDir = path.join(projectDir(slug), 'dist', target.browser)
  const manifestPath = path.join(distDir, 'manifest.json')

  if (!fs.existsSync(manifestPath)) {
    problems.push(`dist/${target.browser}/manifest.json was not emitted`)

    return problems
  }

  let manifest

  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    problems.push(
      `dist/${target.browser}/manifest.json is not valid JSON: ${err.message}`
    )

    return problems
  }

  // Engine-family shape — a target that fell back to the wrong family fails here.
  if (manifest.manifest_version !== rules.manifestVersion) {
    problems.push(
      `manifest_version is ${JSON.stringify(manifest.manifest_version)} (expected ${rules.manifestVersion} for the ${target.family} family)`
    )
  }

  // An example with no background of its own still gets a dev-only reload
  // background from the CLI. Its shape is the CLI's choice, not the example's.
  if (manifest.background && declaresBackground(slug)) {
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
      problems.push(
        `manifest references "${ref}" but it was not emitted to disk`
      )
    }
  }

  return problems
}

async function main() {
  const cli = resolveCli()
  const targets = selectTargets()
  const examples = selectExamples()

  assertSelection(examples, targets)

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
        failures.push({
          slug,
          target: target.browser,
          problems: ['example not found']
        })

        console.log(`  ✗ ${slug} — not found`)
        continue
      }

      const buildDir = projectDir(slug)
      fs.rmSync(path.join(buildDir, 'dist', target.browser), {
        recursive: true,
        force: true
      })

      const result = await runDev(cli, buildDir, target.browser)
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
