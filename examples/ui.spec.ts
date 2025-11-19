import {test, expect} from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from './extension-fixtures'

function getDirname(url: string) {
  return path.dirname(new URL(url).pathname)
}

function readTemplatesMeta(): Array<{slug: string}> {
  const examplesDir = getDirname(import.meta.url)
  const metaPath = path.resolve(examplesDir, '../templates-meta.json')
  const json = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  return Array.isArray(json?.templates) ? json.templates : []
}

function hasFile(...segments: string[]) {
  try {
    return fs.existsSync(path.join(...segments))
  } catch {
    return false
  }
}

function selectEntryHtml(builtDir: string): string | null {
  // Try common UI entry pages across templates
  const candidates = [
    ['action', 'index.html'],
    ['sidebar', 'index.html'],
    ['newtab', 'index.html'],
    ['popup', 'popup.html']
  ]
  for (const parts of candidates) {
    const p = path.join(builtDir, ...parts)
    if (hasFile(p)) return parts.join('/')
  }
  return null
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
  // Shallow scan fallback
  for (const root of roots) {
    const rootPath = path.join(exampleAbs, root)
    try {
      const entries = fs.readdirSync(rootPath, {withFileTypes: true})
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const dir = path.join(rootPath, entry.name)
        if (hasManifest(dir)) return dir
      }
    } catch {}
  }
  return null
}

test.describe.configure({mode: 'serial'})

const allSlugs = readTemplatesMeta()
  .filter((t) => typeof t?.slug === 'string')
  .map((t) => t.slug)

// First N examples (default 3), excluding the monorepo root here for UI test stability
const examplesLimit =
  typeof process?.env?.EXAMPLES_LIMIT === 'string'
    ? Number(process.env.EXAMPLES_LIMIT)
    : 3
const validLimit =
  typeof examplesLimit === 'number' &&
  Number.isFinite(examplesLimit) &&
  examplesLimit > 0

const uiSlugs = allSlugs
  .filter((s) => s !== 'content-monorepo-turbopack')
  .slice(0, validLimit ? examplesLimit : 3)

for (const slug of uiSlugs) {
  // Resolve or build artifacts up-front to avoid empty paths
  const examplesDir = getDirname(import.meta.url)
  const exampleAbs = path.join(examplesDir, slug)
  // Always try to resolve via helper (will build if missing)
  const builtDir = resolveBuiltExtensionPath(exampleAbs)
  // Define a test runner bound to this ensured extension path
  const testWithExt = extensionFixtures(builtDir, true)

  testWithExt(`ui appears for ${slug}`, async ({context, extensionId}) => {
    expect(fs.existsSync(exampleAbs), `Missing example at ${exampleAbs}`).toBe(
      true
    )
    expect(
      builtDir,
      `Built artifacts not found for ${slug} at ${exampleAbs}`
    ).not.toBeNull()

    const entryRel = selectEntryHtml(builtDir!)
    expect(entryRel, `No known UI entry html in ${builtDir}`).not.toBeNull()

    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/${entryRel}`, {
      waitUntil: 'load',
      timeout: 30000
    })

    await expect(page.locator('body')).toBeVisible()
    const bodyLen = await page.evaluate(
      () => document.body?.innerText?.trim().length ?? 0
    )
    expect(bodyLen).toBeGreaterThan(0)
  })
}
