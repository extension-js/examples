// Content-script hot-reload regression gate — VISIBLE-BEHAVIOR edition.
//
// Parameterized over every example that declares `content_scripts` in its
// manifest. For each example this spec asserts two user-visible axes:
//
//   (A) JS source edit → visible TEXT CHANGE in the already-open tab.
//       A known anchor string (e.g. "Content Template", "Open sidebar",
//       "Learn more about creating cross-browser extensions") is replaced
//       with `anchor + " <MARKER>"` in the source. The test then polls the
//       same tab's DOM (light + all open shadow roots) until the marker
//       is visible — or fails hard after 30s.
//
//   (B) CSS source edit → visible STYLE CHANGE in the already-open tab.
//       A new rule is appended to the content-script stylesheet setting a
//       custom CSS property on the extension root; the test polls the
//       element's computed style for that property value.
//
// Architecture
//   - `extension dev` is spawned for real and allowed to launch its own
//     Chrome (we need the actual dev → CDP → open-tab reinject chain).
//   - Playwright connects to that Chrome via `chromium.connectOverCDP`.
//   - No navigation after the edit — the whole point is to prove the
//     edit reaches the EXISTING tab.
//
// Every wait is a bounded poll against a concrete signal (bundle mtime,
// DOM predicate). No fixed sleeps. Tests are serial because they share the
// CDP port the dev server picks.

import {expect, test as baseTest} from '@playwright/test'
import fs from 'fs'
import path from 'path'
import {spawn, type ChildProcess} from 'child_process'
import * as http from 'http'
import WebSocket from 'ws'
import {getDirname} from './dirname.js'

const __dirname = getDirname(import.meta.url)
const examplesDir = __dirname

const DEV_ROOTS = ['.extension', 'dist', 'build']
const DEV_CHANNELS = ['chrome', 'chromium', 'chrome-mv3']
const localCliCjs = process.env.EXTENSION_LOCAL_CLI_CJS || ''

// Priority-ordered list of visible-text anchors that exist in at least one
// source file per content-script example. First match wins, so the longer
// variants ("Content Template #1") must come before shorter prefixes
// ("Content Template").
const JS_ANCHOR_PRIORITY: string[] = [
  'Content Template #1',
  'Content Template',
  'Click, grant, delight — little scripts take flight!',
  'This MAIN world content script',
  'Learn more about creating cross-browser extensions',
  'Open sidebar'
]

// -----------------------------------------------------------------------------
// Example discovery
// -----------------------------------------------------------------------------

interface AnchorHit {
  file: string
  anchor: string
}

interface StyleTarget {
  file: string // absolute path to .css / .scss / .less to edit
}

interface ContentExample {
  name: string
  dir: string
  jsAnchor: AnchorHit // file + literal string to replace
  styleTarget: StyleTarget | null // editable stylesheet, if present
}

function candidateJsFiles(exampleDir: string): string[] {
  const out: string[] = []
  const manifestPath = path.join(exampleDir, 'src', 'manifest.json')
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const entry = manifest?.content_scripts?.[0]?.js?.[0]
    if (typeof entry === 'string') {
      out.push(path.join(exampleDir, 'src', entry))
    }
  } catch {}
  const contentDir = path.join(exampleDir, 'src', 'content')
  if (fs.existsSync(contentDir)) {
    for (const f of fs.readdirSync(contentDir)) {
      if (/^(ContentApp|App|Content)\.(tsx?|jsx?|vue|svelte)$/.test(f)) {
        out.push(path.join(contentDir, f))
      }
    }
    // Also fall back to every .js/.ts/.tsx/.jsx in content/ if needed.
    for (const f of fs.readdirSync(contentDir)) {
      if (/\.(tsx?|jsx?|vue|svelte)$/.test(f)) {
        const full = path.join(contentDir, f)
        if (!out.includes(full)) out.push(full)
      }
    }
  }
  return out
}

