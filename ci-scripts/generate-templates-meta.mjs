#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {validateMiniJsonSchema} from './mini-jsonschema.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.join(__dirname, '..')
const examplesDir = path.join(repoRoot, 'examples')
const outFile = path.join(repoRoot, 'templates-meta.json')
const outDtsFile = path.join(repoRoot, 'templates-meta.d.ts')
const artifactsIndexPath = path.join(repoRoot, 'artifacts', 'index.json')
const RELEASE_TAG = process.env.RELEASE_TAG || 'nightly'
const REPO = process.env.GITHUB_REPOSITORY || 'extension-js/examples'
const templatesSchemaPath = path.join(
  repoRoot,
  'schemas',
  'templates',
  'v2',
  'templates-meta.schema.json'
)
const curatedSchemaPath = path.join(
  repoRoot,
  'schemas',
  'templates',
  'v2',
  'template-meta.schema.json'
)

/**
 * Optional curated metadata per template.
 * File: examples/<slug>/template.meta.json
 *
 * Only a small, user-facing subset is allowed here so we don't override inferred
 * structural facts (framework, files, manifest-derived capabilities, etc).
 */
const CURATED_META_FILENAME = 'template.meta.json'
const CURATED_ALLOWED_KEYS = [
  'title',
  'tags',
  'difficulty',
  'timeToFirstSuccessMinutes',
  'firstSteps',
  'useCases',
  'docsUrl'
]

const FALLBACK_ICON_CANDIDATES = [
  ['public', 'logo.png'],
  ['public', 'logo.svg'],
  ['public', 'icon.png'],
  ['public', 'icon.svg'],
  ['public', 'app-icon.png'],
  ['public', 'app-icon.svg'],
  ['src', 'images', 'logo.png'],
  ['src', 'images', 'logo.svg'],
  ['src', 'images', 'icon.png'],
  ['src', 'images', 'icon.svg'],
  ['src', 'images', 'extension.png'],
  ['src', 'images', 'extension.svg']
]

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    // Do nothing
    return null
  }
}

function listDirs(directory) {
  return fs
    .readdirSync(directory, {withFileTypes: true})
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => path.join(directory, dirent.name))
}

function exists(filePath) {
  try {
    fs.accessSync(filePath)
    return true
  } catch {
    // Do nothing
    return false
  }
}

function normalizeStringArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string')
  if (typeof value === 'string')
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  return []
}

function pickCuratedMeta(meta) {
  if (!meta || typeof meta !== 'object') return null
  /** @type {Record<string, any>} */
  const out = {}
  for (const k of CURATED_ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(meta, k)) out[k] = meta[k]
  }
  if (out.tags) out.tags = normalizeStringArray(out.tags)
  if (out.firstSteps) out.firstSteps = normalizeStringArray(out.firstSteps)
  if (out.useCases) out.useCases = normalizeStringArray(out.useCases)
  if (typeof out.title !== 'string') delete out.title
  if (typeof out.docsUrl !== 'string') delete out.docsUrl
  if (
    out.difficulty &&
    !['beginner', 'intermediate', 'advanced'].includes(out.difficulty)
  ) {
    delete out.difficulty
  }
  if (
    out.timeToFirstSuccessMinutes &&
    typeof out.timeToFirstSuccessMinutes !== 'number'
  ) {
    delete out.timeToFirstSuccessMinutes
  }
  return Object.keys(out).length ? out : null
}

function readCuratedTemplateMeta(exampleDirectory) {
  const p = path.join(exampleDirectory, CURATED_META_FILENAME)
  if (!exists(p)) return null
  const meta = readJsonSafe(p)
  // Validate curated file against schema (warn-only).
  try {
    const curatedSchema = readJsonSafe(curatedSchemaPath)
    if (curatedSchema) {
      const errors = validateMiniJsonSchema(curatedSchema, meta)
      if (errors.length) {
        console.warn(
          `[templates-meta] Invalid ${CURATED_META_FILENAME} in ${path.basename(
            exampleDirectory
          )}:`,
          errors.slice(0, 5)
        )
      }
    }
  } catch {
    // ignore schema validation errors
  }
  return pickCuratedMeta(meta)
}

