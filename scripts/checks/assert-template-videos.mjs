import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const EXAMPLES = path.join(HERE, '..', '..', 'examples')
const EXEMPT = new Set([
  'init',
  'special-folders-pages',
  'newtab-browser-flags'
])

const AWAITING_FIRST_SHOOT = new Set(['newtab-typescript-tesseract'])

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

const slugs = fs
  .readdirSync(EXAMPLES, {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => fs.existsSync(path.join(EXAMPLES, name, 'package.json')))
  .sort()

const missing = []
const malformed = []
const seen = []
let haveVideo = 0

for (const slug of slugs) {
  if (EXEMPT.has(slug)) continue

  let video = null

  try {
    const meta = JSON.parse(
      fs.readFileSync(path.join(EXAMPLES, slug, 'template.meta.json'), 'utf8')
    )

    video = meta?.video ?? null
  } catch {
    // A template with no meta file at all is reported as missing below.
  }

  if (video == null || video === '') {
    if (!AWAITING_FIRST_SHOOT.has(slug)) missing.push(slug)

    continue
  }

  if (!YOUTUBE_ID.test(String(video))) {
    malformed.push(`${slug}: ${video}`)
    continue
  }

  haveVideo += 1
  seen.push([slug, String(video)])

  if (AWAITING_FIRST_SHOOT.has(slug)) {
    malformed.push(
      `${slug}: has a video but is still listed in AWAITING_FIRST_SHOOT. ` +
        'Remove it from that list.'
    )
  }
}

// Two templates pointing at one clip is what a 56-file repoint gets wrong, and
// a shape test cannot see it.
const duplicates = []
const bySeenId = new Map()

for (const [slug, id] of seen) {
  if (bySeenId.has(id))
    {duplicates.push(`${slug} and ${bySeenId.get(id)}: ${id}`)}
  else bySeenId.set(id, slug)
}

const awaiting = [...AWAITING_FIRST_SHOOT].filter((s) => slugs.includes(s))
console.log(
  `templates: ${slugs.length} | with video: ${haveVideo} | ` +
    `exempt: ${EXEMPT.size} | awaiting first shoot: ${awaiting.length}`
)

if (missing.length) {
  console.error(
    `\nThese templates have no "What to expect" video:\n` +
      missing.map((s) => `  ${s}`).join('\n') +
      `\n\nAdd "video": "<youtube-id>" to examples/<slug>/template.meta.json.`
  )
}

if (malformed.length) {
  console.error(
    `\nThese entries are wrong:\n` + malformed.map((s) => `  ${s}`).join('\n')
  )
}

if (duplicates.length) {
  console.error(
    `\nThese templates share one clip, so at least one points at the wrong ` +
      `video:\n` +
      duplicates.map((s) => `  ${s}`).join('\n')
  )
}

// A slug list that came back empty would report every template as fine.
if (slugs.length < 40) {
  console.error(
    `\nScanned only ${slugs.length} templates, expected at least 40.`
  )

  process.exit(1)
}

process.exit(missing.length || malformed.length || duplicates.length ? 1 : 0)
