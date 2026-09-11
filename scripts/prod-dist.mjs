#!/usr/bin/env node
// Publishes the read-only production tree the static specs read.
// Keep in sync with the same helpers in examples/extension-fixtures.ts.

import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

export const PROD_DIST_ROOT = '.prod-dist'

function manifestEntryRefs(manifest) {
  const refs = []
  const push = (value) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      refs.push(value.replace(/^\.?\//, ''))
    }
  }
  push(manifest?.background?.service_worker)
  for (const script of manifest?.background?.scripts ?? []) push(script)
  if (Array.isArray(manifest?.content_scripts)) {
    for (const cs of manifest.content_scripts) {
      for (const file of cs?.js ?? []) push(file)
      for (const file of cs?.css ?? []) push(file)
    }
  }
  push(manifest?.action?.default_popup)
  push(manifest?.browser_action?.default_popup)
  push(manifest?.side_panel?.default_path)
  push(manifest?.sidebar_action?.default_panel)
  push(manifest?.chrome_url_overrides?.newtab)
  push(manifest?.options_ui?.page)
  push(manifest?.devtools_page)
  return refs
}

// A tree qualifies only when its manifest parses and every file it names is
// present and non-empty, so a half-written build never counts as published.
export function isCompleteDist(dir) {
  let manifest
  try {
    manifest = JSON.parse(
      fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')
    )
  } catch {
    return false
  }
  return manifestEntryRefs(manifest).every((rel) => {
    try {
      return fs.statSync(path.join(dir, rel)).size > 0
    } catch {
      return false
    }
  })
}

export function prodDistPath(exampleDirAbsolute) {
  const slug = path
    .relative(REPO_ROOT, exampleDirAbsolute)
    .replace(/[\\/]/g, '__')
  return path.join(REPO_ROOT, PROD_DIST_ROOT, slug, 'chrome')
}

// Called serially from globalSetup, before any worker exists, so a plain
// replace is safe here where the spec-side helper needs a rename swap.
export function publishProdDist(exampleDirAbsolute) {
  const source = path.join(exampleDirAbsolute, 'dist', 'chrome')
  if (!isCompleteDist(source)) return null
  const target = prodDistPath(exampleDirAbsolute)
  try {
    fs.rmSync(target, {recursive: true, force: true})
    fs.mkdirSync(path.dirname(target), {recursive: true})
    fs.cpSync(source, target, {recursive: true})
  } catch {
    return null
  }
  return isCompleteDist(target) ? target : null
}