function inferUIContext(manifest) {
  /** @type {string[]} */
  const context = []

  if (!manifest || typeof manifest !== 'object') {
    return context
  }

  if (
    Array.isArray(manifest.content_scripts) &&
    manifest.content_scripts.length > 0
  ) {
    context.push('content')
  }

  // Naming conventions:
  // - Use lowercase ids to match consumer UIs (e.g. extension-templates filters).
  // - Keep parity with `inferSurfaces` where possible.
  if (manifest.chrome_url_overrides && manifest.chrome_url_overrides.newtab) {
    context.push('newtab')
  }

  if (
    manifest.side_panel?.default_path ||
    manifest['chromium:side_panel']?.default_path
  ) {
    context.push('sidebar')
  }

  if (manifest.action || manifest.browser_action || manifest.page_action) {
    context.push('action')
  }

  if (manifest.devtools_page) {
    context.push('devtools')
  }

  if (manifest.options_ui?.page || manifest.options_page) {
    context.push('options')
  }

  if (manifest.background) {
    context.push('background')
  }
  return Array.from(new Set(context))
}

function inferSurfaces(manifest) {
  /** @type {string[]} */
  const surfaces = []
  if (!manifest || typeof manifest !== 'object') {
    return surfaces
  }

  if (
    Array.isArray(manifest.content_scripts) &&
    manifest.content_scripts.length
  )
    surfaces.push('content')
  if (manifest.action || manifest.browser_action || manifest.page_action)
    surfaces.push('action')
  if (manifest.devtools_page) surfaces.push('devtools')
  if (manifest.chrome_url_overrides?.newtab) surfaces.push('newtab')
  if (
    manifest.side_panel?.default_path ||
    manifest['chromium:side_panel']?.default_path
  )
    surfaces.push('sidebar')
  if (manifest.options_ui?.page || manifest.options_page)
    surfaces.push('options')
  if (manifest.background) surfaces.push('background')

  return Array.from(new Set(surfaces))
}

function inferEntrypoints(manifest) {
  /** @type {string[]} */
  const entrypoints = []
  if (!manifest || typeof manifest !== 'object') {
    return entrypoints
  }

  const action =
    manifest.action?.default_popup ||
    manifest.browser_action?.default_popup ||
    manifest.page_action?.default_popup
  if (typeof action === 'string') entrypoints.push(action)

  const newtab = manifest.chrome_url_overrides?.newtab
  if (typeof newtab === 'string') entrypoints.push(newtab)

  const sidebar =
    manifest.side_panel?.default_path ||
    manifest['chromium:side_panel']?.default_path
  if (typeof sidebar === 'string') entrypoints.push(sidebar)

  if (typeof manifest.devtools_page === 'string')
    entrypoints.push(manifest.devtools_page)

  const options = manifest.options_ui?.page || manifest.options_page
  if (typeof options === 'string') entrypoints.push(options)

  const bg = manifest.background
  if (bg) {
    if (typeof bg.service_worker === 'string')
      entrypoints.push(bg.service_worker)
    if (Array.isArray(bg.scripts)) {
      for (const s of bg.scripts) if (typeof s === 'string') entrypoints.push(s)
    }
    if (typeof bg.page === 'string') entrypoints.push(bg.page)
  }

  if (Array.isArray(manifest.content_scripts)) {
    for (const cs of manifest.content_scripts) {
      if (!cs || typeof cs !== 'object') continue
      if (Array.isArray(cs.js))
        for (const s of cs.js) if (typeof s === 'string') entrypoints.push(s)
      if (Array.isArray(cs.css))
        for (const s of cs.css) if (typeof s === 'string') entrypoints.push(s)
    }
  }

  return Array.from(new Set(entrypoints))
}

function inferPermissions(manifest) {
  const permissions = Array.isArray(manifest?.permissions)
    ? manifest.permissions.filter((v) => typeof v === 'string')
    : []
  const host_permissions = Array.isArray(manifest?.host_permissions)
    ? manifest.host_permissions.filter((v) => typeof v === 'string')
    : []
  const optional_permissions = Array.isArray(manifest?.optional_permissions)
    ? manifest.optional_permissions.filter((v) => typeof v === 'string')
    : []
  return {permissions, host_permissions, optional_permissions}
}

