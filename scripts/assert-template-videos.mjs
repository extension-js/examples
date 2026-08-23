// Every template on templates.extension.dev has a "What to expect" video tab.
// A template with no video renders an empty player there, so a new template
// must ship one. This check is what makes that a rule rather than a wish.
//
// Read-only on purpose: scripts/standardize-templates.mjs also audits videos,
// but it REWRITES files as it goes, so it cannot be a gate. This one only
// reads and exits non-zero.
//
// Usage: node scripts/assert-template-videos.mjs

import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const EXAMPLES = path.join(HERE, '..', 'examples')

// Templates a clip cannot honestly show. They keep their screenshot.
//
// init and special-folders-pages do nothing visible on screen, so a clip would
// have to invent a payoff.
//
// newtab-browser-flags exists to demonstrate custom browser flags and its own
// config sets `--kiosk`. Chromium launches fullscreen over everything, so every
// beat of a take is the same picture: there is no cut to film, and the recorder
// says so by failing "beats show the actor the scene declares". A still frame
// is what that template looks like, and it already has one.
const EXEMPT = new Set([
  'init',
  'special-folders-pages',
  'newtab-browser-flags'
])

// Templates that predate the video requirement. They are owed a video and are
// being shot; until then they are not allowed to block CI. Delete a slug from
// this list the moment its video lands, and never add one: a NEW template with
// no video is exactly what this file exists to stop.
const AWAITING_FIRST_SHOOT = new Set([
  'action',
  'action-locales',
  'ai-chatgpt',
  'ai-claude',
  'ai-gemini',
  'ai-perplexity',
  'javascript',
  'playwright',
  'preact',
  'react',
  'sidebar',
  'sidebar-antd',
  'sidebar-monorepo-nx',
  'sidebar-monorepo-turborepo',
  'sidebar-shadcn',
  'special-folders-scripts',
  'svelte',
  'transformers-js',
  'typescript',
  'vue'
])

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

// A directory is not a template. CI restores a node_modules cache keyed from
// before the new-tab templates were renamed, which recreates `examples/
// new-react/` containing nothing but `node_modules` -- and this check then
// reported fifteen templates that do not exist, on a tree where they had all
// been renamed. A template is a directory that declares itself with a
// package.json; a cache husk does not.
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
