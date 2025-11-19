#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import crypto from 'node:crypto'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const examplesDir = path.join(repoRoot, 'examples')
const outDir = path.join(repoRoot, 'artifacts')
fs.mkdirSync(outDir, {recursive: true})

function sha256(file) {
  const h = crypto.createHash('sha256')
  h.update(fs.readFileSync(file))
  return h.digest('hex')
}

function zipDir(srcDir, outFile) {
  const r = spawnSync('zip', ['-r', '-q', outFile, '.'], {cwd: srcDir, stdio: 'inherit'})
  if (r.status !== 0) process.exit(r.status)
}

/** @type {Record<string, Record<string, {file: string, size: number, sha256: string}>>} */
const index = {}
for (const slug of fs.readdirSync(examplesDir)) {
  const dir = path.join(examplesDir, slug)
  if (!fs.statSync(dir).isDirectory()) continue
  const browsers = ['chrome', 'edge', 'firefox']
  for (const b of browsers) {
    const buildDir = path.join(dir, 'dist', b)
    if (!fs.existsSync(buildDir)) continue
    const zipName = `${slug}.${b}.zip`
    const zipPath = path.join(outDir, zipName)
    zipDir(buildDir, zipPath)
    const size = fs.statSync(zipPath).size
    const hash = sha256(zipPath)
    index[slug] ??= {}
    index[slug][b] = { file: zipName, size, sha256: hash }
    console.log(`Packaged ${slug} (${b}) -> ${zipName}`)
  }
}
const indexPath = path.join(outDir, 'index.json')
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2))
console.log(`Wrote ${indexPath} (${Object.keys(index).length} templates)`)


