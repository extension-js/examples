#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(__filename), '..')
const examplesDir = path.join(repoRoot, 'examples')

const BG_LOG = `console.log('[From the background context] Hello from the background worker/script!')`
const CONTENT_LOG = `console.log('[From the page context] Hello from content_scripts!')`

const PAGE_LABELS = {
  action: 'action popup',
  sidebar: 'sidebar page',
  newtab: 'newtab override',
  sandbox: 'sandbox page',
  options: 'options page',
  devtools: 'devtools page',
  popup: 'action popup'
}

function pageLogFor(dirName) {
  const label = PAGE_LABELS[dirName] || `${dirName} page`
  return `console.log('[From the ${label} context] Hello regular page!')`
}

const GREETING_LINE_RE =
  /^([ \t]*)console\.log\(\s*['"`].*?(\[From the |Hello from |hello from ).*?['"`]\s*\)[ \t]*;?[ \t]*\r?\n?/m

function ensureGreetingLine(filePath, canonical) {
  if (!fs.existsSync(filePath)) return {changed: false, reason: 'missing'}
  const before = fs.readFileSync(filePath, 'utf8')
  let after
  const match = before.match(GREETING_LINE_RE)
  if (match) {
    const indent = match[1] || ''
    after = before.replace(GREETING_LINE_RE, indent + canonical + '\n')
  } else {
    after = before.length === 0 ? canonical + '\n' : canonical + '\n' + before
  }
  if (after !== before) {
    fs.writeFileSync(filePath, after, 'utf8')
    return {changed: true}
  }
  return {changed: false}
}

function findFirstExisting(dir, names) {
  for (const n of names) {
    const p = path.join(dir, n)
    if (fs.existsSync(p)) return p
  }
  return null
}

function listSrcContextDirs(srcDir) {
  if (!fs.existsSync(srcDir)) return []
  return fs
    .readdirSync(srcDir, {withFileTypes: true})
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => n !== 'images' && n !== 'public')
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

const SCRIPT_EXTS = ['scripts.ts', 'scripts.tsx', 'scripts.js', 'scripts.jsx']

function processTemplate(templateDir, templateLabel) {
  const log = (msg) => console.log(`  ${msg}`)
  const audits = []
  const changes = []

  const srcDir = path.join(templateDir, 'src')

  // 1) background
  const bgPath = findFirstExisting(srcDir, ['background.ts', 'background.js'])
  if (bgPath) {
    const r = ensureGreetingLine(bgPath, BG_LOG)
    if (r.changed) changes.push(`bg: ${path.relative(templateDir, bgPath)}`)
  }

  // 2) content scripts + 3) other page scripts
  const contextDirs = listSrcContextDirs(srcDir)
  for (const ctx of contextDirs) {
    const ctxDir = path.join(srcDir, ctx)
    const scriptFile = findFirstExisting(ctxDir, SCRIPT_EXTS)
    if (!scriptFile) continue

    const canonical = ctx === 'content' ? CONTENT_LOG : pageLogFor(ctx)
    const r = ensureGreetingLine(scriptFile, canonical)
    if (r.changed)
      changes.push(`${ctx}: ${path.relative(templateDir, scriptFile)}`)
  }

  // 4 + 5) package.json: strip @extension.js/* deps; set version to 1.0.0
  const pkgPath = path.join(templateDir, 'package.json')
  if (fs.existsSync(pkgPath)) {
    const pkg = readJson(pkgPath)
    let mutated = false
    for (const depKey of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies'
    ]) {
      const block = pkg[depKey]
      if (!block || typeof block !== 'object') continue
      for (const name of Object.keys(block)) {
        if (name.startsWith('@extension.js/')) {
          delete block[name]
          mutated = true
          changes.push(`pkg: removed ${name}`)
        }
      }
    }
    if (pkg.version !== '1.0.0') {
      pkg.version = '1.0.0'
      mutated = true
      changes.push(`pkg: version -> 1.0.0`)
    }
    if (mutated) writeJson(pkgPath, pkg)
  }

  // 5) src/manifest.json: set version to 1.0.0
  const manifestPath = path.join(srcDir, 'manifest.json')
  if (fs.existsSync(manifestPath)) {
    const mf = readJson(manifestPath)
    if (mf.version !== '1.0.0') {
      mf.version = '1.0.0'
      writeJson(manifestPath, mf)
      changes.push(`manifest: version -> 1.0.0`)
    }
  }

  // 6) screenshot.png audit
  const screenshotAtRoot = fs.existsSync(
    path.join(templateDir, 'screenshot.png')
  )
  const screenshotInPublic = fs.existsSync(
    path.join(templateDir, 'public', 'screenshot.png')
  )
  if (!screenshotAtRoot && !screenshotInPublic) {
    audits.push('missing screenshot.png')
  }

  // 7) template.spec.ts audit
  if (!fs.existsSync(path.join(templateDir, 'template.spec.ts'))) {
    audits.push('missing template.spec.ts')
  }

  // 8) "What to expect" video audit. The templates site gives every template a
  // video tab, so a template without one renders an empty player rather than
  // no tab. Two templates are exempt on purpose: nothing they do is visible on
  // screen, so a clip would have to invent a payoff.
  const VIDEO_EXEMPT = new Set(['init', 'special-folders-pages'])
  // Only a top-level slug is a template on the site. A monorepo template is
  // processed again for its inner `packages/extension`, which has no page, no
  // meta file of its own, and so nothing to attach a video to. The label is
  // what distinguishes them: a nested pass carries a path, not a slug.
  const isNestedPackage = templateLabel.includes('/')
  if (!isNestedPackage && !VIDEO_EXEMPT.has(path.basename(templateDir))) {
    let curatedVideo = null
    try {
      const curated = JSON.parse(
        fs.readFileSync(path.join(templateDir, 'template.meta.json'), 'utf8')
      )
      curatedVideo = curated?.video ?? null
    } catch {
      // Ignore
    }
    if (typeof curatedVideo !== 'string' || !curatedVideo) {
      audits.push('missing video in template.meta.json')
    } else if (!/^[A-Za-z0-9_-]{11}$/.test(curatedVideo)) {
      audits.push(`video is not a YouTube id: ${curatedVideo}`)
    }
  }

  if (changes.length || audits.length) {
    console.log(`\n[${templateLabel}]`)
    for (const c of changes) log('CHANGE  ' + c)
    for (const a of audits) log('AUDIT   ' + a)
  }
}

function main() {
  const entries = fs
    .readdirSync(examplesDir, {withFileTypes: true})
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()

  for (const name of entries) {
    const dir = path.join(examplesDir, name)
    processTemplate(dir, name)
  }

  // Special-case the monorepo nested packages
  for (const monorepoSlug of [
    'sidebar-monorepo-turborepo',
    'sidebar-monorepo-nx'
  ]) {
    const monorepoExt = path.join(
      examplesDir,
      monorepoSlug,
      'packages',
      'extension'
    )
    if (fs.existsSync(monorepoExt)) {
      processTemplate(monorepoExt, `${monorepoSlug}/packages/extension`)
    }
  }
}

main()
