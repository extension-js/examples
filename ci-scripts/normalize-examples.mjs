import fs from 'fs'
import path from 'path'
import {spawnSync} from 'child_process'

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
)
const examplesDir = path.join(repoRoot, 'examples')

function walk(directory, filterFunction) {
  /** @type {string[]} */
  const filePaths = []
  const directoryEntries = fs.readdirSync(directory, {withFileTypes: true})

  for (const directoryEntry of directoryEntries) {
    const fullPath = path.join(directory, directoryEntry.name)

    if (directoryEntry.isDirectory()) {
      // Skip dependency/build directories

      if (
        directoryEntry.name === 'node_modules' ||
        directoryEntry.name === 'dist' ||
        directoryEntry.name === '.next' ||
        directoryEntry.name === 'build' ||
        directoryEntry.name === '.turbo'
      ) {
        continue
      }
      filePaths.push(...walk(fullPath, filterFunction))
    } else if (!filterFunction || filterFunction(fullPath)) {
      filePaths.push(fullPath)
    }
  }
  return filePaths
}

function readJson(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(fileContent)
}

function writeJson(filePath, object) {
  const content = JSON.stringify(object, null, 2) + '\n'
  fs.writeFileSync(filePath, content, 'utf8')
}

function toPackageName(relativeDirectory) {
  // Convert path under examples to a single segment name (hyphenated)
  const namePart = relativeDirectory.split(path.sep).filter(Boolean).join('-')
  return `@extension-js/${namePart}`
}

function normalizePackageJsons() {
  const packageJsonFiles = walk(examplesDir, (filePath) => {
    if (!filePath.endsWith('package.json')) {
      return false
    }

    // Extra guard: never touch package.json inside node_modules
    return !filePath.split(path.sep).includes('node_modules')
  })

  for (const filePath of packageJsonFiles) {
    const packageJson = readJson(filePath)

    // Compute name based on directory under examples
    const packageDirectory = path.dirname(filePath)
    const relativePath = path.relative(examplesDir, packageDirectory)
    const desiredName = toPackageName(relativePath)

    packageJson.name = desiredName

    // Remove engines

    if (packageJson.engines) {
      delete packageJson.engines
    }

    writeJson(filePath, packageJson)
  }

  return packageJsonFiles
}

function normalizeManifests() {
  const manifestFiles = walk(examplesDir, (filePath) =>
    filePath.endsWith('manifest.json')
  )

  for (const filePath of manifestFiles) {
    try {
      const manifest = readJson(filePath)
      // Don't override the name - preserve original manifest names
      // manifest.name = computeManifestName(filePath)
      writeJson(filePath, manifest)
    } catch {
      // Do nothing
    }
  }

  return manifestFiles
}

function main() {
  const packageJsonFiles = normalizePackageJsons()
  const manifestFiles = normalizeManifests()

  // Format all files in one call instead of two separate calls
  const allFilesToFormat = [...packageJsonFiles, ...manifestFiles]
  if (allFilesToFormat.length > 0) {
    try {
      spawnSync('pnpm', ['prettier', '--write', ...allFilesToFormat], {
        stdio: 'inherit',
        cwd: repoRoot
      })
    } catch {
      // Do nothing
    }
  }

  console.log('►►► Normalization completed.')
}

main()