function findJsAnchor(exampleDir: string): AnchorHit | null {
  for (const file of candidateJsFiles(exampleDir)) {
    if (!fs.existsSync(file)) continue
    let text = ''
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const anchor of JS_ANCHOR_PRIORITY) {
      if (text.includes(anchor)) return {file, anchor}
    }
  }
  return null
}

function findStyleTarget(exampleDir: string): StyleTarget | null {
  const contentDir = path.join(exampleDir, 'src', 'content')
  if (!fs.existsSync(contentDir)) return null
  const preferred = [
    'styles.css',
    'styles.scss',
    'styles.less',
    'styles.module.css',
    'styles.module.scss'
  ]
  for (const name of preferred) {
    const p = path.join(contentDir, name)
    if (fs.existsSync(p)) return {file: p}
  }
  return null
}

function discoverContentExamples(): ContentExample[] {
  const out: ContentExample[] = []
  for (const name of fs.readdirSync(examplesDir)) {
    const dir = path.join(examplesDir, name)
    const manifestPath = path.join(dir, 'src', 'manifest.json')
    if (!fs.statSync(dir, {throwIfNoEntry: false})?.isDirectory?.()) continue
    if (!fs.existsSync(manifestPath)) continue
    let manifest: any
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    } catch {
      continue
    }
    if (!manifest?.content_scripts?.[0]?.js?.[0]) continue
    const jsAnchor = findJsAnchor(dir)
    if (!jsAnchor) continue // no known visible anchor — handled below
    const styleTarget = findStyleTarget(dir)
    out.push({name, dir, jsAnchor, styleTarget})
  }
  return out
}

// Subset override — CI can pin to a smaller set with CONTENT_RELOAD_EXAMPLES=a,b,c.
const envFilter = (process.env.CONTENT_RELOAD_EXAMPLES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// Examples that opt out of this gate:
// - new-browser-flags: kiosk mode + startingUrl chrome://newtab prevents us
//   from opening a normal http tab. Not a reload test.
// - content-main-world: MAIN-world scripts run in the page context rather
//   than the isolated world, and the reinject tracker's `[data-extension-root]`
//   convention doesn't apply. Needs a dedicated MAIN-world reload test.
const SKIP_EXAMPLES = new Set<string>([
  'new-browser-flags',
  'content-main-world'
])

const EXAMPLES = discoverContentExamples().filter((e) => {
  if (SKIP_EXAMPLES.has(e.name)) return false
  if (envFilter.length === 0) return true
  return envFilter.includes(e.name)
})

// -----------------------------------------------------------------------------
// Dev server harness
// -----------------------------------------------------------------------------

interface DevServer {
  proc: ChildProcess
  output: string
  cdpPort?: number
}

function startDev(exampleDir: string): DevServer {
  const env = {
    ...process.env,
    EXTENSION_AUTHOR_MODE: 'true'
  }
  const command = localCliCjs ? process.execPath : 'pnpm'
  const args = localCliCjs
    ? [localCliCjs, 'dev', exampleDir, '--browser=chromium', '--install=false']
    : ['extension', 'dev', exampleDir, '--browser=chromium', '--install=false']
  const proc = spawn(command, args, {cwd: exampleDir, env, stdio: 'pipe'})
  const server: DevServer = {proc, output: ''}

  // Strip ANSI color codes so our port regex matches.
  const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')
  const onData = (chunk: Buffer) => {
    const text = stripAnsi(chunk.toString())
    server.output += text
    if (server.cdpPort === undefined) {
      const m = text.match(/Chromium debug port:\s*(\d+)/)
      if (m) server.cdpPort = Number(m[1])
    }
  }
  proc.stdout?.on('data', onData)
  proc.stderr?.on('data', onData)

  return server
}

async function waitForCdpReady(
  server: DevServer,
  timeoutMs = 90000
): Promise<number> {
  // Three-phase wait:
  //   1. "Chromium debug port: N" — parse the port Chrome picked
  //   2. "Chrome CDP Client connected" — the dev server's own CDP handshake
  //   3. "Extension ID" — logged after the extension is fully registered in
  //      the browser. Without this, the first tab we open may race the
  //      extension's own first content-script registration and subsequent
  //      reinjects mis-target the tab.
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (
      server.cdpPort !== undefined &&
      /Chrome CDP Client connected/i.test(server.output) &&
      /Extension ID\s+[a-z0-9]/i.test(server.output)
    ) {
      return server.cdpPort
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(
    `CDP did not become ready within ${timeoutMs}ms.\n` +
      `Last output:\n${server.output.slice(-2000)}`
  )
}

async function stopDev(server: DevServer) {
  if (server.proc.killed) return
  server.proc.kill('SIGTERM')
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      try {
        server.proc.kill('SIGKILL')
      } catch {}
      resolve(null)
    }, 5000)
    server.proc.on('close', () => {
      clearTimeout(timeout)
      resolve(null)
    })
  })
}

