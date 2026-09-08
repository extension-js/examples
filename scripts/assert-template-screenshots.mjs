// Every template on templates.extension.dev shows a screenshot: on its card,
// and on its page whenever it has no clip to play. A template with none shows
// a broken image, and the catalog has no way to say "no picture here".
//
// Read-only on purpose, like assert-template-videos.mjs. standardize-templates
// .mjs also audits screenshots but REWRITES files as it goes, so it cannot be
// a gate.
//
// What this exists to stop, from the day it was written: six devtools
// templates shipped with `screenshot.png` present on ONE machine and never
// committed. `generate-templates-meta.mjs` probes the filesystem, so a local
// catalog run wrote a `screenshot` field for all six, the field was committed,
// the images were not, and the live site served 404 for a picture its own
// catalog promised. An existence check alone would have passed on that
// machine, so the check here is that git TRACKS the file.
//
// Usage: node scripts/assert-template-screenshots.mjs

import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..')
const EXAMPLES = path.join(ROOT, 'examples')

// No template is exempt. A screenshot is a still frame of the template, and
// every template can be photographed even when it cannot be filmed: the three
// templates that carry no clip are exactly the ones that lean on this picture.
const EXEMPT = new Set([])

// A directory is not a template. A CI cache husk can leave a directory holding
// nothing but node_modules, so a template is one that declares itself.
const slugs = fs
  .readdirSync(EXAMPLES, {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => fs.existsSync(path.join(EXAMPLES, name, 'package.json')))
  .sort()

// One `git ls-files` for the whole repo, so this stays fast and needs no
// network. Paths come back repo-relative with forward slashes.
const tracked = new Set(
  execFileSync('git', ['ls-files'], {cwd: ROOT, encoding: 'utf8'})
    .split('\n')
    .filter(Boolean)
)

const sourceCandidates = (slug) => [
  `examples/${slug}/screenshot.png`,
  `examples/${slug}/public/screenshot.png`
]

const untracked = []
const missingField = []
const dangling = []
const pendingMirror = []
let haveScreenshot = 0

for (const slug of slugs) {
  if (EXEMPT.has(slug)) continue
  const source = sourceCandidates(slug).find((candidate) =>
    tracked.has(candidate)
  )
  if (!source) {
    const onDisk = sourceCandidates(slug).find((candidate) =>
      fs.existsSync(path.join(ROOT, candidate))
    )
    untracked.push(onDisk ? `${slug}: ${onDisk} exists but git does not track it` : slug)
    continue
  }
  haveScreenshot += 1
}

// The catalog is what the website trusts, so a row may not promise a picture
// that is not in the repository. A row pointing at the staged mirror the
// artifacts workflow writes is fine while that workflow has yet to run, as
// long as the template's own screenshot is committed.
const catalogPath = path.join(ROOT, 'templates-meta.json')
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
const rows = Array.isArray(catalog) ? catalog : (catalog.templates ?? [])

for (const row of rows) {
  const slug = row?.slug
  if (!slug || EXEMPT.has(slug)) continue
  const claim = row.screenshot
  if (!claim) {
    missingField.push(slug)
    continue
  }
  if (tracked.has(claim)) continue
  if (sourceCandidates(slug).some((candidate) => tracked.has(candidate))) {
    pendingMirror.push(`${slug}: ${claim}`)
    continue
  }
  dangling.push(`${slug}: ${claim}`)
}

console.log(
  `templates: ${slugs.length} | with screenshot: ${haveScreenshot} | ` +
    `catalog rows: ${rows.length} | mirrors not staged yet: ${pendingMirror.length}`
)

if (pendingMirror.length) {
  console.log(
    `\nThese rows name a mirror the artifacts workflow has not staged yet, ` +
      `which is fine because each template's own screenshot is committed:\n` +
      pendingMirror.map((entry) => `  ${entry}`).join('\n')
  )
}

if (untracked.length) {
  console.error(
    `\nThese templates have no committed screenshot:\n` +
      untracked.map((entry) => `  ${entry}`).join('\n') +
      `\n\nAdd examples/<slug>/screenshot.png and commit it. A screenshot that ` +
      `only exists on your machine leaves the live catalog serving 404.`
  )
}

if (missingField.length) {
  console.error(
    `\nThese catalog rows carry no "screenshot" field:\n` +
      missingField.map((entry) => `  ${entry}`).join('\n') +
      `\n\nRun the catalog generator so templates-meta.json names the file.`
  )
}

if (dangling.length) {
  console.error(
    `\nThese catalog rows promise a screenshot the repository does not have:\n` +
      dangling.map((entry) => `  ${entry}`).join('\n')
  )
}

process.exit(untracked.length || missingField.length || dangling.length ? 1 : 0)
