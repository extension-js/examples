import {test} from '@playwright/test'
import fs from 'fs'
import path from 'path'
import {getDirname} from './dirname.js'
import {resolveBuiltExtensionPath} from './extension-fixtures.js'

// Every file a template ships must be reachable from its manifest, one of its
// pages, its import graph or a special folder, and its README tree must list
// what is on disk. A stranded file survives any number of browser runs, so
// this gate reads the sources instead of driving a browser.

const __dirname = getDirname(import.meta.url)

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.extension'])

const CODE_EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.vue',
  '.svelte'
]
const STYLE_EXTENSIONS = ['.css', '.scss', '.sass', '.less']
const RESOLVE_EXTENSIONS = [
  ...CODE_EXTENSIONS,
  ...STYLE_EXTENSIONS,
  '.json',
  '.html'
]

// Files under a source tree that are inputs to tooling rather than to the
// bundle: ambient types and editor or lint configuration.
const TOOLING_FILE = /(\.d\.ts|\.map)$|^\./

// Templates whose source trees keep a file this walk cannot reach. Each entry
// is exact, so a file that becomes reachable or disappears fails the test and
// retires its exception.
const KNOWN_UNREACHABLE: Record<string, string[]> = {
  // The shadcn kit ships its button primitive for the user to import, the
  // way the ai-* templates built on this layout do. Nothing here renders it.
  'sidebar-shadcn': ['components/ui/button.tsx']
}

function listTemplateDirs(): string[] {
  return fs
    .readdirSync(__dirname, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(__dirname, name, 'package.json')))
    .sort()
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function readJson(p: string): any {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

// The directory that holds manifest.json: src/ for flat templates, the
// extension package's src/ for monorepos.
function findManifestDir(templateDir: string): string | null {
  const candidates = [
    path.join(templateDir, 'src'),
    path.join(templateDir, 'packages', 'extension', 'src'),
    path.join(templateDir, 'packages', 'extension-app', 'src'),
    path.join(templateDir, 'apps', 'extension', 'src'),
    templateDir
  ]

  return (
    candidates.find((dir) => fs.existsSync(path.join(dir, 'manifest.json'))) ??
    null
  )
}

function walkFiles(root: string): string[] {
  const out: string[] = []

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (SKIP_DIRS.has(entry.name)) continue

      const full = path.join(dir, entry.name)

      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) out.push(full)
    }
  }

  if (isDir(root)) walk(root)

  return out
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectStrings(v, out))
  }

  return out
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')

  return new RegExp(`^${escaped}$`)
}

interface Graph {
  // Absolute path of every file under the manifest directory
  files: Set<string>
  manifestDir: string
  templateDir: string
  aliases: Array<{prefix: string; target: string}>
}

function readAliases(templateDir: string): Graph['aliases'] {
  const tsconfig = readJson(path.join(templateDir, 'tsconfig.json'))
  const paths = tsconfig?.compilerOptions?.paths
  const baseUrl = tsconfig?.compilerOptions?.baseUrl || '.'
  const aliases: Graph['aliases'] = []

  if (paths && typeof paths === 'object') {
    for (const [pattern, targets] of Object.entries(paths)) {
      const target = Array.isArray(targets) ? targets[0] : null
      if (typeof target !== 'string') continue

      aliases.push({
        prefix: pattern.replace(/\*$/, ''),
        target: path.resolve(templateDir, baseUrl, target.replace(/\*$/, ''))
      })
    }
  }

  // The shadcn convention when a template ships no tsconfig.
  aliases.push({prefix: '@/', target: path.join(templateDir, 'src')})

  return aliases
}

