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

const AWAITING_FIRST_SHOOT = new Set([])

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

const slugs = fs
  .readdirSync(EXAMPLES, {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => fs.existsSync(path.join(EXAMPLES, name, 'package.json')))
  .sort()

const missing = []
const malformed = []
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

  if (AWAITING_FIRST_SHOOT.has(slug)) {
    malformed.push(
      `${slug}: has a video but is still listed in AWAITING_FIRST_SHOOT. ` +
        'Remove it from that list.'
    )
  }
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

process.exit(missing.length || malformed.length ? 1 : 0)
