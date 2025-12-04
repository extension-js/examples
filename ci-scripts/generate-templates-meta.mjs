#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.join(__dirname, '..')
const examplesDir = path.join(repoRoot, 'examples')
const outFile = path.join(repoRoot, 'templates-meta.json')
const artifactsIndexPath = path.join(repoRoot, 'artifacts', 'index.json')
const RELEASE_TAG = process.env.RELEASE_TAG || 'nightly'
const REPO = process.env.GITHUB_REPOSITORY || 'extension-js/examples'

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

  if (manifest.chrome_url_overrides && manifest.chrome_url_overrides.newtab) {
    context.push('newTab')
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
    context.push('devTools')
  }
  return Array.from(new Set(context))
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

  const templateEntry = {
    slug,
    name: packageJson.name || slug,
    version: packageJson.version || '0.0.1',
    manifest_version: Number(manifest.manifest_version || 3),
    description: manifest.description || packageJson.description || '',
    uiContext: inferUIContext(manifest),
    uiFramework: inferFramework(packageJson),
    css: inferCss(exampleDirectory),
    configFiles: detectConfigFiles(exampleDirectory),
    hasBackground: Boolean(manifest.background),
    hasEnv:
      exists(path.join(exampleDirectory, '.env')) ||
      exists(path.join(exampleDirectory, '.env.example')),
    files: collectFiles(exampleDirectory),
    browsers: ['chrome', 'edge', 'firefox'],
    screenshot: detectScreenshot(exampleDirectory)
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
    version: '1',
    sourceRepo: 'extension-js/examples',
    generatorVersion: '1',
    commit: getGitCommit(),
    generatedAt: new Date().toISOString(),
    templates
  }

  fs.writeFileSync(
    outFile,
    JSON.stringify(templatesMetadata, null, 2) + '\n',
    'utf8'
  )
  console.log(`►►► Wrote ${outFile} with ${templates.length} templates.`)
}

main()