function stripQuery(spec: string): string {
  return spec.replace(/[?#].*$/, '')
}

// Turn one specifier into the files it names. Globs expand against the tree,
// everything else probes extensions and index files like a bundler would.
function resolveSpecifier(
  graph: Graph,
  fromFile: string,
  rawSpec: string
): string[] {
  const spec = stripQuery(rawSpec.trim())
  if (!spec || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|__MSG_)/i.test(spec)) return []

  const bases: string[] = []

  if (spec.startsWith('/')) {
    bases.push(path.join(graph.manifestDir, spec.slice(1)))
    bases.push(path.join(graph.templateDir, 'public', spec.slice(1)))
  } else if (spec.startsWith('.')) {
    bases.push(path.resolve(path.dirname(fromFile), spec))
  } else {
    const alias = graph.aliases.find((a) => spec.startsWith(a.prefix))

    if (alias) {
      bases.push(path.join(alias.target, spec.slice(alias.prefix.length)))
    }

    // The manifest and HTML pages name files relative to the extension root.
    bases.push(path.resolve(path.dirname(fromFile), spec))
    bases.push(path.join(graph.manifestDir, spec))
  }

  const found: string[] = []

  for (const base of bases) {
    if (/[*?]/.test(base)) {
      const pattern = globToRegExp(base.split(path.sep).join('/'))

      for (const file of graph.files) {
        if (pattern.test(file.split(path.sep).join('/'))) found.push(file)
      }

      continue
    }

    const candidates = [
      base,
      ...RESOLVE_EXTENSIONS.map((ext) => base + ext),
      ...RESOLVE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
      // Sass partials
      path.join(path.dirname(base), `_${path.basename(base)}`),
      ...['.scss', '.sass'].map((ext) =>
        path.join(path.dirname(base), `_${path.basename(base)}${ext}`)
      )
    ]

    for (const candidate of candidates) {
      if (graph.files.has(candidate)) found.push(candidate)
    }
  }

  return found
}

const ATTRIBUTE_REF =
  /(?:src|href|poster|data-src|content)\s*=\s*["']([^"']+)["']/g
const SRCSET_REF = /srcset\s*=\s*["']([^"']+)["']/g
// A side-effect import, a binding import or re-export, a dynamic import and a
// require. The binding form stops at the first quote so one statement never
// swallows the specifier of the next.
const IMPORT_REF =
  /\bimport\s+["']([^"']+)["']|\b(?:import|export)\s+[^"'`;]*?\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g
const URL_REF = /new\s+URL\s*\(\s*["']([^"']+)["']/g
const GET_URL_REF = /\.getURL\s*\(\s*["']([^"']+)["']\s*\)/g
// Pages named as plain strings, the way chrome.devtools.panels.create and
// chrome.tabs.create take them.
const PAGE_LITERAL = /["']([\w./-]+\.html)["']/g
const CSS_REF =
  /@(?:import|use|forward)\s+(?:url\()?["']([^"')]+)["']|url\(\s*["']?([^"')]+)["']?\s*\)/g

function* matches(source: string, pattern: RegExp): Generator<string> {
  for (const match of source.matchAll(pattern)) {
    const value = match.slice(1).find((group) => typeof group === 'string')
    if (value) yield value
  }
}

function referencesIn(file: string): string[] {
  const ext = path.extname(file).toLowerCase()
  let source: string

  try {
    source = fs.readFileSync(file, 'utf8')
  } catch {
    return []
  }

  const refs: string[] = []

  if (ext === '.html' || ext === '.vue' || ext === '.svelte') {
    refs.push(...matches(source, ATTRIBUTE_REF))

    for (const set of matches(source, SRCSET_REF)) {
      for (const part of set.split(',')) refs.push(part.trim().split(/\s+/)[0])
    }

    refs.push(...matches(source, CSS_REF))
  }

  if (CODE_EXTENSIONS.includes(ext) || ext === '.html') {
    refs.push(...matches(source, IMPORT_REF))
    refs.push(...matches(source, URL_REF))
    refs.push(...matches(source, GET_URL_REF))
    refs.push(...matches(source, PAGE_LITERAL))
  }

  if (STYLE_EXTENSIONS.includes(ext)) refs.push(...matches(source, CSS_REF))

  return refs
}

// Every file the bundle can reach, starting from the manifest, the special
// folders and the config, then following imports and page references.
function reachableFiles(graph: Graph): Set<string> {
  const reached = new Set<string>()
  const queue: string[] = []

  const reach = (file: string) => {
    if (reached.has(file)) return

    reached.add(file)
    queue.push(file)
  }

  const manifestPath = path.join(graph.manifestDir, 'manifest.json')
  const manifest = readJson(manifestPath) ?? {}
  reach(manifestPath)

  for (const value of collectStrings(manifest)) {
    resolveSpecifier(graph, manifestPath, value).forEach(reach)
  }

  if (manifest.default_locale) {
    for (const file of graph.files) {
      if (
        file.startsWith(path.join(graph.manifestDir, '_locales') + path.sep)
      ) {
        reach(file)
      }
    }
  }

  // pages/ and scripts/ at the project root are entries the bundler finds on
  // its own, and extension.config.* can name entries of its own.
  for (const special of ['pages', 'scripts']) {
    walkFiles(path.join(graph.templateDir, special)).forEach(reach)
  }

  for (const name of fs.readdirSync(graph.templateDir)) {
    if (!/^extension\.config\.[cm]?[jt]s$/.test(name)) continue

    const configPath = path.join(graph.templateDir, name)

    for (const ref of referencesIn(configPath)) {
      resolveSpecifier(graph, configPath, ref).forEach(reach)
    }
  }

  while (queue.length) {
    const file = queue.shift()!

    for (const ref of referencesIn(file)) {
      resolveSpecifier(graph, file, ref).forEach(reach)
    }
  }

  return reached
}

function listOutputFiles(distDir: string): string[] {
  return walkFiles(distDir).map((file) =>
    path.relative(distDir, file).split(path.sep).join('/')
  )
}

// A build may rename an asset with a hash, so a match on the basename stem
// and extension counts as emitted as well as the exact relative path.
function wasEmitted(relative: string, outputs: string[]): boolean {
  const ext = path.posix.extname(relative)
  const stem = path.posix.basename(relative, ext)

  return outputs.some((out) => {
    if (out === relative || out.endsWith(`/${relative}`)) return true

    const outExt = path.posix.extname(out)
    const outStem = path.posix.basename(out, outExt)

    return (
      outExt === ext && (outStem === stem || outStem.startsWith(`${stem}.`))
    )
  })
}

// README project layout

// Mirrors scripts/catalog/update-template-readmes.mjs: directories first,
// dotfiles, node_modules and dist left out, three levels deep (four for a
// monorepo packages/ tree).
function listTreeEntries(root: string, depth: number): string[] {
  const out: string[] = []

  const walk = (dir: string, currentDepth: number, prefix: string) => {
    if (currentDepth > depth) return

    const entries = fs
      .readdirSync(dir, {withFileTypes: true})
      .filter((e) => !e.name.startsWith('.'))
      .filter((e) => e.name !== 'node_modules' && e.name !== 'dist')
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1

        return a.name.localeCompare(b.name)
      })

    for (const entry of entries) {
      const rel = path.posix.join(prefix, entry.name)
      out.push(entry.isDirectory() ? `${rel}/` : rel)

      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), currentDepth + 1, rel)
      }
    }
  }

  if (isDir(root)) walk(root, 1, '')

  return out
}

