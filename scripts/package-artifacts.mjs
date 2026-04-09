#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import crypto from 'node:crypto'

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
)
const examplesDir = path.join(repoRoot, 'examples')
const outDir = path.join(repoRoot, 'artifacts')
fs.mkdirSync(outDir, {recursive: true})

function sha256(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function zipDir(sourceDirectory, outputFile) {
  const zipResult = spawnSync('zip', ['-r', '-q', outputFile, '.'], {
    cwd: sourceDirectory,
    stdio: 'inherit'
  })
  if (zipResult.status !== 0) {
    process.exit(zipResult.status)
  }
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function resolveSourceManifest(exampleDirectory) {
  const srcManifest = path.join(exampleDirectory, 'src', 'manifest.json')
  if (fs.existsSync(srcManifest)) return srcManifest
  const monorepoManifest = path.join(
    exampleDirectory,
    'packages',
    'extension',
    'src',
    'manifest.json'
  )
  if (fs.existsSync(monorepoManifest)) return monorepoManifest
  const rootManifest = path.join(exampleDirectory, 'manifest.json')
  if (fs.existsSync(rootManifest)) return rootManifest
  return null
}

/** @type {Record<string, Record<string, {file: string, size: number, sha256: string}>>} */
const artifactsIndex = {}

for (const slug of fs.readdirSync(examplesDir)) {
  const exampleDirectory = path.join(examplesDir, slug)

  if (!fs.statSync(exampleDirectory).isDirectory()) {
    continue
  }
  const sourceManifestPath = resolveSourceManifest(exampleDirectory)
  const sourceManifest = sourceManifestPath
    ? readJsonSafe(sourceManifestPath)
    : null
  const browsers = ['chrome', 'edge', 'firefox']

  for (const browser of browsers) {
    const buildDirectory = path.join(exampleDirectory, 'dist', browser)

    if (!fs.existsSync(buildDirectory)) {
      continue
    }
    if (!sourceManifest) {
      throw new Error(
        `►►► Missing source manifest.json for ${slug}; cannot validate artifacts.`
      )
    }
    const builtManifestPath = path.join(buildDirectory, 'manifest.json')
    if (!fs.existsSync(builtManifestPath)) {
      throw new Error(
        `►►► Missing built manifest.json for ${slug} (${browser}).`
      )
    }
    const builtManifest = readJsonSafe(builtManifestPath)
    if (!builtManifest) {
      throw new Error(
        `►►► Invalid built manifest.json for ${slug} (${browser}).`
      )
    }
    if (
      sourceManifest.name !== builtManifest.name ||
      sourceManifest.description !== builtManifest.description
    ) {
      throw new Error(
        `►►► Build manifest mismatch for ${slug} (${browser}). ` +
          `Expected "${sourceManifest.name}" but got "${builtManifest.name}".`
      )
    }

    const zipFileName = `${slug}.${browser}.zip`
    const zipFilePath = path.join(outDir, zipFileName)
    zipDir(buildDirectory, zipFilePath)
    const fileSize = fs.statSync(zipFilePath).size
    const fileHash = sha256(zipFilePath)
    artifactsIndex[slug] ??= {}
    artifactsIndex[slug][browser] = {
      file: zipFileName,
      size: fileSize,
      sha256: fileHash
    }
    console.log(`►►► Packaged ${slug} (${browser}) -> ${zipFileName}`)
  }
}
const indexPath = path.join(outDir, 'index.json')
fs.writeFileSync(indexPath, JSON.stringify(artifactsIndex, null, 2))
console.log(
  `►►► Wrote ${indexPath} (${Object.keys(artifactsIndex).length} templates)`
)
