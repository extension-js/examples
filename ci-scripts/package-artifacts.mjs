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

/** @type {Record<string, Record<string, {file: string, size: number, sha256: string}>>} */
const artifactsIndex = {}

for (const slug of fs.readdirSync(examplesDir)) {
  const exampleDirectory = path.join(examplesDir, slug)

  if (!fs.statSync(exampleDirectory).isDirectory()) {
    continue
  }
  const browsers = ['chrome', 'edge', 'firefox']

  for (const browser of browsers) {
    const buildDirectory = path.join(exampleDirectory, 'dist', browser)

    if (!fs.existsSync(buildDirectory)) {
      continue
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