function expectedTree(templateDir: string): {label: string; entries: string[]} {
  const hasPages = isDir(path.join(templateDir, 'pages'))
  const hasScripts = isDir(path.join(templateDir, 'scripts'))
  const srcDir = path.join(templateDir, 'src')

  if (hasPages || hasScripts) {
    const entries: string[] = []

    if (isDir(srcDir)) {
      entries.push('src/')
      entries.push(...listTreeEntries(srcDir, 3).map((e) => `src/${e}`))
    }

    if (hasPages) {
      entries.push('pages/')
      entries.push(
        ...listTreeEntries(path.join(templateDir, 'pages'), 3).map(
          (e) => `pages/${e}`
        )
      )
    }

    if (hasScripts) {
      entries.push('scripts/')
      entries.push(
        ...listTreeEntries(path.join(templateDir, 'scripts'), 3).map(
          (e) => `scripts/${e}`
        )
      )
    }

    return {label: '.', entries}
  }

  if (isDir(srcDir)) return {label: 'src/', entries: listTreeEntries(srcDir, 3)}

  const packagesDir = path.join(templateDir, 'packages')

  if (isDir(packagesDir)) {
    return {label: 'packages/', entries: listTreeEntries(packagesDir, 4)}
  }

  return {label: '', entries: []}
}

