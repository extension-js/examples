#!/usr/bin/env node
//
// Regenerate every example's README.md from real signals (manifest, deps,
// file tree, template.meta.json) plus a small per-slug overrides table.
//
// Usage:
//   node scripts/update-template-readmes.mjs [--dry-run]
//                                            [--only=slug,slug]
//                                            [--examples-dir=<path>]
//
// The companion `programs/create/steps/write-readme-file.ts` always
// overwrites the template's README at scaffold time, so the rich
// template-specific READMEs produced here are only seen by people
// browsing the examples repo on GitHub.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ──────────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {dryRun: false, only: null, examplesDir: null}
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true
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

const opts = parseArgs(process.argv.slice(2))
const examplesDir = path.resolve(
  opts.examplesDir || path.join(__dirname, '..', 'examples')
)

if (!fs.existsSync(examplesDir)) {
  console.error(`examples directory not found: ${examplesDir}`)
  process.exit(1)
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function exists(p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function listSlugs(dir) {
  return fs
    .readdirSync(dir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .sort()
}

function listSrcFiles(srcDir, depth = 3) {
  if (!isDir(srcDir)) return []
  const out = []
  const walk = (dir, currentDepth, prefix) => {
    if (currentDepth > depth) return
    const entries = fs
      .readdirSync(dir, {withFileTypes: true})
      .filter((e) => !e.name.startsWith('.'))
      .filter((e) => e.name !== 'node_modules' && e.name !== 'dist')
      .sort((a, b) => {
        // directories first for nicer trees
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    entries.forEach((entry) => {
      out.push({
        path: path.posix.join(prefix, entry.name),
        isDirectory: entry.isDirectory()
      })
      if (entry.isDirectory()) {
        walk(
          path.join(dir, entry.name),
          currentDepth + 1,
          path.posix.join(prefix, entry.name)
        )
      }
    })
  }
  walk(srcDir, 1, '')
  return out
}

function renderTree(files, root) {
  if (files.length === 0) return ''
  const header = root === '.' ? '.' : `${root}/`
  const lines = [header]
  // Build a children-by-parent map.
  const childrenByParent = new Map()
  for (const file of files) {
    const parent = path.posix.dirname(file.path) || '.'
    const arr = childrenByParent.get(parent) || []
    arr.push(file)
    childrenByParent.set(parent, arr)
  }
  const render = (parent, prefix) => {
    const children = childrenByParent.get(parent) || []
    children.forEach((entry, i) => {
      const isLast = i === children.length - 1
      const branch = isLast ? '└── ' : '├── '
      const label = entry.isDirectory
        ? `${path.posix.basename(entry.path)}/`
        : path.posix.basename(entry.path)
      lines.push(`${prefix}${branch}${label}`)
      if (entry.isDirectory) {
        const childPrefix = prefix + (isLast ? '    ' : '│   ')
        render(entry.path, childPrefix)
      }
    })
  }
  render('.', '')
  return lines.join('\n')
}

// ──────────────────────────────────────────────────────────────────────────
// Detection — extract per-template facts from real files
// ──────────────────────────────────────────────────────────────────────────

function detectTemplate(templateDir, slug) {
  const packageJson = readJsonSafe(path.join(templateDir, 'package.json')) || {}

  // Monorepo templates park manifest + sources under packages/<extension>/src.
  // Probe a few common shapes before falling back to flat layouts.
  const monorepoSrcCandidates = [
    path.join(templateDir, 'packages', 'extension', 'src'),
    path.join(templateDir, 'packages', 'extension-app', 'src'),
    path.join(templateDir, 'apps', 'extension', 'src')
  ]
  const monorepoSrcDir = monorepoSrcCandidates.find((dir) => isDir(dir))
  const manifest =
    readJsonSafe(path.join(templateDir, 'src', 'manifest.json')) ||
    (monorepoSrcDir
      ? readJsonSafe(path.join(monorepoSrcDir, 'manifest.json'))
      : null) ||
    readJsonSafe(path.join(templateDir, 'manifest.json')) ||
    {}
  const meta = readJsonSafe(path.join(templateDir, 'template.meta.json')) || {}
  const description = String(
    manifest.description || packageJson.description || ''
  ).trim()
  const screenshotPath = path.join(templateDir, 'public', 'screenshot.png')
  const hasScreenshot = exists(screenshotPath)
  const hasTemplateSpec = exists(path.join(templateDir, 'template.spec.ts'))
  const isMonorepo =
    exists(path.join(templateDir, 'pnpm-workspace.yaml')) ||
    exists(path.join(templateDir, 'turbo.json')) ||
    isDir(path.join(templateDir, 'packages'))

  // Surfaces from manifest
  const surfaces = new Set()
  if (manifest.action || manifest['chromium:action']) surfaces.add('action')
  if (
    manifest.background ||
    manifest['chromium:background'] ||
    manifest['firefox:background']
  ) {
    surfaces.add('background')
  }
  if (
    manifest['chromium:side_panel'] ||
    manifest['firefox:sidebar_action'] ||
    manifest.side_panel ||
    manifest.sidebar_action
  ) {
    surfaces.add('sidebar')
  }
  if (
    (manifest.chrome_url_overrides &&
      Object.keys(manifest.chrome_url_overrides).length > 0) ||
    (manifest['chromium:chrome_url_overrides'] &&
      Object.keys(manifest['chromium:chrome_url_overrides']).length > 0)
  ) {
    surfaces.add('newtab-or-overrides')
  }
  if (
    Array.isArray(manifest.content_scripts) &&
    manifest.content_scripts.length > 0
  ) {
    surfaces.add('content')
  }
  if (manifest.devtools_page) surfaces.add('devtools')
  if (manifest.options_ui || manifest.options_page) surfaces.add('options')
  if (isDir(path.join(templateDir, 'src', 'pages'))) surfaces.add('pages')
  if (isDir(path.join(templateDir, 'src', 'scripts'))) surfaces.add('scripts')
  // Top-level special folders (project root, sibling to src/) — these are
  // auto-discovered entrypoints in the bundler, not declared in manifest.
  const topLevelPagesDir = isDir(path.join(templateDir, 'pages'))
    ? path.join(templateDir, 'pages')
    : null
  const topLevelScriptsDir = isDir(path.join(templateDir, 'scripts'))
    ? path.join(templateDir, 'scripts')
    : null
  if (topLevelPagesDir) surfaces.add('pages')
  if (topLevelScriptsDir) surfaces.add('scripts')

  // Framework + lang from deps
  const deps = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {})
  }
  const has = (name) => Object.prototype.hasOwnProperty.call(deps, name)
  let framework = 'vanilla'
  if (has('react')) framework = 'react'
  else if (has('preact')) framework = 'preact'
  else if (has('vue')) framework = 'vue'
  else if (has('svelte')) framework = 'svelte'
  else if (has('solid-js')) framework = 'solid'
  const isTypeScript =
    has('typescript') ||
    exists(path.join(templateDir, 'tsconfig.json')) ||
    slug.includes('typescript')

  // CSS pipeline
  const cssTags = []
  if (has('tailwindcss') || has('@tailwindcss/postcss'))
    cssTags.push('Tailwind')
  if (has('sass') || has('sass-embedded')) cssTags.push('Sass')
  if (has('less')) cssTags.push('Less')
  if (
    slug.includes('css-modules') ||
    slug.includes('sass-modules') ||
    slug.includes('less-modules')
  ) {
    cssTags.push('CSS Modules')
  }
  if (has('postcss')) cssTags.push('PostCSS')

  // UI kit hints
  const uiTags = []
  if (Object.keys(deps).some((d) => d.startsWith('@radix-ui/'))) {
    uiTags.push('Radix / shadcn primitives')
  }
  if (
    has('antd') ||
    Object.keys(deps).some((d) => d.startsWith('@ant-design/'))
  ) {
    uiTags.push('Ant Design')
  }
  if (has('lucide-react')) uiTags.push('lucide-react')
  if (has('@xenova/transformers') || has('@huggingface/transformers')) {
    uiTags.push('Transformers.js')
  }
  if (has('@anthropic-ai/sdk')) uiTags.push('Anthropic SDK')
  if (has('openai')) uiTags.push('OpenAI SDK')

  // Find src dir and tree. Monorepo layouts render their workspace tree
  // (packages/) instead, so users see how the extension package fits.
  // Templates with top-level special folders (pages/, scripts/) render
  // a project-rooted tree that includes both the src/ and the special
  // folder so the convention is visible at a glance.
  let srcDir = null
  let srcFiles = []
  let layoutLabel = 'src'
  const hasTopLevelSpecial = !!(topLevelPagesDir || topLevelScriptsDir)
  if (hasTopLevelSpecial) {
    srcDir = templateDir
    srcFiles = []
    if (isDir(path.join(templateDir, 'src'))) {
      const srcSubFiles = listSrcFiles(path.join(templateDir, 'src'))
      srcFiles.push({path: 'src', isDirectory: true})
      srcSubFiles.forEach((entry) => {
        srcFiles.push({
          path: path.posix.join('src', entry.path),
          isDirectory: entry.isDirectory
        })
      })
    }
    if (topLevelPagesDir) {
      const pagesFiles = listSrcFiles(topLevelPagesDir)
      srcFiles.push({path: 'pages', isDirectory: true})
      pagesFiles.forEach((entry) => {
        srcFiles.push({
          path: path.posix.join('pages', entry.path),
          isDirectory: entry.isDirectory
        })
      })
    }
    if (topLevelScriptsDir) {
      const scriptsFiles = listSrcFiles(topLevelScriptsDir)
      srcFiles.push({path: 'scripts', isDirectory: true})
      scriptsFiles.forEach((entry) => {
        srcFiles.push({
          path: path.posix.join('scripts', entry.path),
          isDirectory: entry.isDirectory
        })
      })
    }
    layoutLabel = '.'
  } else if (isDir(path.join(templateDir, 'src'))) {
    srcDir = path.join(templateDir, 'src')
    srcFiles = listSrcFiles(srcDir)
  } else if (monorepoSrcDir && isDir(path.join(templateDir, 'packages'))) {
    srcDir = path.join(templateDir, 'packages')
    srcFiles = listSrcFiles(srcDir, 4)
    layoutLabel = 'packages'
  }

  return {
    slug,
    templateDir,
    packageJson,
    manifest,
    meta,
    description,
    hasScreenshot,
    hasTemplateSpec,
    isMonorepo,
    surfaces,
    framework,
    isTypeScript,
    cssTags,
    uiTags,
    srcDir,
    srcFiles,
    layoutLabel,
    deps
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Per-slug overrides (extra prose, never a structure swap)
// ──────────────────────────────────────────────────────────────────────────

const OVERRIDES = {
  init: {
    title: 'Starter Extension (init)',
    extra:
      'The default starter — what `npx extension@latest create <name>` ' +
      'produces when no `--template` is passed. A small sidebar panel ' +
      'wired with dev / build / preview scripts.'
  },
  javascript: {
    title: 'JavaScript Starter Extension',
    extra:
      'Plain JavaScript starter. Useful as a baseline when you want to ' +
      'add framework or tooling support yourself, layer by layer.'
  },
  typescript: {
    title: 'TypeScript Starter Extension',
    extra:
      'TypeScript starter wired through `tsconfig.json`. Extension.js ' +
      'generates ambient types for the Web Extension APIs and the bundler ' +
      'transpiles `.ts` / `.tsx` automatically.'
  },
  playwright: {
    title: 'Playwright E2E Starter',
    extra:
      'Designed for Playwright-driven E2E tests. The template ships a ' +
      'sidebar panel together with a Playwright fixture (`extension-fixtures`) ' +
      'so you can drive the extension from a real browser session in CI.'
  },
  'content-main-world': {
    title: 'Content Script in MAIN World Example',
    extra:
      "Loads the content script in the page's **MAIN world** (Chromium-only). " +
      'Useful when your script needs direct access to page-side globals or ' +
      'classes that the isolated world cannot reach. Firefox does not ' +
      'support MAIN-world content scripts, so this template is gated to ' +
      'Chromium targets.'
  },
  'content-css-modules': {
    extra:
      'CSS Modules pipeline with locally-scoped class names. Imported ' +
      'styles are hashed at build time so the injected UI is immune to ' +
      'host-page CSS bleed.'
  },
  'content-sass-modules': {
    extra:
      'Sass-flavored CSS Modules. Combines `.module.scss` files with ' +
      'class-name hashing for fully isolated, nested styles.'
  },
  'content-less-modules': {
    extra:
      'Less-flavored CSS Modules. Combines `.module.less` files with ' +
      'class-name hashing for fully isolated styles.'
  },
  'content-multi-one-entry': {
    extra:
      'A single content-script entry that targets multiple URL patterns ' +
      'declared in `manifest.json#content_scripts`.'
  },
  'content-multi-three-entries': {
    extra:
      'Three independent content-script entries, each scoped to its own ' +
      'URL match. Demonstrates that multiple `content_scripts` blocks ' +
      'each get their own bundle.'
  },
  'special-folders-pages': {
    title: 'Special Folders (Pages) Example',
    extra:
      "Demonstrates Extension.js's **`pages/`** convention: every HTML file " +
      'inside the project-root `pages/` directory becomes an entrypoint ' +
      'without manifest wiring. The background script opens ' +
      '`pages/welcome.html` on install / startup.'
  },
  'special-folders-scripts': {
    title: 'Special Folders (Scripts) Example',
    extra:
      'Demonstrates the **`scripts/`** convention: standalone scripts inside ' +
      'the project-root `scripts/` directory are bundled as separate entries, ' +
      'ready to be referenced from `manifest.json` (e.g. as `chrome_settings_overrides`) ' +
      'or executed at runtime via `chrome.scripting.*`.'
  },
  'sidebar-shadcn': {
    title: 'React Sidebar (shadcn/ui) Example',
    extra:
      'A React sidebar built with [shadcn/ui](https://ui.shadcn.com/) ' +
      'primitives over Radix UI and Tailwind v4. Cards, switches, and ' +
      'labels are composed from the registry, not pulled from a UI ' +
      'library — the components live inside the project under ' +
      '`src/components/ui/`.'
  },
  'ai-claude': {
    title: 'AI Sidebar (Claude / Anthropic) Example',
    extra:
      'Conversational sidebar wired to the [Anthropic SDK](https://docs.anthropic.com/). ' +
      'Paste a key the first time you open the panel — it lives in ' +
      '`chrome.storage.local`, never leaves the device — and chat with ' +
      "Claude inline next to whatever page you're on. Shares its layout " +
      'and shadcn/ui primitives with the `ai-chatgpt`, `ai-gemini`, ' +
      'and `ai-perplexity` siblings; only the SDK and brand accent change.'
  },
  'ai-chatgpt': {
    title: 'AI Sidebar (ChatGPT / OpenAI) Example',
    extra:
      'Conversational sidebar wired to the [OpenAI SDK](https://platform.openai.com/docs/api-reference/chat). ' +
      'Paste an `sk-...` key the first time you open the panel — it lives ' +
      'in `chrome.storage.local`, never leaves the device — and chat with ' +
      "ChatGPT inline next to whatever page you're on. Shares its layout " +
      'and shadcn/ui primitives with the `ai-claude`, `ai-gemini`, ' +
      'and `ai-perplexity` siblings; only the SDK and brand accent change.'
  },
  'ai-gemini': {
    title: 'AI Sidebar (Gemini / Google) Example',
    extra:
      'Conversational sidebar wired to the [Google Generative AI SDK](https://ai.google.dev/gemini-api/docs). ' +
      'Paste a Google AI Studio key the first time you open the panel — it ' +
      'lives in `chrome.storage.local`, never leaves the device — and chat ' +
      "with Gemini inline next to whatever page you're on. Shares its " +
      'layout and shadcn/ui primitives with the `ai-claude`, ' +
      '`ai-chatgpt`, and `ai-perplexity` siblings; only the SDK ' +
      'and brand accent change.'
  },
  'ai-perplexity': {
    title: 'AI Sidebar (Perplexity) Example',
    extra:
      'Conversational sidebar wired to the [Perplexity API](https://docs.perplexity.ai/) ' +
      '— online-search-grounded models served through an OpenAI-compatible ' +
      'endpoint, so the same `openai` SDK is reused with a different ' +
      '`baseURL`. Paste a `pplx-...` key the first time you open the ' +
      'panel — it lives in `chrome.storage.local`, never leaves the ' +
      'device — and ask Perplexity questions that get answered with live ' +
      'citations. Shares its layout and shadcn/ui primitives with the ' +
      '`ai-claude`, `ai-chatgpt`, and `ai-gemini` siblings.'
  },
  'sidebar-transformers-js': {
    title: 'React Sidebar (Transformers.js) Example',
    extra:
      'Sidebar that runs [Transformers.js](https://huggingface.co/docs/transformers.js) ' +
      'models in the browser via WebGPU/WASM. No server, no API key — the ' +
      'model and tokenizer are loaded from the Hugging Face Hub on first run.'
  },
  'sidebar-monorepo-turbopack': {
    title: 'React Sidebar (Monorepo + Turborepo) Example',
    extra:
      'A pnpm workspace + Turborepo setup. The extension lives under ' +
      '`packages/extension`; root scripts target it via `extension <command> ' +
      'packages/extension`. Useful as a starting point when an extension ' +
      'shares code with web / mobile apps in the same monorepo.'
  },
  'sidebar-antd': {
    title: 'React Sidebar (Ant Design) Example',
    extra:
      'React sidebar rendering [Ant Design](https://ant.design/) and ' +
      '[Ant Design X](https://x.ant.design/) components. Doubles as ' +
      'regression coverage for [issue #445](https://github.com/extension-js/extension.js/issues/445) ' +
      "— the bundler's exports-condition resolution must route CJS " +
      "requires through `require` so `@babel/runtime` helpers don't " +
      'crash with `_interopRequireDefault is not a function`.'
  },
  'action-locales': {
    title: 'Action Popup (i18n / Locales) Example',
    extra:
      'Demonstrates the `_locales/` directory and `chrome.i18n.*` APIs. ' +
      "The popup pulls strings from the user's active locale; add another " +
      '`_locales/<lang>/messages.json` to localize.'
  },
  'new-config-eslint': {
    extra:
      'Includes a working ESLint config alongside the extension. Lint your ' +
      'sources with `npx eslint .`.'
  },
  'new-config-prettier': {
    extra:
      'Includes a Prettier config so formatting stays consistent across ' +
      'editors and CI.'
  },
  'new-config-stylelint': {
    extra:
      'Includes a Stylelint config so CSS / SCSS / LESS files stay ' +
      'consistent across editors and CI.'
  },
  'new-crypto': {
    extra:
      "Demonstrates the bundler's automatic Web Crypto polyfill for " +
      'extension contexts where Node-style `crypto` modules are referenced.'
  },
  'new-env': {
    extra:
      'Reads variables from `.env` at build time. Variables prefixed with ' +
      '`EXTENSION_PUBLIC_` are inlined into the bundle as `import.meta.env.*`.'
  },
  'new-react-router': {
    extra:
      'A new-tab page driven by [React Router](https://reactrouter.com/). ' +
      'Useful for extension UIs that span multiple in-app routes.'
  },
  'new-browser-flags': {
    extra:
      'Demonstrates browser-specific manifest keys (`chromium:*`, `firefox:*`) ' +
      'so a single `manifest.json` ships clean to multiple targets.'
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Title + headline
// ──────────────────────────────────────────────────────────────────────────


function frameworkLabel(framework) {
  switch (framework) {
    case 'react':
      return 'React'
    case 'preact':
      return 'Preact'
    case 'vue':
      return 'Vue'
    case 'svelte':
      return 'Svelte'
    case 'solid':
      return 'Solid'
    default:
      return null
  }
}

function deriveTitle(detected) {
  const override = OVERRIDES[detected.slug]?.title
  if (override) return override

  const fw = frameworkLabel(detected.framework)
  const langLabel = fw
    ? fw
    : detected.isTypeScript
      ? 'TypeScript'
      : 'JavaScript'

  const surface = (() => {
    if (detected.surfaces.has('content')) return 'Content Script'
    if (detected.surfaces.has('sidebar')) return 'Sidebar'
    if (detected.surfaces.has('newtab-or-overrides')) return 'New Tab'
    if (detected.surfaces.has('action')) return 'Action Popup'
    if (detected.surfaces.has('options')) return 'Options Page'
    if (detected.surfaces.has('devtools')) return 'DevTools Panel'
    if (detected.surfaces.has('pages')) return 'Pages'
    if (detected.surfaces.has('scripts')) return 'Scripts'
    return 'Extension'
  })()

  return `${langLabel} ${surface} Example`
}

// ──────────────────────────────────────────────────────────────────────────
// "How it works" auto-prose
// ──────────────────────────────────────────────────────────────────────────

function deriveHowItWorks(detected) {
  const sentences = []
  const fw = frameworkLabel(detected.framework)
  const langPrefix = fw
    ? `a ${fw}${detected.isTypeScript ? ' + TypeScript' : ''}`
    : detected.isTypeScript
      ? 'a TypeScript'
      : 'a JavaScript'

  // Special-folder templates exist primarily to demonstrate the
  // pages/ / scripts/ conventions, not the manifest surfaces underneath
  // them — surface those first when relevant.
  const isSpecialFolders = detected.slug.startsWith('special-folders-')

  if (isSpecialFolders && detected.surfaces.has('pages')) {
    sentences.push(
      `Files inside \`pages/\` are treated as auto-discovered entrypoints ` +
        `— no \`manifest.json\` wiring required. The background script ` +
        `opens one of them on install / startup.`
    )
  } else if (isSpecialFolders && detected.surfaces.has('scripts')) {
    sentences.push(
      `Files inside \`scripts/\` are bundled as standalone script entries, ` +
        `ready to be referenced from \`manifest.json\` or executed at ` +
        `runtime via \`chrome.scripting.*\`.`
    )
  } else if (detected.surfaces.has('content')) {
    sentences.push(
      `A content script mounts ${langPrefix} UI inside a Shadow DOM and ` +
        `applies scoped styles so the host page can't bleed through.`
    )
  } else if (detected.surfaces.has('sidebar')) {
    sentences.push(
      `The manifest registers a side panel (\`chromium:side_panel\` / ` +
        `\`firefox:sidebar_action\`) that loads ${langPrefix} page bundled ` +
        `from \`src/sidebar/\`.`
    )
  } else if (detected.surfaces.has('action')) {
    sentences.push(
      `The manifest registers an \`action\` and points \`default_popup\` at ` +
        `${langPrefix} page bundled from \`src/action/\`.`
    )
  } else if (detected.surfaces.has('newtab-or-overrides')) {
    sentences.push(
      `The manifest overrides the new-tab page and loads ${langPrefix} entry ` +
        `bundled from \`src/newtab/\`.`
    )
  } else if (detected.surfaces.has('pages')) {
    sentences.push(
      `Files inside \`src/pages/\` are treated as auto-discovered entrypoints ` +
        `— no \`manifest.json\` wiring required.`
    )
  } else if (detected.surfaces.has('scripts')) {
    sentences.push(
      `Files inside \`src/scripts/\` are treated as auto-discovered standalone ` +
        `scripts.`
    )
  } else {
    sentences.push(
      `${langPrefix.replace(/^a /, 'A ')} extension scaffold ready for ` +
        `\`extension dev\` / \`extension build\`.`
    )
  }

  if (detected.cssTags.length > 0) {
    sentences.push(`Styles flow through ${detected.cssTags.join(' + ')}.`)
  }
  if (detected.uiTags.length > 0) {
    sentences.push(`UI is composed with ${detected.uiTags.join(', ')}.`)
  }
  if (detected.isMonorepo) {
    sentences.push(
      `The extension lives in a workspace under \`packages/extension/\`; ` +
        `root scripts target it explicitly.`
    )
  }
  return sentences.join(' ')
}

function deriveWhatYoullSee(detected) {
  // The description goes in the blockquote tagline. "What you'll see" is
  // a user-facing line about what shows up on screen — keep it surface-
  // focused so the description doesn't get repeated verbatim.
  const isSpecialFolders = detected.slug.startsWith('special-folders-')
  if (isSpecialFolders && detected.surfaces.has('pages')) {
    return 'A welcome page that opens on install / startup, served from `pages/`.'
  }
  if (isSpecialFolders && detected.surfaces.has('scripts')) {
    return 'Standalone scripts auto-bundled from `scripts/`, runnable via the action popup.'
  }
  if (detected.surfaces.has('content')) {
    const fw = frameworkLabel(detected.framework)
    return fw
      ? `A small ${fw} UI injected into any web page, isolated in a Shadow DOM so site styles don't bleed through.`
      : "A small UI injected into any web page, isolated in a Shadow DOM so site styles don't bleed through."
  }
  if (detected.surfaces.has('sidebar')) {
    return 'A browser side panel that loads when you open the sidebar.'
  }
  if (detected.surfaces.has('action')) {
    return "A toolbar popup that opens when you click the extension's icon."
  }
  if (detected.surfaces.has('newtab-or-overrides')) {
    return 'A custom new-tab page replacing the browser default.'
  }
  if (detected.surfaces.has('pages')) {
    return 'A welcome page that opens on install / startup.'
  }
  if (detected.surfaces.has('scripts')) {
    return 'Standalone scripts auto-bundled from `src/scripts/`.'
  }
  return 'A minimal extension wired with dev / build / preview scripts.'
}

// ──────────────────────────────────────────────────────────────────────────
// README rendering
// ──────────────────────────────────────────────────────────────────────────

function renderReadme(detected) {
  const title = deriveTitle(detected)
  const blockquote = detected.description ? `> ${detected.description}\n\n` : ''
  const screenshotEmbed = detected.hasScreenshot
    ? `![screenshot](./public/screenshot.png)\n\n`
    : ''

  const tree = renderTree(detected.srcFiles, detected.layoutLabel || 'src')
  const projectLayout = tree
    ? `## Project layout\n\n\`\`\`\n${tree}\n\`\`\`\n\n`
    : ''

  const override = OVERRIDES[detected.slug]?.extra
  const overrideBlock = override ? `${override}\n\n` : ''

  const installCmd = `npx extension@latest create my-${detected.slug} --template ${detected.slug}`
  const cdLine = `cd my-${detected.slug}`

  const testsBlock = detected.hasTemplateSpec
    ? `## Tests\n\nThis template ships an end-to-end check (\`template.spec.ts\`) ` +
      `validated by the examples-repo CI on every commit.\n\n`
    : ''

  return (
    `[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe\n` +
    `[powered-url]: https://extension.js.org\n` +
    `\n` +
    `![Powered by Extension.js][powered-image]\n` +
    `\n` +
    `# ${title}\n` +
    `\n` +
    blockquote +
    screenshotEmbed +
    `**What you'll see**: ${deriveWhatYoullSee(detected)}\n` +
    `\n` +
    `**How it works**: ${deriveHowItWorks(detected)}\n` +
    `\n` +
    overrideBlock +
    `## Try it locally\n` +
    `\n` +
    `\`\`\`bash\n` +
    `${installCmd}\n` +
    `${cdLine}\n` +
    `npm install\n` +
    `npm run dev\n` +
    `\`\`\`\n` +
    `\n` +
    `A fresh browser window opens with the extension already loaded.\n` +
    `\n` +
    projectLayout +
    `## Commands\n` +
    `\n` +
    `### dev\n` +
    `\n` +
    `Run the extension in development mode. Target a browser with \`--browser\`:\n` +
    `\n` +
    `\`\`\`bash\n` +
    `npm run dev                 # Chromium (default)\n` +
    `npm run dev -- --browser=chrome\n` +
    `npm run dev -- --browser=edge\n` +
    `npm run dev -- --browser=firefox\n` +
    `\`\`\`\n` +
    `\n` +
    `### build\n` +
    `\n` +
    `Build for production. Convenience scripts cover each browser:\n` +
    `\n` +
    `\`\`\`bash\n` +
    `npm run build           # Chrome (default)\n` +
    `npm run build:firefox\n` +
    `npm run build:edge\n` +
    `\`\`\`\n` +
    `\n` +
    `### preview\n` +
    `\n` +
    `Preview the production build with the bundled browser:\n` +
    `\n` +
    `\`\`\`bash\n` +
    `npm run preview\n` +
    `\`\`\`\n` +
    `\n` +
    testsBlock +
    `## Learn more\n` +
    `\n` +
    `- [Extension.js docs](https://extension.js.org)\n` +
    `- [Templates index](https://extension.js.org/docs/getting-started/templates)\n` +
    `- [GitHub: extension-js/extension.js](https://github.com/extension-js/extension.js)\n`
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Driver
// ──────────────────────────────────────────────────────────────────────────

function processSlug(slug) {
  const templateDir = path.join(examplesDir, slug)
  if (!isDir(templateDir)) return null
  // Only treat directories that look like templates (have package.json or manifest)
  const looksLikeTemplate =
    exists(path.join(templateDir, 'package.json')) ||
    exists(path.join(templateDir, 'src', 'manifest.json')) ||
    exists(path.join(templateDir, 'manifest.json'))
  if (!looksLikeTemplate) return null

  const detected = detectTemplate(templateDir, slug)
  const readme = renderReadme(detected)
  const readmePath = path.join(templateDir, 'README.md')

  let prev = ''
  try {
    prev = fs.readFileSync(readmePath, 'utf8')
  } catch {
    // README doesn't exist yet — treat as empty so we always (re)write.
  }
  const changed = prev !== readme

  const notes = []
  if (!detected.hasScreenshot) notes.push('no screenshot — embed skipped')
  if (!detected.description) notes.push('manifest has no description')
  if (!detected.hasTemplateSpec) notes.push('no template.spec.ts')
  if (!detected.srcDir) notes.push('no src/ — project layout skipped')

  if (!opts.dryRun && changed) {
    fs.writeFileSync(readmePath, readme)
  }
  return {slug, changed, notes, readmePath}
}

const slugs = listSlugs(examplesDir)
const filtered = opts.only ? slugs.filter((s) => opts.only.has(s)) : slugs
const results = []
for (const slug of filtered) {
  const r = processSlug(slug)
  if (r) results.push(r)
}

const changed = results.filter((r) => r.changed)
const unchanged = results.filter((r) => !r.changed)
const withNotes = results.filter((r) => r.notes.length > 0)

console.log(`scanned ${results.length} template(s) under ${examplesDir}`)
console.log(`  changed:   ${changed.length}`)
console.log(`  unchanged: ${unchanged.length}`)
if (opts.dryRun) console.log('  (dry-run — no files were written)')

if (withNotes.length > 0) {
  console.log('\nnotes:')
  for (const r of withNotes) {
    console.log(`  ${r.slug}: ${r.notes.join(', ')}`)
  }
}
