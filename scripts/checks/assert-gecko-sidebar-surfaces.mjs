#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const EXAMPLES_DIR = path.join(REPO_ROOT, 'examples')

// Firefox refuses sidebarAction.open() outside a user input handler, and the
// gesture does not survive a runtime.sendMessage hop (MDN; bugzilla 1392624).
// A pill that calls it from the background therefore does nothing, forever,
// with the refusal landing only in the background console. These rules keep
// that shape from coming back on the next template copied from another.
const HINT_TEXT = 'Use the toolbar icon to open the sidebar'
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.extension'])

// A guard that scans nothing passes everything. These floors are the count of
// each surface today, minus room to delete one template without a false alarm.
const MIN_PILL_FILES = 12
const MIN_SIDEBAR_STYLESHEETS = 12
const MIN_SIDEBAR_MANIFESTS = 15

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (SKIP_DIRS.has(entry.name)) continue

    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }

  return out
}

function relative(file) {
  return path.relative(REPO_ROOT, file)
}

// Blanks comments only, keeping strings intact: a class name lives in a string,
// so presence tests still see it, while a pasted comment can no longer stand in
// for a fix.
function blankComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(
      /(^|[^:])\/\/[^\n]*/g,
      (match, lead) => lead + ' '.repeat(match.length - lead.length)
    )
}

// Blanks out comments and the inside of string and template literals, keeping
// length and line breaks. The paren balancer below then cannot be thrown off by
// a ")" inside either.
function blankNonCode(source) {
  const out = source.split('')
  let state = 'code'
  let quote = ''

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    const next = source[i + 1]

    if (state === 'code') {
      if (char === '/' && next === '/') state = 'line-comment'
      else if (char === '/' && next === '*') state = 'block-comment'
      else if (char === "'" || char === '"' || char === '`') {
        state = 'string'
        quote = char
        continue
      } else continue

      out[i] = ' '
      continue
    }

    if (state === 'line-comment') {
      if (char === '\n') state = 'code'
      else out[i] = ' '

      continue
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        out[i] = ' '
        out[i + 1] = ' '
        i += 1
        state = 'code'
      } else if (char !== '\n') out[i] = ' '

      continue
    }

    if (state === 'string') {
      if (char === '\\') {
        out[i] = ' '
        if (next !== undefined && next !== '\n') out[i + 1] = ' '

        i += 1
        continue
      }

      if (char === quote) {
        state = 'code'
        quote = ''
        continue
      }

      if (char !== '\n') out[i] = ' '
    }
  }

  return out.join('')
}

// Returns the body of every runtime.onMessage.addListener(...) call, matched by
// balancing parentheses rather than by regex: a listener body holds its own
// parens and a lazy match would stop at the first one. Runs on blanked source
// so a paren inside a string or comment cannot end the slice early.
function messageListenerBodies(code) {
  const bodies = []
  const needle = 'onMessage.addListener('
  let from = code.indexOf(needle)

  while (from !== -1) {
    const open = from + needle.length - 1
    let depth = 0
    let cursor = open

    while (cursor < code.length) {
      if (code[cursor] === '(') depth += 1
      else if (code[cursor] === ')') {
        depth -= 1
        if (depth === 0) break
      }

      cursor += 1
    }

    bodies.push(code.slice(open, cursor))
    from = code.indexOf(needle, cursor)
  }

  return bodies
}

const problems = []
const counted = {pills: 0, stylesheets: 0, manifests: 0}

for (const file of walk(EXAMPLES_DIR)) {
  if (!/\.(ts|tsx|js|jsx|vue|svelte)$/.test(file)) continue

  // Template sources only. A spec file names these classes to assert on them.
  if (!file.includes(`${path.sep}src${path.sep}`)) continue

  const source = fs.readFileSync(file, 'utf8')
  const text = blankComments(source)
  const code = blankNonCode(source)

  // Rule 1. Nothing may open a sidebar from a message listener, whether the
  // call sits in the listener or in a handler the listener names.
  const sidebarOpeners = new Set()
  const openerDeclaration =
    /(?:function\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=)[^\n]*\n?[\s\S]{0,400}?sidebarAction\.open/g

  for (const match of source.matchAll(openerDeclaration)) {
    const name = match[1] || match[2]
    if (name) sidebarOpeners.add(name)
  }

  for (const body of messageListenerBodies(code)) {
    const callsDirectly = body.includes('sidebarAction.open')
    // The handler may be called in the body or passed to the listener by name,
    // so an identifier reference is the test, not a call with parentheses.
    const relayed = [...sidebarOpeners].find((name) =>
      new RegExp(`\\b${name}\\b`).test(body)
    )

    if (callsDirectly || relayed) {
      problems.push(
        `${relative(file)}: opens the sidebar from a message listener` +
          (relayed && !callsDirectly ? ` (via ${relayed}())` : '') +
          `. Firefox refuses sidebarAction.open() outside a user input ` +
          `handler, so the control is dead. Use the toolbar action, or open ` +
          `the page in a tab.`
      )
    }
  }

  // Rule 2. A template that ships the pill must also ship the gecko hint, so a
  // Firefox build renders something inert and self-explaining, not a button.
  const shipsPill = /content_pill(?![_a-z])/.test(text)

  if (!shipsPill) continue

  counted.pills += 1

  if (!text.includes('content_pill_static')) {
    problems.push(
      `${relative(file)}: renders .content_pill with no ` +
        `.content_pill_static branch, so a Firefox build ships a clickable ` +
        `pill that cannot open anything. Render the hint on gecko instead.`
    )
  }

  if (!text.includes(HINT_TEXT)) {
    problems.push(
      `${relative(file)}: has a pill but not the agreed gecko copy ` +
        `"${HINT_TEXT}".`
    )
  }

  // The static class alone proves nothing: it has to be chosen at build time
  // off the browser family, or every build renders the same pill.
  const decidesByBrowser =
    /isFirefoxLike|isGeckoLike|EXTENSION_PUBLIC_BROWSER/.test(text)

  if (!decidesByBrowser) {
    problems.push(
      `${relative(file)}: ships the pill without testing the browser family, ` +
        `so the static and clickable shapes are not selected per build. Gate ` +
        `them on the same isFirefoxLike test the sibling templates use.`
    )
  }
}