function cleanDevRoots(dir: string) {
  for (const root of DEV_ROOTS)
    for (const ch of DEV_CHANNELS)
      try {
        fs.rmSync(path.join(dir, root, ch), {recursive: true, force: true})
      } catch {}
  // Also drop persistent profiles — accumulated tabs from prior runs create
  // dozens of stale `[data-extension-root]` hosts + CDP targets that race
  // with our test's reinject flow.
  for (const root of DEV_ROOTS)
    for (const ch of DEV_CHANNELS) {
      try {
        fs.rmSync(path.join(dir, root, `extension-profile-${ch}`), {
          recursive: true,
          force: true
        })
      } catch {}
    }
}

function getLatestContentScriptMtime(dir: string): number {
  let latest = 0
  for (const root of DEV_ROOTS) {
    for (const ch of DEV_CHANNELS) {
      const csDir = path.join(dir, root, ch, 'content_scripts')
      if (!fs.existsSync(csDir)) continue
      try {
        for (const f of fs.readdirSync(csDir)) {
          if (!/\.js$/.test(f) || /\.map$/.test(f)) continue
          const mt = fs.statSync(path.join(csDir, f)).mtimeMs
          if (mt > latest) latest = mt
        }
      } catch {}
    }
  }
  return latest
}

async function waitForBundleNewerThan(
  dir: string,
  baseline: number,
  timeoutMs = 45000
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (getLatestContentScriptMtime(dir) > baseline) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`content_scripts bundle not re-emitted within ${timeoutMs}ms`)
}

// -----------------------------------------------------------------------------
// Raw CDP tab driver
//
// Deliberately not using Playwright's `chromium.connectOverCDP` + `newPage()`
// path: Playwright-opened pages behaved differently from Chrome-native tabs
// during reinject (the reinject fired but the DOM in the Playwright-owned
// page stayed stale). Opening the tab via /json/new and driving it over a
// WebSocket mirrors the real user scenario and matches the manual
// reproduction that proved the reload chain works end-to-end.
// -----------------------------------------------------------------------------

interface JsonTarget {
  id: string
  type: string
  url: string
  webSocketDebuggerUrl: string
}

function httpJson<T>(options: http.RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (c) => (body += c.toString()))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (err) {
          reject(err)
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function openCdpTab(
  port: number,
  url: string,
  timeoutMs = 30000
): Promise<CdpTab> {
  // /json/new with the URL as an unencoded query string — the Chrome DevTools
  // Protocol HTTP frontend accepts this form specifically. The HTTP endpoint
  // can lag the internal CDP socket (especially with --remote-debugging-pipe),
  // so retry until it answers or the ceiling fires.
  const start = Date.now()
  let lastErr: unknown = null
  while (Date.now() - start < timeoutMs) {
    try {
      const target = await httpJson<JsonTarget>({
        host: '127.0.0.1',
        port,
        path: `/json/new?${url}`,
        method: 'PUT',
        headers: {Host: `localhost:${port}`}
      })
      const tab = new CdpTab(port, target.id, target.webSocketDebuggerUrl)
      await tab.connect()
      return tab
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 400))
    }
  }
  throw new Error(
    `openCdpTab(${port}, ${url}) failed within ${timeoutMs}ms: ${String(
      (lastErr as any)?.message || lastErr
    )}`
  )
}