function inferSetup(packageJson, exampleDirectory) {
  const scripts =
    packageJson?.scripts && typeof packageJson.scripts === 'object'
      ? packageJson.scripts
      : {}
  /** @type {Record<string, string>} */
  const pickedScripts = {}
  for (const k of ['dev', 'build', 'test', 'lint', 'typecheck']) {
    if (typeof scripts[k] === 'string') pickedScripts[k] = scripts[k]
  }
  const env = {
    hasEnvExample: exists(path.join(exampleDirectory, '.env.example')),
    hasEnv:
      exists(path.join(exampleDirectory, '.env')) ||
      exists(path.join(exampleDirectory, '.env.example'))
  }
  return {
    packageManager: 'pnpm',
    scripts: pickedScripts,
    env
  }
}

function inferFramework(packageJson) {
  const dependencies = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {})
  }

  if (dependencies.react) {
    return 'react'
  }

  if (dependencies.preact) {
    return 'preact'
  }

  if (dependencies.vue) {
    return 'vue'
  }

  if (dependencies.svelte) {
    return 'svelte'
  }
  return ''
}

function inferCss(exampleDirectory) {
  const packageJson = readJsonSafe(path.join(exampleDirectory, 'package.json'))
  const dependencies = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {})
  }

  if (
    dependencies.less ||
    hasAny(exampleDirectory, (filePath) => filePath.endsWith('.less'))
  ) {
    return 'less'
  }

  if (
    dependencies.sass ||
    hasAny(
      exampleDirectory,
      (filePath) => filePath.endsWith('.scss') || filePath.endsWith('.sass')
    )
  ) {
    return 'sass'
  }
  return 'css'
}

function walkFiles(directory, filter) {
  /** @type {string[]} */
  const filePaths = []

  for (const directoryEntry of fs.readdirSync(directory, {
    withFileTypes: true
  })) {
    const fullPath = path.join(directory, directoryEntry.name)

    if (directoryEntry.isDirectory()) {
      if (
        [
          'node_modules',
          'dist',
          '.extension',
          '.next',
          '.turbo',
          'build'
        ].includes(directoryEntry.name)
      ) {
        continue
      }
      filePaths.push(...walkFiles(fullPath, filter))
    } else {
      if (!filter || filter(fullPath)) {
        filePaths.push(fullPath)
      }
    }
  }
  return filePaths
}

function hasAny(directory, predicate) {
  try {
    const files = walkFiles(directory)
    return files.some(predicate)
  } catch {
    // Do nothing
    return false
  }
}

function detectConfigFiles(exampleDirectory) {
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
  return candidates.filter((fileName) =>
    exists(path.join(exampleDirectory, fileName))
  )
}

function detectScreenshot(exampleDirectory) {
  const screenshotCandidates = [
    path.join(exampleDirectory, 'screenshot.png'),
    path.join(exampleDirectory, 'public', 'screenshot.png')
  ]
  const screenshotPath = screenshotCandidates.find((candidatePath) =>
    exists(candidatePath)
  )
  return screenshotPath
    ? path.relative(repoRoot, screenshotPath).replace(/\\/g, '/')
    : null
}

