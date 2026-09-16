#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(path.join(__dirname, '..', '..'))
const EXAMPLES_DIR = path.join(REPO_ROOT, 'examples')
const META_PATH = path.join(REPO_ROOT, 'templates-meta.json')

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJSON(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

function normalizeTemplatePath(slug, filePath) {
  if (!filePath) return filePath

  let clean = String(filePath)
    .replace(/^\/+/, '')
    .replace(/^\.\/+/, '')

  for (const prefix of [`examples/${slug}/`, `public/${slug}/`, `${slug}/`]) {
    if (clean.startsWith(prefix)) {
      clean = clean.slice(prefix.length)
      break
    }
  }

  return `examples/${slug}/${clean}`
}

function resolveScreenshot(slug) {
  const candidates = ['screenshot.png', 'public/screenshot.png']
  const found = candidates.find((candidate) =>
    fs.existsSync(path.join(EXAMPLES_DIR, slug, candidate))
  )

  return found ? `examples/${slug}/${found}` : null
}

function main() {
  if (!fs.existsSync(META_PATH)) {
    console.error(
      '►►► templates-meta.json not found. Run "pnpm run generate" first.'
    )

    process.exit(1)
  }

  const templatesMetadata = readJSON(META_PATH)
  templatesMetadata.commit = 'main'

  templatesMetadata.templates = (templatesMetadata.templates || []).map(
    (template) => {
      const slug = template.slug

      return {
        ...template,
        screenshot: resolveScreenshot(slug),
        icon: template.icon ? normalizeTemplatePath(slug, template.icon) : null,
        files: (template.files || []).map((filePath) =>
          normalizeTemplatePath(slug, filePath)
        ),
        repositoryUrl: `https://github.com/extension-js/examples/tree/main/examples/${slug}`
      }
    }
  )

  writeJSON(META_PATH, templatesMetadata)

  try {
    spawnSync('pnpm', ['prettier', '--write', 'templates-meta.json'], {
      stdio: 'inherit'
    })
  } catch {
    // Do nothing
  }
}

main()
