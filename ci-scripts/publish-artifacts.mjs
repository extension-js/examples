#!/usr/bin/env node

/**
 * Stages artifacts inside the current repository so the website can consume:
 * - Copies example sources/public to public/<slug>/
 * - Copies packaged dist zips to public/<slug>/dist/<browser>/<slug>-<version>.zip
 * - Duplicates Firefox zip to .xpi for convenience
 * - Rewrites templates-meta.json to point to public/<slug>/... paths and adds repositoryUrl
 *
 * Run after:
 * - pnpm run build:examples
 * - node ci-scripts/package-artifacts.mjs
 * - pnpm run generate  (writes templates-meta.json)
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(path.join(__dirname, '..'))
const EXAMPLES_DIR = path.join(REPO_ROOT, 'examples')
const ARTIFACTS_DIR = path.join(REPO_ROOT, 'artifacts') // produced by package-artifacts.mjs
const OUT_PUBLIC = path.join(REPO_ROOT, 'public') // committed to repo root
const META_PATH = path.join(REPO_ROOT, 'templates-meta.json')

function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, {recursive: true})
}

function cp(sourcePath, destinationPath) {
  ensureDir(path.dirname(destinationPath))
  fs.cpSync(sourcePath, destinationPath, {recursive: true})
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJSON(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

function listSlugs(directory) {
  return fs
    .readdirSync(directory, {withFileTypes: true})
    .filter(
      (dirent) =>
        dirent.isDirectory() &&
        fs.existsSync(path.join(directory, dirent.name, 'package.json'))
    )
    .map((dirent) => dirent.name)
}

function main() {
  if (!fs.existsSync(META_PATH)) {
    console.error(
      '►►► templates-meta.json not found. Run "pnpm run generate" first.'
    )
    process.exit(1)
  }
  const templatesMetadata = readJSON(META_PATH)
  // Ensure website references live branch instead of a detached SHA
  templatesMetadata.commit = 'main'
  const slugs = listSlugs(EXAMPLES_DIR)

  for (const slug of slugs) {
    const templateDirectory = path.join(EXAMPLES_DIR, slug)
    const packageJsonPath = path.join(templateDirectory, 'package.json')

    if (!fs.existsSync(packageJsonPath)) {
      continue
    }
    const packageJson = readJSON(packageJsonPath)
    const version = packageJson.version || '0.0.1'

    const destinationBase = path.join(OUT_PUBLIC, slug)

    // Copy sources and public assets
    const sourceDirectory = path.join(templateDirectory, 'src')

    if (fs.existsSync(sourceDirectory)) {
      cp(sourceDirectory, path.join(destinationBase, 'src'))
    }
    const publicDirectory = path.join(templateDirectory, 'public')

    if (fs.existsSync(publicDirectory)) {
      cp(publicDirectory, path.join(destinationBase, 'public'))
    }

    // Normalize screenshot to public/<slug>/screenshot.png if available
    const screenshotCandidates = [
      path.join(templateDirectory, 'public', 'screenshot.png'),
      path.join(templateDirectory, 'screenshot.png')
    ]
    const screenshotPath = screenshotCandidates.find((candidatePath) =>
      fs.existsSync(candidatePath)
    )

    if (screenshotPath) {
      cp(screenshotPath, path.join(destinationBase, 'screenshot.png'))
    }

    // Bring packaged distributions (created by package-artifacts.mjs)
    const browsers = ['chrome', 'edge', 'firefox']

    for (const browser of browsers) {
      const zipSourcePath = path.join(ARTIFACTS_DIR, `${slug}.${browser}.zip`)

      if (!fs.existsSync(zipSourcePath)) {
        continue
      }
      const distributionDirectory = path.join(destinationBase, 'dist', browser)
      ensureDir(distributionDirectory)
      const baseFileName = `${slug}-${version}`
      fs.copyFileSync(
        zipSourcePath,
        path.join(distributionDirectory, `${baseFileName}.zip`)
      )

      if (browser === 'firefox') {
        // Duplicate as .xpi for website preview command convenience
        fs.copyFileSync(
          zipSourcePath,
          path.join(distributionDirectory, `${baseFileName}.xpi`)
        )
      }
    }
  }

  // Rewrite metadata paths to committed layout under public/<slug>/...
  const normalizeTemplatePath = (slug, filePath) => {
    if (!filePath) return filePath

    let clean = String(filePath)
      .replace(/^\/+/, '')
      .replace(/^\.\/+/, '')

    if (clean.startsWith(`public/${slug}/`)) return clean

    if (clean.startsWith(`examples/${slug}/`)) {
      clean = clean.replace(`examples/${slug}/`, '')
    }

    if (clean.startsWith(`${slug}/`)) {
      clean = clean.replace(`${slug}/`, '')
    }

    return `public/${slug}/${clean}`
  }

  templatesMetadata.templates = (templatesMetadata.templates || []).map(
    (template) => {
      const slug = template.slug
      return {
        ...template,
        screenshot: `public/${slug}/screenshot.png`,
        icon: template.icon ? normalizeTemplatePath(slug, template.icon) : null,
        files: (template.files || []).map((filePath) =>
          normalizeTemplatePath(slug, filePath)
        ),
        repositoryUrl: `https://github.com/extension-js/examples/tree/main/examples/${slug}`
      }
    }
  )

  writeJSON(META_PATH, templatesMetadata)

  // Optional formatting (ignore failures)
  try {
    spawnSync('pnpm', ['prettier', '--write', 'templates-meta.json'], {
      stdio: 'inherit'
    })
  } catch {
    // Do nothing
  }
}

main()