function pickIconPathFromRecord(record) {
  if (!record || typeof record !== 'object') return null

  const sizes = [128, 96, 64, 48, 32, 16]

  for (const size of sizes) {
    const value = record[String(size)]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  for (const value of Object.values(record)) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

function pickIconPath(value) {
  if (!value) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'object') return pickIconPathFromRecord(value)

  return null
}

function getDefaultIconFromSection(manifest, key) {
  const section = manifest?.[key]

  if (!section || typeof section !== 'object') return null

  return pickIconPath(section.default_icon)
}

function pickManifestIconPath(manifest) {
  return (
    pickIconPath(manifest?.icons) ||
    getDefaultIconFromSection(manifest, 'action') ||
    getDefaultIconFromSection(manifest, 'browser_action') ||
    getDefaultIconFromSection(manifest, 'page_action') ||
    getDefaultIconFromSection(manifest, 'sidebar_action') ||
    getDefaultIconFromSection(manifest, 'chromium:action') ||
    getDefaultIconFromSection(manifest, 'firefox:browser_action') ||
    getDefaultIconFromSection(manifest, 'chromium:browser_action')
  )
}

function normalizeRelativePath(input) {
  return String(input || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/^\.\/+/, '')
}

function resolveManifestIconFile(exampleDirectory, iconPath) {
  if (!iconPath || typeof iconPath !== 'string') return null
  if (iconPath.startsWith('data:') || iconPath.startsWith('http')) return null

  const cleaned = normalizeRelativePath(iconPath)
  const directCandidate = path.join(exampleDirectory, cleaned)

  if (exists(directCandidate)) return directCandidate

  const srcCandidate = path.join(exampleDirectory, 'src', cleaned)

  if (exists(srcCandidate)) return srcCandidate
  return null
}

function resolveFallbackIconFile(exampleDirectory, slug) {
  for (const candidate of FALLBACK_ICON_CANDIDATES) {
    const filePath = path.join(exampleDirectory, ...candidate)
    
    if (exists(filePath)) return filePath
  }

  const slugCandidates = [
    path.join(exampleDirectory, 'public', `${slug}.png`),
    path.join(exampleDirectory, 'public', `${slug}.svg`),
    path.join(exampleDirectory, 'src', 'images', `${slug}.png`),
    path.join(exampleDirectory, 'src', 'images', `${slug}.svg`)
  ]

  for (const filePath of slugCandidates) {
    if (exists(filePath)) return filePath
  }

  return null
}

function detectTemplateIcon(exampleDirectory, manifest) {
  const iconPath = pickManifestIconPath(manifest || {})
  if (iconPath) {
    const resolved = resolveManifestIconFile(exampleDirectory, iconPath)
    if (resolved) return path.relative(repoRoot, resolved).replace(/\\/g, '/')
  }

  const slug = path.basename(exampleDirectory)
  const fallback = resolveFallbackIconFile(exampleDirectory, slug)

  if (!fallback) return null

  return path.relative(repoRoot, fallback).replace(/\\/g, '/')
}

function getGitCommit() {
  try {
    const gitResult = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8'
    })

    if (gitResult.status === 0) {
      return gitResult.stdout.trim()
    }
  } catch {
    // Do nothing
  }
  return 'local'
}

function collectFiles(exampleDirectory) {
  const relativePath = (filePath) =>
    path.relative(exampleDirectory, filePath).replace(/\\/g, '/')
  const files = walkFiles(
    exampleDirectory,
    (filePath) => !/node_modules|dist|\.extension|e2e-report/.test(filePath)
  )
  return files
    .filter(
      (filePath) =>
        /(^|\/)src\//.test(filePath) ||
        filePath.endsWith('/manifest.json') ||
        filePath.endsWith('extension.config.js') ||
        /(^|\/)public\//.test(filePath)
    )
    .map(relativePath)
    .slice(0, 500)
}

function buildTemplateEntry(exampleDirectory) {
  const slug = path.basename(exampleDirectory)
  const packageJson =
    readJsonSafe(path.join(exampleDirectory, 'package.json')) || {}
  const manifest =
    readJsonSafe(path.join(exampleDirectory, 'src', 'manifest.json')) ||
    readJsonSafe(path.join(exampleDirectory, 'manifest.json')) ||
    {}

  const curated = readCuratedTemplateMeta(exampleDirectory)
  const {permissions, host_permissions, optional_permissions} =
    inferPermissions(manifest)

  const templateEntry = {
    slug,
    name: packageJson.name || slug,
    title: curated?.title,
    version: packageJson.version || '0.0.1',
    manifest_version: Number(manifest.manifest_version || 3),
    description: manifest.description || packageJson.description || '',
    uiContext: inferUIContext(manifest),
    surfaces: inferSurfaces(manifest),
    entrypoints: inferEntrypoints(manifest),
    uiFramework: inferFramework(packageJson),
    css: inferCss(exampleDirectory),
    configFiles: detectConfigFiles(exampleDirectory),
    hasBackground: Boolean(manifest.background),
    hasEnv:
      exists(path.join(exampleDirectory, '.env')) ||
      exists(path.join(exampleDirectory, '.env.example')),
    setup: inferSetup(packageJson, exampleDirectory),
    permissions,
    host_permissions,
    optional_permissions,
    tags: curated?.tags,
    difficulty: curated?.difficulty,
    timeToFirstSuccessMinutes: curated?.timeToFirstSuccessMinutes,
    firstSteps: curated?.firstSteps,
    useCases: curated?.useCases,
    docsUrl: curated?.docsUrl,
    files: collectFiles(exampleDirectory),
    browsers: ['chrome', 'edge', 'firefox'],
    screenshot: detectScreenshot(exampleDirectory),
    icon: detectTemplateIcon(exampleDirectory, manifest)
  }

  try {
    const artifactsIndex = readJsonSafe(artifactsIndexPath)
    const browserRecord = artifactsIndex?.[slug]

    if (browserRecord && typeof browserRecord === 'object') {
      const baseUrl = `https://github.com/${REPO}/releases/download/${RELEASE_TAG}`
      const downloads = {}
      const integrity = {}

      for (const [browser, browserMetadata] of Object.entries(browserRecord)) {
        downloads[browser] = `${baseUrl}/${browserMetadata.file}`
        integrity[browser] = {
          sha256: browserMetadata.sha256,
          size: browserMetadata.size
        }
      }
      return {...templateEntry, downloads, integrity}
    }
  } catch {
    // Do nothing
  }

  return templateEntry
}

