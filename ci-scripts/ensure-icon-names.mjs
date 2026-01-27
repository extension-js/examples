#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.join(__dirname, '..')
const examplesDir = path.join(repoRoot, 'examples')
const ICON_SIZES = ['16', '32', '48', '64', '128']

function exists(filePath) {
  try {
    fs.accessSync(filePath)
    return true
  } catch {
    return false
  }
}

function listDirs(directory) {
  return fs
    .readdirSync(directory, {withFileTypes: true})
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => path.join(directory, dirent.name))
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, {recursive: true})
}

function findFirstImageInDir(dirPath) {
  if (!exists(dirPath)) return null
  const entries = fs
    .readdirSync(dirPath, {withFileTypes: true})
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(png|svg)$/i.test(name))
    .sort((a, b) => a.localeCompare(b))
  if (!entries.length) return null
  return path.join(dirPath, entries[0])
}

function resolveIconSource(exampleDirectory) {
  return (
    findFirstImageInDir(path.join(exampleDirectory, 'public')) ||
    findFirstImageInDir(path.join(exampleDirectory, 'src', 'images')) ||
    findFirstImageInDir(
      path.join(exampleDirectory, 'packages', 'extension', 'src', 'images')
    )
  )
}

function ensurePublicIcon(exampleDirectory) {
  const publicDir = path.join(exampleDirectory, 'public')
  const iconPng = path.join(publicDir, 'icon.png')
  const iconSvg = path.join(publicDir, 'icon.svg')

  if (exists(iconPng) || exists(iconSvg)) {
    return exists(iconPng) ? iconPng : iconSvg
  }

  const source = resolveIconSource(exampleDirectory)
  if (!source) return null

  ensureDir(publicDir)
  const target = source.endsWith('.svg') ? iconSvg : iconPng
  fs.copyFileSync(source, target)
  return target
}

function resolveManifestRoot(manifestPath) {
  const manifestDir = path.dirname(manifestPath)
  if (path.basename(manifestDir) === 'src') {
    return path.dirname(manifestDir)
  }
  return manifestDir
}

function ensurePublicIconForManifest(manifestPath, sourceIconPath) {
  const manifestRoot = resolveManifestRoot(manifestPath)
  const publicDir = path.join(manifestRoot, 'public')
  ensureDir(publicDir)

  const extension = path.extname(sourceIconPath).toLowerCase()
  const target =
    extension === '.svg'
      ? path.join(publicDir, 'icon.svg')
      : path.join(publicDir, 'icon.png')

  if (!exists(target)) {
    fs.copyFileSync(sourceIconPath, target)
  }

  return `public/${path.basename(target)}`
}

function resolveManifestPaths(exampleDirectory) {
  const manifests = new Set()
  const srcManifest = path.join(exampleDirectory, 'src', 'manifest.json')
  if (exists(srcManifest)) manifests.add(srcManifest)
  const rootManifest = path.join(exampleDirectory, 'manifest.json')
  if (exists(rootManifest)) manifests.add(rootManifest)

  const packagesDir = path.join(exampleDirectory, 'packages')
  if (exists(packagesDir)) {
    const packageDirs = listDirs(packagesDir)
    for (const packageDir of packageDirs) {
      const packageSrcManifest = path.join(packageDir, 'src', 'manifest.json')
      if (exists(packageSrcManifest)) manifests.add(packageSrcManifest)

      const packageRootManifest = path.join(packageDir, 'manifest.json')
      if (exists(packageRootManifest)) manifests.add(packageRootManifest)

      const nestedPackagesDir = path.join(packageDir, 'packages')
      if (exists(nestedPackagesDir)) {
        const nestedPackageDirs = listDirs(nestedPackagesDir)
        for (const nestedPackageDir of nestedPackageDirs) {
          const nestedManifest = path.join(
            nestedPackageDir,
            'src',
            'manifest.json'
          )
          if (exists(nestedManifest)) manifests.add(nestedManifest)
        }
      }
    }
  }

  return Array.from(manifests)
}

function updateManifestIcons(manifestPath, iconRelPath) {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8')
    const json = JSON.parse(raw)
    const iconRecord = Object.fromEntries(
      ICON_SIZES.map((size) => [size, iconRelPath])
    )

    json.icons = iconRecord
    const sections = [
      'action',
      'browser_action',
      'page_action',
      'sidebar_action',
      'chromium:action',
      'firefox:browser_action',
      'chromium:browser_action'
    ]
    for (const key of sections) {
      if (!json[key] || typeof json[key] !== 'object') continue
      json[key].default_icon = iconRecord
    }

    fs.writeFileSync(manifestPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8')
    return true
  } catch {
    return false
  }
}

function normalizeExamples() {
  if (!exists(examplesDir)) {
    console.error(`Examples directory not found: ${examplesDir}`)
    process.exit(1)
  }

  const exampleDirs = listDirs(examplesDir).filter((dir) =>
    exists(path.join(dir, 'package.json'))
  )

  let updatedIcons = 0
  let updatedManifests = 0
  let missing = 0

  for (const exampleDirectory of exampleDirs) {
    const slug = path.basename(exampleDirectory)
    const iconPath = ensurePublicIcon(exampleDirectory)
    if (!iconPath) {
      missing += 1
      continue
    }

    updatedIcons += 1
    const manifestPaths = resolveManifestPaths(exampleDirectory)
    if (manifestPaths.length) {
      for (const manifestPath of manifestPaths) {
        const iconRelPath = ensurePublicIconForManifest(manifestPath, iconPath)
        if (updateManifestIcons(manifestPath, iconRelPath)) {
          updatedManifests += 1
        }
      }
    } else {
      console.warn(`⚠ ${slug}: manifest not found`)
    }
  }

  console.log(
    `\nIcon normalization complete: ${updatedIcons} icons ensured, ${updatedManifests} manifests updated, ${missing} missing.`
  )
}

normalizeExamples()