// Rule 3. A sidebar body that is a full viewport tall AND carries a margin sits
// its content half the margin below centre and overflows by twice the margin.
// Rule 5. That same body must name a font, or Firefox renders the panel serif.
for (const file of walk(EXAMPLES_DIR)) {
  if (!file.endsWith(path.join('src', 'sidebar', 'styles.css'))) continue

  const source = fs.readFileSync(file, 'utf8')
  const bodyBlocks = [...source.matchAll(/(^|[,{}\s])body\s*\{([^}]*)\}/g)]

  if (bodyBlocks.length === 0) continue

  counted.stylesheets += 1

  for (const block of bodyBlocks) {
    const rules = block[2]
    const hasViewportHeight = /(?:min-)?height:\s*100vh/.test(rules)
    const margin = rules.match(/\bmargin:\s*([^;]*)/)
    const hasMargin = Boolean(margin) && !/^\s*0\s*$/.test(margin[1])

    if (hasViewportHeight && hasMargin) {
      problems.push(
        `${relative(file)}: body sets a 100vh height together with a margin, ` +
          `so the panel content sits below centre and overflows. Subtract the ` +
          `margin: height: calc(100vh - 2 * var(--sidebar-margin)).`
      )
    }
  }

  const declaresFont = bodyBlocks.some((block) => /font-family:/.test(block[2]))

  if (!declaresFont) {
    problems.push(
      `${relative(file)}: the sidebar body sets no font-family, so Firefox ` +
        `falls back to serif in the panel. A stack on html does not help: a ` +
        `panel stylesheet that names body is what survives the reset.`
    )
  }
}

// Rule 4. A Manifest V2 sidebar_action defaults browser_style to true, so
// Firefox injects its own stylesheet into the panel. It resets header
// text-align to start and the root font to 13px, which left an inline logo
// flush left under centred text. Chromium has no such sheet.
for (const file of walk(EXAMPLES_DIR)) {
  if (path.basename(file) !== 'manifest.json') continue
  if (!file.includes(`${path.sep}src${path.sep}`)) continue

  let manifest

  try {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    problems.push(
      `${relative(file)}: is not valid JSON, so it was not checked.`
    )

    continue
  }

  // Any vendor prefix the CLI honours selects the same gecko surface.
  const sidebarKey = Object.keys(manifest).find((key) =>
    /^(?:firefox|gecko|gecko_android|gecko-based)?:?sidebar_action$/.test(key)
  )

  const sidebar = sidebarKey ? manifest[sidebarKey] : undefined

  if (!sidebar) continue

  counted.manifests += 1

  if (sidebar.browser_style !== false) {
    problems.push(
      `${relative(file)}: ${sidebarKey} does not set ` +
        `"browser_style": false, so Firefox restyles the panel and it renders ` +
        `differently from Chromium. Set it to false.`
    )
  }
}

const floors = [
  ['pill files', counted.pills, MIN_PILL_FILES],
  ['sidebar stylesheets', counted.stylesheets, MIN_SIDEBAR_STYLESHEETS],
  ['sidebar manifests', counted.manifests, MIN_SIDEBAR_MANIFESTS]
]

for (const [label, seen, floor] of floors) {
  if (seen < floor) {
    problems.push(
      `checked only ${seen} ${label}, expected at least ${floor}. Either the ` +
        `scan stopped matching or templates were removed. A guard that ` +
        `matches nothing is not a guard.`
    )
  }
}

if (problems.length) {
  console.error('Gecko sidebar surface check FAILED:\n')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error(`\n${problems.length} problem(s).`)
  process.exit(1)
}

console.log(
  `Gecko sidebar surfaces OK: ${counted.pills} pill file(s), ` +
    `${counted.stylesheets} sidebar stylesheet(s), ` +
    `${counted.manifests} sidebar manifest(s).`
)
