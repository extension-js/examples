#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const META_FILENAME = 'template.meta.json'
const STORE_FILENAME = 'STORE.md'
const WIDTH = 76

// The date the template text last changed. `extension create` rewrites this
// line to the scaffold date, so the catalog copy only has to stay honest.
const TEMPLATE_UPDATED = '2026-10-24'

// Mozilla wants a reproducible build for a bundled package, so the reviewer
// notes name a toolchain. CI builds the catalog on Node 22 (ci.yml).
const TOOLCHAIN = {node: '22.12.0', npm: '10.9.0'}

const BROWSER_PREFIX_LABELS = {
  chromium: 'Chromium',
  chrome: 'Chrome',
  edge: 'Edge',
  gecko: 'Firefox',
  firefox: 'Firefox',
  safari: 'Safari',
  webkit: 'Safari'
}

function parseArgs(argv) {
  const opts = {check: false, only: null, examplesDir: null}

  for (const arg of argv) {
    if (arg === '--check') opts.check = true
    else if (arg.startsWith('--only=')) {
      opts.only = new Set(
        arg
          .slice('--only='.length)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )
    } else if (arg.startsWith('--examples-dir=')) {
      opts.examplesDir = arg.slice('--examples-dir='.length)
    }
  }

  return opts
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function walk(dir, keep, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (/^(node_modules|dist|\.extension|e2e-report)$/.test(entry.name)) {
      continue
    }

    const p = path.join(dir, entry.name)

    if (entry.isDirectory()) walk(p, keep, out)
    else if (keep(p)) out.push(p)
  }

  return out
}

// A monorepo template keeps the extension in a workspace package, so the
// manifest is wherever a src/manifest.json sits, not only at the root.
export function findManifest(exampleDir) {
  const direct = [
    path.join(exampleDir, 'src', 'manifest.json'),
    path.join(exampleDir, 'manifest.json')
  ].find((p) => fs.existsSync(p))

  if (direct) return direct

  const nested = walk(exampleDir, (p) =>
    p.endsWith(`${path.sep}src${path.sep}manifest.json`)
  ).sort()

  return nested[0] || null
}