function main() {
  if (!exists(examplesDir)) {
    console.error(`►►► Examples directory not found: ${examplesDir}`)
    process.exit(1)
  }

  const exampleDirectories = listDirs(examplesDir).filter((directory) =>
    exists(path.join(directory, 'package.json'))
  )
  const templates = exampleDirectories.map(buildTemplateEntry)

  const templatesMetadata = {
    version: '2',
    sourceRepo: 'extension-js/examples',
    generatorVersion: '2',
    commit: getGitCommit(),
    generatedAt: new Date().toISOString(),
    templates
  }

  // Validate output against schema (hard fail in CI, warn locally).
  try {
    const schema = readJsonSafe(templatesSchemaPath)
    if (schema) {
      const errors = validateMiniJsonSchema(schema, templatesMetadata)
      if (errors.length) {
        const msg = `[templates-meta] Output does not match schema: ${JSON.stringify(
          errors.slice(0, 10),
          null,
          2
        )}`
        if (process.env.CI) {
          console.error(msg)
          process.exit(1)
        } else {
          console.warn(msg)
        }
      }
    } else {
      console.warn('[templates-meta] Schema not found; skipping validation')
    }
  } catch (err) {
    if (process.env.CI) throw err
  }

  fs.writeFileSync(
    outFile,
    JSON.stringify(templatesMetadata, null, 2) + '\n',
    'utf8'
  )
  console.log(`►►► Wrote ${outFile} with ${templates.length} templates.`)

  // Keep a stable TypeScript declaration file in sync with the JSON output.
  // This is included in package.json "files" and is consumed by external tools
  // that import `templates-meta.json` with type support.
  const dts = `/**
 * AUTO-GENERATED FILE. DO NOT EDIT.
 *
 * Generated by: ci-scripts/generate-templates-meta.mjs
 *
 * This file provides a stable TypeScript surface for consumers that import
 * \`templates-meta.json\`.
 */

export type TemplateDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface TemplateIntegrity {
  sha256: string
  size: number
}

export interface TemplateSetup {
  packageManager: 'pnpm'
  scripts: Record<string, string>
  env: {
    hasEnvExample: boolean
    hasEnv: boolean
  }
}

export interface TemplateMeta {
  slug: string
  name: string
  title?: string
  version: string
  manifest_version: number
  description: string
  uiContext: string[]
  surfaces: string[]
  entrypoints: string[]
  uiFramework: string
  css: string
  configFiles: string[]
  hasBackground: boolean
  hasEnv: boolean
  setup: TemplateSetup
  permissions: string[]
  host_permissions: string[]
  optional_permissions: string[]
  tags?: string[]
  difficulty?: TemplateDifficulty
  timeToFirstSuccessMinutes?: number
  firstSteps?: string[]
  useCases?: string[]
  docsUrl?: string
  files: string[]
  browsers: string[]
  screenshot: string | null
  icon: string | null
  downloads?: Record<string, string>
  integrity?: Record<string, TemplateIntegrity>
  repositoryUrl?: string
}

export interface TemplatesMetaV2 {
  version: '2'
  sourceRepo: string
  generatorVersion: string
  commit: string
  generatedAt: string
  templates: TemplateMeta[]
}

declare const templatesMeta: TemplatesMetaV2
export default templatesMeta
`

  fs.writeFileSync(outDtsFile, dts, 'utf8')
  console.log(`►►► Wrote ${outDtsFile}`)
}

main()