class CdpTab {
  private ws: WebSocket | null = null
  private pending = new Map<number, (m: any) => void>()
  private nextId = 0

  constructor(
    public readonly port: number,
    public readonly targetId: string,
    public readonly wsUrl: string
  ) {}

  async connect(): Promise<void> {
    // Deliberately do NOT call Runtime.enable. The dev server's CDP client
    // will attach to this same target to drive the reinject flow; if we
    // have Runtime active on our session the dev server's own Runtime.enable
    // can time out (observed as `CDP command timed out (12000ms): Runtime.enable`
    // in dev logs). Runtime.evaluate works without the domain being explicitly
    // enabled, which is all this driver needs.
    this.ws = new WebSocket(this.wsUrl)
    await new Promise<void>((resolve, reject) => {
      const ws = this.ws!
      ws.once('open', () => resolve())
      ws.once('error', reject)
    })
    this.ws.on('message', (raw: Buffer | string) => {
      try {
        const m = JSON.parse(raw.toString())
        if (typeof m.id === 'number' && this.pending.has(m.id)) {
          const resolve = this.pending.get(m.id)!
          this.pending.delete(m.id)
          resolve(m)
        }
      } catch {}
    })
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    if (!this.ws) throw new Error('not connected')
    const id = ++this.nextId
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.ws!.send(JSON.stringify({id, method, params}))
    })
  }

  async evaluate<T = unknown>(expression: string): Promise<T | null> {
    const m = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: false
    })
    if (m.result?.exceptionDetails) return null
    return (m.result?.result?.value as T) ?? null
  }

  async close(): Promise<void> {
    try {
      await httpJson({
        host: '127.0.0.1',
        port: this.port,
        path: `/json/close/${this.targetId}`,
        method: 'GET',
        headers: {Host: `localhost:${this.port}`}
      })
    } catch {}
    try {
      this.ws?.close()
    } catch {}
    this.ws = null
  }
}

// DOM predicate — walks light DOM and every OPEN shadow root looking for
// `needle` in any text node. Returned as a string so it can be sent
// verbatim to CDP's Runtime.evaluate.
function domContainsNeedleExpr(needle: string): string {
  const n = JSON.stringify(needle)
  return `(function(){
    function walk(root){
      if (!root) return false;
      var t = root.textContent || '';
      if (typeof t === 'string' && t.indexOf(${n}) !== -1) return true;
      var all = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].shadowRoot && walk(all[i].shadowRoot)) return true;
      }
      return false;
    }
    return walk(document);
  })()`
}

// Shadow-DOM-aware computed-style probe. Looks for any element with the
// given class name in the light DOM or any open shadow root, returns the
// getComputedStyle().getPropertyValue(prop) for the first match. Returned
// as a string for CDP.evaluate.
function readStylePropertyExpr(params: {
  className: string
  prop: string
}): string {
  const selector = JSON.stringify('.' + params.className)
  const prop = JSON.stringify(params.prop)
  return `(function(){
    function find(root){
      if (!root) return null;
      try {
        if (typeof root.querySelector === 'function') {
          var direct = root.querySelector(${selector});
          if (direct) return direct;
        }
      } catch (e) {}
      var all = typeof root.querySelectorAll === 'function'
        ? Array.from(root.querySelectorAll('*'))
        : [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].shadowRoot) {
          var hit = find(all[i].shadowRoot);
          if (hit) return hit;
        }
      }
      return null;
    }
    var el = find(document);
    if (!el) return null;
    try {
      var cs = ((el.ownerDocument && el.ownerDocument.defaultView) || window).getComputedStyle(el);
      return cs.getPropertyValue(${prop}).trim();
    } catch (e) { return null; }
  })()`
}

