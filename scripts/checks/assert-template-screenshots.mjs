import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
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
    untracked.push(
      onDisk ? `${slug}: ${onDisk} exists but git does not track it` : slug
    )

    continue
  }

  haveScreenshot += 1
}

// The catalog is what the website trusts, so a row may not promise a picture
// that is not in the repository.
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

  dangling.push(`${slug}: ${claim}`)
}

console.log(
  `templates: ${slugs.length} | with screenshot: ${haveScreenshot} | ` +
    `catalog rows: ${rows.length}`
)

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

// A catalog that lost rows would otherwise pass: every row it still holds is
// fine, and the slugs it dropped are simply never visited.
const rowSlugs = new Set(rows.map((row) => row.slug))
const unlisted = slugs.filter((slug) => !rowSlugs.has(slug))

if (unlisted.length) {
  console.error(
    `\nThese templates have no catalog row at all:\n` +
      unlisted.map((slug) => `  ${slug}`).join('\n')
  )
}

process.exit(
  untracked.length || missingField.length || dangling.length || unlisted.length
    ? 1
    : 0
)
