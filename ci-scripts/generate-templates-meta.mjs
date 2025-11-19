#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.join(__dirname, '..')
const examplesDir = path.join(repoRoot, 'examples')
const outFile = path.join(repoRoot, 'templates-meta.json')
const artifactsIndexPath = path.join(repoRoot, 'artifacts', 'index.json')
const RELEASE_TAG = process.env.RELEASE_TAG || 'nightly'
const REPO = process.env.GITHUB_REPOSITORY || 'extension-js/examples'

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function listDirs(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(dir, d.name))
}

function exists(p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

function inferUIContext(manifest) {
  /** @type {string[]} */
  const ctx = []
  if (!manifest || typeof manifest !== 'object') return ctx
  if (Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0) ctx.push('content')
  if (manifest.chrome_url_overrides && manifest.chrome_url_overrides.newtab) ctx.push('newTab')
  if (manifest.side_panel?.default_path || manifest['chromium:side_panel']?.default_path) ctx.push('sidebar')
  if (manifest.action || manifest.browser_action || manifest.page_action) ctx.push('action')
  if (manifest.devtools_page) ctx.push('devTools')
  return Array.from(new Set(ctx))
}

function inferFramework(pkg) {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
  if (deps.react) return 'react'
  if (deps.preact) return 'preact'
  if (deps.vue) return 'vue'
  if (deps.svelte) return 'svelte'
  return ''
}

function inferCss(exampleDir) {
  const pkg = readJsonSafe(path.join(exampleDir, 'package.json'))
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
  if (deps.less || hasAny(exampleDir, (f) => f.endsWith('.less'))) return 'less'
  if (deps.sass || hasAny(exampleDir, (f) => f.endsWith('.scss') || f.endsWith('.sass'))) return 'sass'
  return 'css'
}

function walkFiles(dir, filter) {
  /** @type {string[]} */
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.extension', '.next', '.turbo', 'build'].includes(entry.name)) continue
      out.push(...walkFiles(full, filter))
    } else {
      if (!filter || filter(full)) out.push(full)
    }
  }
  return out
}

function hasAny(dir, predicate) {
  try {
    const files = walkFiles(dir)
    return files.some(predicate)
  } catch {
    return false
  }
}

function detectConfigFiles(exampleDir) {
  const candidates = [
    'postcss.config.js',
    'tailwind.config.js',
    'tsconfig.json',
    '.stylelintrc.json',
    'extension.config.js',
    'babel.config.json',
    '.prettierrc',
    'eslint.config.mjs'
  ]
  return candidates.filter((f) => exists(path.join(exampleDir, f)))
}

function detectScreenshot(exampleDir) {
  const candidates = [
    path.join(exampleDir, 'screenshot.png'),
    path.join(exampleDir, 'public', 'screenshot.png')
  ]
  const found = candidates.find((p) => exists(p))
  return found ? path.relative(repoRoot, found).replace(/\\/g, '/') : null
}

function getGitCommit() {
  try {
    const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' })
    if (r.status === 0) return r.stdout.trim()
  } catch {}
  return 'local'
}

function collectFiles(exampleDir) {
  const rel = (p) => path.relative(exampleDir, p).replace(/\\/g, '/')
  const files = walkFiles(exampleDir, (f) => !/node_modules|dist|\.extension|e2e-report/.test(f))
  return files
    .filter(
      (f) =>
        /(^|\/)src\//.test(f) ||
        f.endsWith('/manifest.json') ||
        f.endsWith('extension.config.js') ||
        /(^|\/)public\//.test(f)
    )
    .map(rel)
    .slice(0, 500)
}

function buildTemplateEntry(exampleDir) {
  const slug = path.basename(exampleDir)
  const pkg = readJsonSafe(path.join(exampleDir, 'package.json')) || {}
  const manifest =
    readJsonSafe(path.join(exampleDir, 'src', 'manifest.json')) ||
    readJsonSafe(path.join(exampleDir, 'manifest.json')) ||
    {}

  const entry = {
    slug,
    name: pkg.name || slug,
    version: pkg.version || '0.0.1',
    manifest_version: Number(manifest.manifest_version || 3),
    description: manifest.description || pkg.description || '',
    uiContext: inferUIContext(manifest),
    uiFramework: inferFramework(pkg),
    css: inferCss(exampleDir),
    configFiles: detectConfigFiles(exampleDir),
    hasBackground: Boolean(manifest.background),
    hasEnv: exists(path.join(exampleDir, '.env')) || exists(path.join(exampleDir, '.env.example')),
    files: collectFiles(exampleDir),
    browsers: ['chrome', 'edge', 'firefox'],
    screenshot: detectScreenshot(exampleDir)
  }

  try {
    const idx = readJsonSafe(artifactsIndexPath)
    const rec = idx?.[slug]
    if (rec && typeof rec === 'object') {
      const base = `https://github.com/${REPO}/releases/download/${RELEASE_TAG}`
      const downloads = {}
      const integrity = {}
      for (const [browser, meta] of Object.entries(rec)) {
        downloads[browser] = `${base}/${meta.file}`
        integrity[browser] = { sha256: meta.sha256, size: meta.size }
      }
      return { ...entry, downloads, integrity }
    }
  } catch {}

  return entry
}

function main() {
  if (!exists(examplesDir)) {
    console.error(`Examples directory not found: ${examplesDir}`)
    process.exit(1)
  }

  const dirs = listDirs(examplesDir).filter((d) => exists(path.join(d, 'package.json')))
  const templates = dirs.map(buildTemplateEntry)

  const meta = {
    version: '1',
    sourceRepo: 'extension-js/examples',
    generatorVersion: '1',
    commit: getGitCommit(),
    generatedAt: new Date().toISOString(),
    templates
  }

  fs.writeFileSync(outFile, JSON.stringify(meta, null, 2) + '\n', 'utf8')
  console.log(`Wrote ${outFile} with ${templates.length} templates.`)
}

main()