function domDiagnosticExpr(): string {
  return `(function(){
    var roots = Array.from(document.querySelectorAll('[data-extension-root]'));
    return {
      url: location.href,
      rootCount: roots.length,
      shadowTextSamples: roots.map(function(h){
        var sh = h.shadowRoot;
        return sh ? String(sh.textContent || '').slice(-200) : null;
      }),
      reinjectBuilds: roots.map(function(h){ return h.getAttribute('data-extjs-reinject-build'); }),
      reinjectGens: roots.map(function(h){ return h.getAttribute('data-extjs-reinject-generation'); })
    };
  })()`
}

// -----------------------------------------------------------------------------
// Parameterized tests
// -----------------------------------------------------------------------------

if (EXAMPLES.length === 0) {
  baseTest.skip('no content-script examples discovered', () => {})
}

for (const example of EXAMPLES) {
  baseTest.describe(`content-script reload: ${example.name}`, () => {
    baseTest.describe.configure({mode: 'serial', timeout: 180000})

    let server: DevServer | null = null
    let originalJsSource: string | null = null
    let originalCssSource: string | null = null

    baseTest.beforeAll(async ({}, testInfo) => {
      testInfo.setTimeout(180000)
      cleanDevRoots(example.dir)
      originalJsSource = fs.readFileSync(example.jsAnchor.file, 'utf8')
      if (example.styleTarget) {
        originalCssSource = fs.readFileSync(example.styleTarget.file, 'utf8')
      }
      server = startDev(example.dir)
      await waitForCdpReady(server, 90000)
      // Wait for the first manifest to land on disk.
      const deadline = Date.now() + 60000
      while (Date.now() < deadline) {
        const hit = DEV_ROOTS.flatMap((root) =>
          DEV_CHANNELS.map((ch) =>
            path.join(example.dir, root, ch, 'manifest.json')
          )
        ).some((p) => fs.existsSync(p))
        if (hit) break
        await new Promise((r) => setTimeout(r, 300))
      }
    })

    baseTest.afterAll(async () => {
      // Restore source files before stopping the server so the watcher
      // re-emits the originals (harmless if the server is already down).
      if (originalJsSource !== null) {
        try {
          fs.writeFileSync(example.jsAnchor.file, originalJsSource, 'utf8')
        } catch {}
      }
      if (originalCssSource !== null && example.styleTarget) {
        try {
          fs.writeFileSync(example.styleTarget.file, originalCssSource, 'utf8')
        } catch {}
      }
      if (server) await stopDev(server)
      server = null
    })

    // One test per example — deliberately monolithic. Opening ONE tab and
    // asserting both the JS and CSS edits against the same page is the only
    // way to prove "edit propagates into an existing, already-rendered tab".
    // Splitting JS and CSS into separate tests would re-open the tab for the
    // second test, which trivially loads the latest bundle at navigation
    // time and passes even when reload is broken.
    baseTest(
      'edits propagate into the same already-open tab (no navigation)',
      async () => {
        if (!server || server.cdpPort === undefined) {
          throw new Error('dev server not ready')
        }

        // Open ONE tab directly via raw CDP. We deliberately avoid
        // Playwright's connectOverCDP/newPage() path — empirically the
        // reinject chain fires against Playwright-owned pages but the
        // DOM in those pages never picks up the new content, while the
        // exact same reinject against a Chrome-native tab does update.
        const tab = await openCdpTab(server.cdpPort, 'https://example.com/')

        try {
          // Smoke check: the extension actually mounted its original anchor.
          // Guards against false negatives where the content script never
          // ran at all (broken example, broken extension, etc.).
          await expect
            .poll(
              () =>
                tab.evaluate<boolean>(
                  domContainsNeedleExpr(example.jsAnchor.anchor)
                ),
              {timeout: 30000, intervals: [250, 500, 1000]}
            )
            .toBe(true)

          // ------- JS edit: visible text must change in the SAME tab -------
          // Replace EVERY occurrence of the anchor, not just the first.
          // Anchors like "Open sidebar" appear in multiple spots inside a
          // single file (e.g. aria-label + visible text in JSX), and a
          // first-only replace may hit an attribute instead of the rendered
          // text — which would never show up in `textContent` and would
          // look like a broken reload chain.
          const jsMarker = `RELOADED_${Date.now()}_${Math.floor(
            Math.random() * 1e6
          )}`
          const jsBaseline = getLatestContentScriptMtime(example.dir)
          const editedJs = originalJsSource!
            .split(example.jsAnchor.anchor)
            .join(`${example.jsAnchor.anchor} ${jsMarker}`)
          fs.writeFileSync(example.jsAnchor.file, editedJs, 'utf8')
          await waitForBundleNewerThan(example.dir, jsBaseline, 45000)

          try {
            await expect
              .poll(
                () => tab.evaluate<boolean>(domContainsNeedleExpr(jsMarker)),
                {timeout: 30000, intervals: [250, 500, 1000]}
              )
              .toBe(true)
          } catch (err) {
            const state = await tab.evaluate<any>(domDiagnosticExpr())
            const tail = server!.output.slice(-3000)
            throw new Error(
              `JS marker "${jsMarker}" never reached the open tab.\n` +
                `Page state: ${JSON.stringify(state, null, 2)}\n\n` +
                `Dev server output tail:\n${tail}`
            )
          }

          // ------- CSS edit: computed style must change in the SAME tab ----
          // Only examples with a plain (non-modules) stylesheet — CSS/SASS
          // modules hash class names at build time, making a static appended
          // rule unreliable. The JS edit above already covers modules-based
          // examples on the reload axis.
          if (
            example.styleTarget &&
            !/\.module\.(css|scss|sass|less)$/i.test(example.styleTarget.file)
          ) {
            // Wait for `.content_script` to be reachable in light or shadow
            // DOM before editing CSS.
            await expect
              .poll(
                () =>
                  tab.evaluate<string | null>(
                    readStylePropertyExpr({
                      className: 'content_script',
                      prop: 'outline-style'
                    })
                  ),
                {timeout: 30000, intervals: [250, 500, 1000]}
              )
              .not.toBeNull()

            // Append a unique custom-property rule. Custom props are
            // returned verbatim by getComputedStyle, so we get exact
            // equality instead of fighting with browser color normalization.
            const cssProbe = `--reload-probe-${Date.now()}-${Math.floor(
              Math.random() * 1e6
            )}`
            const cssMarker = `${Date.now().toString(36)}`
            const appended =
              `${originalCssSource}\n\n` +
              `.content_script { ${cssProbe}: "${cssMarker}"; }\n`

            const cssBaseline = getLatestContentScriptMtime(example.dir)
            fs.writeFileSync(example.styleTarget.file, appended, 'utf8')
            await waitForBundleNewerThan(example.dir, cssBaseline, 45000)

            await expect
              .poll(
                async () => {
                  const value = await tab.evaluate<string | null>(
                    readStylePropertyExpr({
                      className: 'content_script',
                      prop: cssProbe
                    })
                  )
                  // Browsers return custom-property values wrapped in
                  // whitespace and quotes; normalize for the compare.
                  return (value || '').replace(/['"\s]/g, '')
                },
                {timeout: 30000, intervals: [250, 500, 1000]}
              )
              .toBe(cssMarker)
          }
        } finally {
          try {
            await tab.close()
          } catch {}
        }
      }
    )
  })
}
