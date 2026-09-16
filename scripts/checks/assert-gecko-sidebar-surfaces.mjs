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
// with the refusal landing only in the background console. These three rules
// keep that shape from coming back on the next template copied from another.
const HINT_TEXT = 'Use the toolbar icon to open the sidebar'
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.extension'])

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

// Returns the body of every runtime.onMessage.addListener(...) call, matched by
// balancing parentheses rather than by regex: a listener body holds its own
// parens and a lazy match would stop at the first one.
function messageListenerBodies(source) {
  const bodies = []
  const needle = 'onMessage.addListener('
  let from = source.indexOf(needle)

  while (from !== -1) {
    const open = from + needle.length - 1
    let depth = 0
    let cursor = open

    while (cursor < source.length) {
      if (source[cursor] === '(') depth += 1
      else if (source[cursor] === ')') {
        depth -= 1
        if (depth === 0) break
      }

      cursor += 1
    }

    bodies.push(source.slice(open, cursor))
    from = source.indexOf(needle, cursor)
  }

  return bodies
}

const problems = []

for (const file of walk(EXAMPLES_DIR)) {
  if (!/\.(ts|tsx|js|jsx|vue|svelte)$/.test(file)) continue

  const source = fs.readFileSync(file, 'utf8')

  // Rule 1. Nothing may open a sidebar from a message listener. The call is
  // compiled into gecko builds whenever the branch guarding it can be true.
  for (const body of messageListenerBodies(source)) {
    if (body.includes('sidebarAction.open')) {
      problems.push(
        `${relative(file)}: calls sidebarAction.open() inside a message ` +
          `listener. Firefox refuses it outside a user input handler, so the ` +
          `control is dead. Use the toolbar action, or open the page in a tab.`
      )
    }
  }

  // Rule 2. A template that ships the pill must also ship the gecko hint, so a
  // Firefox build renders something inert and self-explaining, not a button.
  const shipsPill =
    source.includes("'content_pill'") || source.includes('"content_pill"')

  if (shipsPill && !source.includes('content_pill_static')) {
    problems.push(
      `${relative(file)}: renders .content_pill with no ` +
        `.content_pill_static branch, so a Firefox build ships a clickable ` +
        `pill that cannot open anything. Render the hint on gecko instead.`
    )
  }

  if (source.includes('content_pill_static') && !source.includes(HINT_TEXT)) {
    problems.push(
      `${relative(file)}: has a static pill but not the agreed copy ` +
        `"${HINT_TEXT}".`
    )
  }
}

// Rule 3. A sidebar body that is a full viewport tall AND carries a margin sits
// its content half the margin below centre and overflows by twice the margin.
for (const file of walk(EXAMPLES_DIR)) {
  if (!file.endsWith(path.join('src', 'sidebar', 'styles.css'))) continue

  const source = fs.readFileSync(file, 'utf8')
  const body = source.match(/\bbody\s*\{([^}]*)\}/)

  if (!body) continue

  const rules = body[1]
  const hasViewportHeight = /height:\s*100vh/.test(rules)
  const hasMargin = /\bmargin:\s*[^;]*var\(--sidebar-margin\)/.test(rules)

  if (hasViewportHeight && hasMargin) {
    problems.push(
      `${relative(file)}: body sets height: 100vh together with a margin, so ` +
        `the panel content sits below centre and overflows. Subtract the ` +
        `margin: height: calc(100vh - 2 * var(--sidebar-margin)).`
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
    continue
  }

  const sidebar = manifest['firefox:sidebar_action'] || manifest.sidebar_action

  if (sidebar && sidebar.browser_style !== false) {
    problems.push(
      `${relative(file)}: the Firefox sidebar_action does not set ` +
        `"browser_style": false, so Firefox restyles the panel and it renders ` +
        `differently from Chromium. Set it to false.`
    )
  }
}

if (problems.length) {
  console.error('Gecko sidebar surface check FAILED:\n')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error(`\n${problems.length} problem(s).`)
  process.exit(1)
}

console.log('Gecko sidebar surfaces OK: no dead controls, no off-centre panel.')