function readmeTree(
  templateDir: string
): {label: string; entries: string[]} | null {
  const readmePath = path.join(templateDir, 'README.md')
  if (!fs.existsSync(readmePath)) return null

  const readme = fs.readFileSync(readmePath, 'utf8')
  const block = readme.match(/## Project layout\s*\n+```\n([\s\S]*?)\n```/)
  if (!block) return null

  const lines = block[1].split('\n')
  const label = lines.shift() ?? ''
  const stack: string[] = []
  const entries: string[] = []

  for (const line of lines) {
    const branch = line.search(/[├└]── /)
    if (branch < 0) continue

    const depth = branch / 4
    const name = line.slice(branch + 4)
    stack.length = depth
    stack.push(name.replace(/\/$/, ''))
    entries.push(stack.join('/') + (name.endsWith('/') ? '/' : ''))
  }

  return {label, entries}
}

// Tests

const TEMPLATES = listTemplateDirs()

test.describe('template sources', () => {
  test('the corpus is where this spec expects it', () => {
    test
      .expect(TEMPLATES.length, 'no template directories were found')
      .toBeGreaterThan(40)
  })

  for (const slug of TEMPLATES) {
    const templateDir = path.join(__dirname, slug)

    test(`${slug}: README project layout matches the files on disk`, () => {
      const expected = expectedTree(templateDir)
      const actual = readmeTree(templateDir)

      if (expected.entries.length === 0) {
        test
          .expect(
            actual,
            `${slug}: README lists a tree but no source tree exists`
          )
          .toBeNull()

        return
      }

      test
        .expect(actual, `${slug}: README has no "## Project layout" block`)
        .not.toBeNull()

      test
        .expect(actual!.label, `${slug}: tree root label`)
        .toBe(expected.label)

      const missing = expected.entries.filter(
        (e) => !actual!.entries.includes(e)
      )
      const stale = actual!.entries.filter((e) => !expected.entries.includes(e))

      test
        .expect(
          {missing, stale},
          `${slug}: README tree drifted from disk. Missing from README: ${missing.join(', ') || 'none'}. Listed but gone: ${stale.join(', ') || 'none'}. Regenerate with pnpm catalog:readmes.`
        )
        .toEqual({missing: [], stale: []})
    })

    test(`${slug}: every source file is reachable or emitted`, () => {
      const manifestDir = findManifestDir(templateDir)
      test.skip(!manifestDir, `${slug}: no manifest.json found`)

      const files = new Set(walkFiles(manifestDir!))
      const graph: Graph = {
        files,
        manifestDir: manifestDir!,
        templateDir,
        aliases: readAliases(templateDir)
      }
      const reached = reachableFiles(graph)

      const unreferenced = [...files]
        .filter((file) => !reached.has(file))
        .map((file) =>
          path.relative(manifestDir!, file).split(path.sep).join('/')
        )
        .filter((rel) => !TOOLING_FILE.test(path.posix.basename(rel)))
        .sort()

      const known = (KNOWN_UNREACHABLE[slug] ?? []).slice().sort()

      if (unreferenced.length === 0) {
        test
          .expect(
            known,
            `${slug}: every file is reachable now, retire its KNOWN_UNREACHABLE entry`
          )
          .toEqual([])

        return
      }

      // The build decides for files the static walk cannot place: a file the
      // bundler still emits is reachable through a path this spec does not
      // model, a file it drops is dead.
      const outputs = listOutputFiles(resolveBuiltExtensionPath(templateDir))
      test
        .expect(outputs.length, `${slug}: the production build emitted nothing`)
        .toBeGreaterThan(0)

      const stranded = unreferenced.filter((rel) => !wasEmitted(rel, outputs))

      test
        .expect(
          stranded,
          `${slug}: files under ${path.relative(templateDir, manifestDir!)}/ that nothing names and the build drops. Delete them, reference them, or list them in KNOWN_UNREACHABLE with a reason.`
        )
        .toEqual(known)
    })
  }
})