export function collectExamples(examplesDir, only = null) {
  return fs
    .readdirSync(examplesDir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .filter((slug) => !only || only.has(slug))
    .sort()
    .map((slug) => {
      const dir = path.join(examplesDir, slug)
      const manifestPath = findManifest(dir)

      return {slug, dir, manifestPath}
    })
    .filter((example) => example.manifestPath)
}

function splitPrefix(key) {
  const colon = key.indexOf(':')
  if (colon === -1) return {prefix: '', base: key}

  const prefix = key.slice(0, colon)
  if (!(prefix in BROWSER_PREFIX_LABELS)) return {prefix: '', base: key}

  return {prefix, base: key.slice(colon + 1)}
}

// Collects a manifest key across its plain and browser-prefixed spellings.
// Each value records the prefixes that carry it, or null when every
// spelling the manifest uses for that key (or the plain one) carries it.
function mergedValues(manifest, base) {
  const byValue = new Map()
  const prefixes = new Set()
  let plain = false

  for (const [key, value] of Object.entries(manifest)) {
    const split = splitPrefix(key)
    if (split.base !== base || !Array.isArray(value)) continue

    if (split.prefix) prefixes.add(split.prefix)
    else plain = true

    for (const item of value) {
      if (typeof item !== 'string') continue

      const seen = byValue.get(item) || new Set()
      if (split.prefix) seen.add(split.prefix)
      else seen.add('')

      byValue.set(item, seen)
    }
  }

  return [...byValue.entries()].map(([value, seen]) => {
    const everywhere =
      seen.has('') || (!plain && [...prefixes].every((p) => seen.has(p)))

    return {
      value,
      browsers: everywhere ? null : [...seen].filter(Boolean)
    }
  })
}

function mergedObject(manifest, base) {
  const plain = manifest[base]
  if (plain && typeof plain === 'object') return plain

  for (const [key, value] of Object.entries(manifest)) {
    const split = splitPrefix(key)

    if (split.base === base && value && typeof value === 'object') {
      return value
    }
  }

  return null
}

const isMatchPattern = (value) =>
  /^<all_urls>$/.test(value) || value.includes('://') || value.startsWith('*')

// The listing reader takes a bullet key up to its first colon, so a match
// pattern keeps its host and path and drops the scheme.
const bareHost = (pattern) => pattern.replace(/^[a-z*]+:\/\//i, '')

const browserNote = (browsers) =>
  browsers
    ? `requested on ${[
        ...new Set(browsers.map((p) => BROWSER_PREFIX_LABELS[p]))
      ].join(' and ')} only`
    : ''

// One bullet per permission, host permission and content script match the
// manifest requests, in the order the Chrome dashboard asks them.
export function requestedBullets(manifest) {
  const bullets = []
  const seen = new Set()

  const push = (key, note) => {
    if (seen.has(key)) return

    seen.add(key)
    bullets.push({key, note})
  }

  for (const base of ['permissions', 'optional_permissions']) {
    const optional = base === 'optional_permissions'

    for (const {value, browsers} of mergedValues(manifest, base)) {
      const notes = [optional ? 'optional' : '', browserNote(browsers)].filter(
        Boolean
      )

      if (isMatchPattern(value)) {
        push(`Host permission ${bareHost(value)}`, notes.join(', '))
      } else {
        push(value, notes.join(', '))
      }
    }
  }

  for (const base of ['host_permissions', 'optional_host_permissions']) {
    const optional = base === 'optional_host_permissions'

    for (const {value, browsers} of mergedValues(manifest, base)) {
      const notes = [optional ? 'optional' : '', browserNote(browsers)].filter(
        Boolean
      )

      push(`Host permission ${bareHost(value)}`, notes.join(', '))
    }
  }

  for (const [key, scripts] of Object.entries(manifest)) {
    if (
      splitPrefix(key).base !== 'content_scripts' ||
      !Array.isArray(scripts)
    ) {
      continue
    }

    for (const script of scripts) {
      for (const match of script?.matches || []) {
        push(`Content script match ${bareHost(match)}`, '')
      }
    }
  }

  return bullets
}

function firefoxDataCollection(manifest) {
  const settings = mergedObject(manifest, 'browser_specific_settings')
  const declared = settings?.gecko?.data_collection_permissions

  if (!declared) {
    return 'TODO add browser_specific_settings.gecko.data_collection_permissions to the manifest'
  }

  const required = (declared.required || []).filter((p) => p !== 'none')
  const optional = declared.optional || []
  const parts = [required.length ? required.join(', ') : 'none']
  if (optional.length) parts.push(`(optional: ${optional.join(', ')})`)

  return parts.join(' ')
}

function wrap(text, {indent = '', first = indent, width = WIDTH} = {}) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let line = first
  let bare = true

  for (const word of words) {
    if (!bare && line.length + 1 + word.length > width) {
      lines.push(line)
      line = indent + word
    } else {
      line = bare ? line + word : `${line} ${word}`
      bare = false
    }
  }

  lines.push(line)

  return lines
}

const bullet = (key, value) =>
  wrap(`${key}: ${value}`, {first: '- ', indent: '  '})
const note = (text) =>
  wrap(text, {first: '  <!-- ', indent: '  '}).map((l, i, a) =>
    i === a.length - 1 ? `${l} -->` : l
  )
const paragraph = (text) => wrap(text)

// The reader keeps a value as one field only while its continuation lines
// stay indented, and it drops a value that still starts with TODO.
export function renderStoreMd({manifest, packageJson, seed, slug}) {
  const name = seed.name || manifest.name || slug
  const summary = seed.summary || manifest.description || 'TODO one sentence'
  const singlePurpose = seed.singlePurpose || summary
  const license = packageJson?.license || 'TODO an SPDX identifier such as MIT'
  const language = manifest.default_locale || 'en'
  const dataCollected = seed.dataCollected || 'none'
  const bullets = requestedBullets(manifest)
  const justifications = seed.justifications || {}
  const reviewerHints = seed.reviewerHints ? ` ${seed.reviewerHints}` : ''
  const versionHistory = seed.versionHistory || [
    `${manifest.version || '1.0.0'} (unreleased): initial version from the ${slug} template. Not yet submitted to any store.`
  ]

  for (const key of Object.keys(justifications)) {
    if (!bullets.some((b) => b.key === key)) {
      throw new Error(
        `${slug}: template.meta.json store.justifications names "${key}", which the manifest does not request`
      )
    }
  }

  const out = []
  const add = (...lines) => out.push(...lines.flat())

  add(
    '# Store metadata',
    '',
    ...paragraph(
      "Starter file generated from this template's manifest. STORE.md is what " +
        '`extension_submit sync-listing` reads to fill the Chrome Web Store, ' +
        'Firefox Add-ons, Edge Add-ons and Mac App Store listings, and what the ' +
        'store preflights check. Every store asks for this material at ' +
        'submission time, so keep it current as the code changes instead of ' +
        'rewriting it at the end. A line marked TODO is a fact only the owner ' +
        'can supply: the file shows what is missing and never invents listing ' +
        'copy, and a value that still starts with TODO is skipped, not sent. ' +
        'Items a store takes only on its own dashboard (Chrome promo tiles and ' +
        "data-use answers, Edge logo, tiles and properties, Apple's App Privacy " +
        'and age rating) stay by hand and are listed under each store below. ' +
        "The HTML comments carry each field's format and limits, and the " +
        'readers ignore them.'
    ),
    '',
    `Last updated: ${TEMPLATE_UPDATED}`,
    '',
    '## Listing',
    '',
    ...bullet('Name', name),
    ...note('The store title, 100 characters at most on every store.'),
    ...bullet('Summary', summary),
    ...note(
      "Chrome's summary, 132 characters at most. It doubles as the Safari subtitle only when it fits 30."
    ),
    ...bullet('Subtitle', 'TODO a 30 character App Store subtitle'),
    ...note(
      'App Store subtitle, 30 characters at most. Without it the Safari push leaves the field empty.'
    ),
    '- Description:',
    '',
    ...wrap(
      'TODO two or three short paragraphs of user benefits. Describe what the ' +
        'user sees and gains, not how the code works. Keep every paragraph ' +
        'indented like this one so the readers take them as one field.',
      {indent: '  '}
    ),
    '',
    ...bullet(
      'Category',
      'TODO one per store, for example Productivity (Chrome Web Store, Firefox Add-ons, Edge Add-ons), Utilities (App Store)'
    ),
    ...note(
      'One category per store, the store names in parentheses stay out of the value. One of them must be an App Store category (Productivity or Utilities): Apple refuses an upload without a primary category.'
    ),
    ...bullet('Language', language),
    ...bullet('License', license),
    ...note(
      'A bare SPDX identifier with no trailing period: "MIT." once reached AMO as the license.'
    ),
    ...bullet('Support email', 'TODO the address users and reviewers write to'),
    ...bullet('Homepage', 'TODO the project or company site URL'),
    ...bullet('Search terms', 'TODO up to seven terms, comma separated'),
    ...note(
      'Comma list. Edge takes at most 7 terms and 21 words in all, and Safari keywords are 100 characters in all.'
    ),
    '- Screenshots:',
    '  1. TODO screenshots/01.png',
    ...note(
      'One PNG path per numbered line, relative to the project. Chrome takes 1280x800 or 640x400, Edge 1280x800 or 640x480, the App Store exactly 1280x800, 1440x900, 2560x1600 or 2880x1800 in RGB without alpha and showing the extension in real Safari (a 2880x1800 capture of a Safari window is the simplest way). Chrome and Edge also show 440x280 and 1400x560 promo tiles.'
    ),
    '',
    '## Privacy and data use',
    '',
    ...bullet(
      'Privacy policy URL',
      'TODO (Apple requires one on every app, Chrome and Edge once any data is handled)'
    ),
    ...note(
      'The only place this URL lives. The readers take the first http or https address on this line, so leave no sample address here.'
    ),
    ...bullet('Data collected', dataCollected),
    ...note(
      'Every kind of data the extension collects, stores or sends, or none. Chrome, Edge and Apple each ask it again on their dashboards.'
    ),
    ...bullet('Firefox data collection', firefoxDataCollection(manifest)),
    ...note(
      'Mirrors browser_specific_settings.gecko.data_collection_permissions in the manifest. AMO reads the manifest, so the two must agree.'
    ),
    '',
    ...paragraph('Per store answer sheets, filled from the two lines above:'),
    '',
    ...bullet(
      'Chrome Web Store',
      'the data-usage checkboxes and the three certifications on the Privacy practices tab, answered by hand on the developer dashboard.'
    ),
    ...bullet(
      'Firefox Add-ons',
      "the manifest's data_collection_permissions is the declaration, and AMO reads it from the package."
    ),
    ...bullet(
      'Edge Add-ons',
      'the nine data categories and the three certifications on the Privacy page, typed once on Partner Center.'
    ),
    ...bullet(
      'App Store',
      'App Privacy, "Data Not Collected" when the line above says none, answered by hand in App Store Connect.'
    ),
    '',
    '## Chrome Web Store',
    '',
    '### Single purpose',
    '',
    ...paragraph(singlePurpose),
    '',
    '### Permissions justification',
    '',
    ...note(
      'One bullet per permission, host permission and content script match the manifest requests, as the Chrome dashboard and the Edge Privacy page ask them. A reason that still starts with TODO is not sent. "Needed for the extension to work" fails review on every store.'
    ).map((l) => l.replace(/^ {2}/, '')),
    ''
  )

  if (bullets.length) {
    for (const {key, note: hint} of bullets) {
      const reason = justifications[key]
      const sentence = hint ? ` ${hint[0].toUpperCase()}${hint.slice(1)}.` : ''

      add(
        ...bullet(
          key,
          reason
            ? `${reason}${sentence}`
            : `TODO reason${hint ? ` (${hint})` : ''}`
        )
      )
    }
  } else {
    add(
      ...paragraph(
        'This template requests no permissions and no host access, so there is ' +
          'nothing to justify. If you add a permission, add a specific, plain ' +
          'reason here in the same change.'
      )
    )
  }

  add(
    '',
    ...paragraph(
      'Remote code: none. Every script ships inside the package, which is the ' +
        'answer to the remote code question on Chrome and Edge.'
    ),
    '',
    '### Test instructions',
    '',
    ...paragraph(
      'TODO the steps a reviewer follows to see the extension work, with test ' +
        'credentials when sign-in is required. The Firefox reviewer notes and ' +
        `the Edge certification notes below take the same steps.${reviewerHints}`
    ),
    '',
    '## Firefox Add-ons',
    '',
    '### Reviewer notes',
    '',
    ...paragraph(
      'TODO the steps a reviewer follows to exercise the extension, with test ' +
        'credentials when sign-in is required. Keep the build paragraph below: ' +
        `AMO wants a reproducible build for a bundled package.${reviewerHints}`
    ),
    '',
    ...paragraph(
      `Build from source with Node ${TOOLCHAIN.node} and npm ${TOOLCHAIN.npm} ` +
        '(replace both with the output of node --version and npm --version on ' +
        'the machine that built the upload): run npm install, then npx ' +
        'extension build --browser firefox. The upload is dist/firefox, byte ' +
        'for byte. With the Firefox source archive setting on in extension.dev, ' +
        'the platform attaches the repository at the built commit, so no ' +
        'separate source zip is uploaded.'
    ),
    '',
    '### Release notes',
    '',
    ...paragraph(
      'TODO what changed for users in this version, in their words. Write the ' +
        'notes here rather than pointing at another section: a pointer reaches ' +
        'AMO verbatim.'
    ),
    '',
    '## Edge Add-ons',
    '',
    ...paragraph(
      'The package may hold no compressed file: Partner Center refuses any ' +
        '.gz, .zip or other archive inside it, so vendor such assets ' +
        'uncompressed. Logo, promo tiles, screenshots, properties and privacy ' +
        'answers are typed once on Partner Center, because the Publish API ' +
        'takes only packages.'
    ),
    '',
    '### Certification notes',
    '',
    ...paragraph(
      'TODO the steps the certification team follows to test the extension, ' +
        'with test credentials when sign-in is required. The Firefox reviewer ' +
        'notes fit here in most cases: paste them rather than pointing at ' +
        `them.${reviewerHints}`
    ),
    '',
    '### Dashboard checklist',
    '',
    ...paragraph(
      'What the Publish API cannot set, typed once on Partner Center:'
    ),
    '',
    '- Store logo, 300x300 PNG.',
    '- Promo tiles, 440x280 and 1400x560, shown on the store page.',
    ...bullet(
      'Properties page',
      'the answers on personal information and mature content.'
    ),
    ...bullet(
      'Privacy page',
      'the nine data categories and three certifications, the same answers as the Privacy and data use section.'
    ),
    '- Optional YouTube URL.',
    '',
    '## Safari (Mac App Store)',
    '',
    ...bullet('Bundle identifier', 'TODO com.example.my-extension'),
    ...note(
      'Reverse DNS, permanent once the first build reaches App Store Connect.'
    ),
    ...bullet('Review contact name', 'TODO'),
    ...bullet('Review contact email', 'TODO'),
    ...bullet('Review contact phone', 'TODO'),
    '',
    '### Reviewer notes',
    '',
    ...paragraph(
      'TODO how to turn the extension on: open Safari, choose Safari, ' +
        'Settings, Extensions, tick the extension, then allow it on the sites ' +
        'it needs. Add test credentials when sign-in is required.'
    ),
    '',
    '### Release notes',
    '',
    ...paragraph(
      "TODO what's new in this version, in the user's words. Required from " +
        'the second version on.'
    ),
    '',
    '### Age rating',
    '',
    ...paragraph(
      "Apple's questionnaire is answered in full on every push. None applies " +
        'unless a line below says otherwise.'
    ),
    '',
    ...bullet(
      'Violence, mature or suggestive themes, profanity, horror, medical or drug references, gambling, contests',
      'none'
    ),
    '- Parental controls, age assurance: none',
    '- Unrestricted web access: none',
    '- User generated content, social media, messaging: none',
    '- Advertising: none',
    '- Loot boxes or similar in-app purchases: none',
    '',
    ...paragraph(
      'App Privacy, and today the age rating and the availability in all 175 ' +
        'territories as well, are confirmed by hand in App Store Connect. Run ' +
        'the converted app locally with `npx extension build --browser safari ' +
        '--bundle-id <id> --development-team <TEAM>`: an ad-hoc build without ' +
        'a team stops answering after Safari relaunches.'
    ),
    '',
    '## Version history',
    '',
    ...paragraph(
      'One line per version and store attempt with its outcome, newest first, ' +
        'for example "0.1.0: Chrome draft uploaded 2026-10-21, AMO upload ' +
        'refused 401 bad key pair, Edge draft pending".'
    ),
    ''
  )

  for (const line of versionHistory) {
    add(...wrap(line, {first: '- ', indent: '  '}))
  }

  return `${out.join('\n')}\n`
}

export function renderExample(example) {
  const manifest = readJson(example.manifestPath)
  const packagePath = path.join(example.dir, 'package.json')
  const packageJson = fs.existsSync(packagePath) ? readJson(packagePath) : null
  const metaPath = path.join(example.dir, META_FILENAME)
  const seed = fs.existsSync(metaPath) ? readJson(metaPath).store || {} : {}

  return renderStoreMd({manifest, packageJson, seed, slug: example.slug})
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const examplesDir = path.resolve(
    opts.examplesDir || path.join(__dirname, '..', '..', 'examples')
  )

  if (!fs.existsSync(examplesDir)) {
    console.error(`examples directory not found: ${examplesDir}`)
    process.exit(1)
  }

  const examples = collectExamples(examplesDir, opts.only)
  const stale = []
  let written = 0

  for (const example of examples) {
    const storePath = path.join(example.dir, STORE_FILENAME)
    const next = renderExample(example)
    const current = fs.existsSync(storePath)
      ? fs.readFileSync(storePath, 'utf8')
      : null

    if (current === next) continue

    if (opts.check) {
      stale.push(`${example.slug}/${STORE_FILENAME}`)
      continue
    }

    fs.writeFileSync(storePath, next)
    written++
  }

  if (opts.check) {
    if (stale.length) {
      console.error(
        `generate-store-md: ${stale.length} of ${examples.length} STORE.md files differ from what the generator writes:\n` +
          stale.map((line) => `  ${line}`).join('\n') +
          '\nEdit the manifest or the store seed in template.meta.json, then run pnpm catalog:store-md.'
      )

      process.exit(1)
    }

    console.log(
      `generate-store-md: ${examples.length} STORE.md files match their manifest and seed`
    )

    return
  }

  console.log(
    `generate-store-md: wrote ${written} of ${examples.length} STORE.md files`
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main()
