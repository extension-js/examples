import fs from 'fs'
import path from 'path'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const examplesDir = path.join(repoRoot, 'examples')

function walk(dir, filterFn) {
  /** @type {string[]} */
  const results = []
  const entries = fs.readdirSync(dir, {withFileTypes: true})
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walk(full, filterFn))
    } else if (!filterFn || filterFn(full)) {
      results.push(full)
    }
  }
  return results
}

function readJson(file) {
  const txt = fs.readFileSync(file, 'utf8')
  return JSON.parse(txt)
}

function writeJson(file, obj) {
  const content = JSON.stringify(obj, null, 2) + '\n'
  fs.writeFileSync(file, content, 'utf8')
}

function toPackageName(relDir) {
  // Convert path under examples to a single segment name (hyphenated)
  const namePart = relDir.split(path.sep).filter(Boolean).join('-')
  return `@extension-js/${namePart}`
}

function normalizePackageJsons() {
  const pkgFiles = walk(examplesDir, (f) => f.endsWith('package.json'))
  for (const file of pkgFiles) {
    const pkg = readJson(file)

    // Compute name based on directory under examples
    const pkgDir = path.dirname(file)
    const rel = path.relative(examplesDir, pkgDir)
    const desiredName = toPackageName(rel)

    pkg.name = desiredName

    // Scripts normalization
    pkg.scripts = {
      build: 'extension build',
      'build:edge': 'extension build --browser=edge',
      'build:firefox': 'extension build --browser=firefox'
    }

    // Remove engines
    if (pkg.engines) delete pkg.engines

    writeJson(file, pkg)
  }
}

function computeManifestName(manifestPath) {
  const dir = path.dirname(manifestPath)
  const base = path.basename(dir)
  const exampleDir = base === 'src' ? path.dirname(dir) : dir
  const rel = path.relative(examplesDir, exampleDir).split(path.sep).join('/')
  return `Extension.js - ${rel} Example`
}

function normalizeManifests() {
  const manifestFiles = walk(examplesDir, (f) => f.endsWith('manifest.json'))
  for (const file of manifestFiles) {
    try {
      const manifest = readJson(file)
      manifest.name = computeManifestName(file)
      writeJson(file, manifest)
    } catch (e) {
      // skip invalid json
    }
  }
}

function main() {
  normalizePackageJsons()
  normalizeManifests()
  console.log('Normalization completed.')
}

main()
