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

// Nothing these two do is visible on screen, so a clip would have to invent a
// payoff. They keep their screenshot and no video.
const EXEMPT = new Set(['init', 'special-folders-pages'])

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
  'content',
  'content-css-modules',
  'content-custom-font',
  'content-env',
  'content-less',
  'content-less-modules',
  'content-main-world',
  'content-multi-one-entry',
  'content-multi-three-entries',
  'content-preact',
  'content-react',
  'content-sass',
  'content-sass-modules',
  'content-svelte',
  'content-typescript',
  'content-vue',
  'javascript',
  'new',
  'new-browser-flags',
  'new-config-eslint',
  'new-config-prettier',
  'new-config-stylelint',
  'new-crypto',
  'new-env',
  'new-less',
  'new-preact',
  'new-react',
  'new-react-router',
  'new-sass',
  'new-svelte',
  'new-typescript',
  'new-vue',
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

const slugs = fs
  .readdirSync(EXAMPLES, {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
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
