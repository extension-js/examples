import {test, expect} from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

function getDirname(url: string) {
  return path.dirname(new URL(url).pathname)
}

function readTemplatesMeta(): Array<{slug: string}> {
  const examplesDir = getDirname(import.meta.url)
  const metaPath = path.resolve(examplesDir, '../templates-meta.json')
  const json = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  return Array.isArray(json?.templates) ? json.templates : []
}

function findBuiltDir(exampleAbs: string): string | null {
  const roots = ['dist', 'build', '.extension']
  const channels = ['chrome', 'chromium', 'chrome-mv3']
  const hasManifest = (dir: string) => {
    try {
      return fs.existsSync(path.join(dir, 'manifest.json'))
    } catch {
      return false
    }
  }

  for (const root of roots) {
    for (const ch of channels) {
      const candidate = path.join(exampleAbs, root, ch)
      if (hasManifest(candidate)) return candidate
    }
  }

  // Shallow scan under known roots for any folder with manifest.json
  for (const root of roots) {
    const rootPath = path.join(exampleAbs, root)

    try {
      const entries = fs.readdirSync(rootPath, {withFileTypes: true})
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const dir = path.join(rootPath, entry.name)
        if (hasManifest(dir)) return dir
      }
    } catch (error) {
      console.error(`Error reading directory ${rootPath}:`, error)
    }
  }
  console.error(`No built directory found for ${exampleAbs}`)
  return null
}

function buildExample(exampleAbs: string) {
  const examplesDir = getDirname(import.meta.url)
  const repoRoot = path.resolve(examplesDir, '..')
  const scriptAbs = path.join(repoRoot, 'ci-scripts', 'build-with-manifest.mjs')
  const result = spawnSync('node', [scriptAbs, 'build', '--browser=chrome'], {
    cwd: exampleAbs,
    stdio: 'inherit',
    env: {
      ...process.env
    }
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `Build failed for ${exampleAbs} with exit code ${result.status}`
    )
  }
}

test.describe.configure({mode: 'serial'})

const templates = readTemplatesMeta()
  .filter((t) => typeof t?.slug === 'string')
  .map((t) => t.slug)

// Allow scoping how many templates to build via env, e.g. EXAMPLES_LIMIT=2
const examplesLimit =
  typeof process?.env?.EXAMPLES_LIMIT === 'string'
    ? Number(process.env.EXAMPLES_LIMIT)
    : undefined
const validLimit =
  typeof examplesLimit === 'number' &&
  Number.isFinite(examplesLimit) &&
  examplesLimit > 0

const slugsToBuild = templates
  .filter((s) => s !== 'content-monorepo-turbopack')
  .slice(0, validLimit ? examplesLimit : undefined)

for (const slug of slugsToBuild) {
  test(`builds ${slug}`, async () => {
    const examplesDir = getDirname(import.meta.url)
    const exampleAbs = path.join(examplesDir, slug)
    expect(fs.existsSync(exampleAbs), `Missing example at ${exampleAbs}`).toBe(
      true
    )
    buildExample(exampleAbs)
    // Successful CLI exit is sufficient to validate build capability.
  })
}

test('builds content-monorepo-turbopack root and clients', async () => {
  const examplesDir = getDirname(import.meta.url)
  const slug = 'content-monorepo-turbopack'
  const exampleAbs = path.join(examplesDir, slug)
  expect(fs.existsSync(exampleAbs), `Missing example at ${exampleAbs}`).toBe(
    true
  )
  // Build root (demonstrates root manifest usage)
  buildExample(exampleAbs)
  // Build each client to demonstrate turborepo multi-extension layout
  const clientsDir = path.join(exampleAbs, 'clients')
  const clientNames =
    fs
      .readdirSync(clientsDir, {withFileTypes: true})
      .filter((d) => d.isDirectory())
      .map((d) => d.name) || []
  expect(clientNames.length > 0, 'No clients found to build').toBe(true)

  for (const client of clientNames) {
    const clientAbs = path.join(clientsDir, client)

    buildExample(clientAbs)
    // Successful CLI exit is sufficient to validate build capability.
  }
})
