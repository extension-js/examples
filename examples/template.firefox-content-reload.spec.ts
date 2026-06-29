// Firefox content-script hot-reload regression gate — VISIBLE-BEHAVIOR.
//
// Sibling of template.content-reload.spec.ts (which covers Chromium via
// CDP). This file runs the exact same nine-scenario sequence against
// real Firefox via the standard RDP socket the dev process opens:
//
//   1. Initial mount: anchor visible in shadow/light DOM
//   2. JS edit: marker becomes visible in the same already-open tab
//   3. JS revert: marker disappears, anchor restored
//   4. JS syntax error: anchor still visible (last good build held)
//   5. JS post-fix recovery: new marker lands after the fix
//   6. CSS edit: custom property value visible on .content_script
//   7. CSS syntax error: previous good property held
//   8. CSS post-fix recovery: new property lands
//   9. CSS revert: property goes away
//
// Step 4 + step 7 are the recoverability checks that catch dev-pipeline
// crashes on user-source parse errors (the BuildEmitter ERR_UNHANDLED_ERROR
// regression). Without those steps the existing fleet was blind to the
// dev process dying — every scenario would still pass via stale state.
//
// Architecture mirrors the Chromium spec: spawn `extension dev` with
// --browser=firefox, parse the RDP port from author-mode stdout, open a
// regular http tab via Firefox's RDP `addTab`, query DOM/CSS via a
// parallel RDP connection. evaluateJSAsync is invoked synchronously
// (no top-level await, no Promise grips) so the result is a primitive
// JSON string we can parse directly.

import {expect, test as baseTest} from '@playwright/test'
import fs from 'fs'
import path from 'path'
import net from 'net'
import {spawn, type ChildProcess} from 'child_process'
import {getDirname} from './dirname.js'

const __dirname = getDirname(import.meta.url)
const examplesDir = __dirname

const DEV_ROOTS = ['.extension', 'dist', 'build']
const localCliCjs = process.env.EXTENSION_LOCAL_CLI_CJS || ''

// Same priority list as the Chromium sibling — first match wins.
const JS_ANCHOR_PRIORITY: string[] = [
  'Content Template #1',
  'Content Template',
  'Click, grant, delight — little scripts take flight!',
  'This MAIN world content script',
  'Learn more about creating cross-browser extensions',
  'Open sidebar'
]

interface AnchorHit {
  file: string
  anchor: string
}
interface StyleTarget {
  file: string
}
interface ContentExample {
  name: string
  dir: string
  jsAnchor: AnchorHit
  styleTarget: StyleTarget | null
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
    if (!jsAnchor) continue
    const styleTarget = findStyleTarget(dir)
    out.push({name, dir, jsAnchor, styleTarget})
  }
  return out
}

const envFilter = (process.env.CONTENT_RELOAD_EXAMPLES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// Skip examples that don't apply to Firefox or don't fit the
// shared-shadow-root convention. content-main-world uses world:"MAIN"
// scripts which the codebase already filters out for Firefox at the rule
// layer — there's no reload to verify there.
const SKIP_EXAMPLES = new Set<string>([
  'new-browser-flags',
  'content-main-world'
])

const EXAMPLES = discoverContentExamples().filter((e) => {
  if (SKIP_EXAMPLES.has(e.name)) return false
  if (envFilter.length === 0) return true
  return envFilter.includes(e.name)
})

// ---------------------------------------------------------------------------
// Dev server harness (--browser=firefox)
// ---------------------------------------------------------------------------

interface DevServer {
  proc: ChildProcess
  output: string
  rdpPort?: number
  addonReady?: boolean
}

function startDev(exampleDir: string): DevServer {
  const env = {...process.env, EXTENSION_AUTHOR_MODE: 'true'}
  const command = localCliCjs ? process.execPath : 'pnpm'
  // Optional binary override (EXTENSION_GECKO_BINARY) so this gate can target a
  // specific Firefox in headless/CI/sandbox environments where the default
  // (e.g. Nightly) crashes its GPU helper. Combine with MOZ_HEADLESS=1 (inherited
  // via process.env above) to run headless. Empty -> system default Firefox.
  const geckoBinary = (process.env.EXTENSION_GECKO_BINARY || '').trim()
  const geckoArgs = geckoBinary ? ['--gecko-binary', geckoBinary] : []
  const args = localCliCjs
    ? [
        localCliCjs,
        'dev',
        exampleDir,
        '--browser=firefox',
        '--starting-url',
        'https://example.com',
        '--install=false',
        '--author-mode',
        ...geckoArgs
      ]
    : [
        'extension',
        'dev',
        exampleDir,
        '--browser=firefox',
        '--starting-url',
        'https://example.com',
        '--install=false',
        '--author-mode',
        ...geckoArgs
      ]
  const proc = spawn(command, args, {cwd: exampleDir, env, stdio: 'pipe'})
  const server: DevServer = {proc, output: ''}
  const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')
  const onData = (chunk: Buffer) => {
    const text = stripAnsi(chunk.toString())
    server.output += text
    if (server.rdpPort === undefined) {
      // Accept either extension.js's author-mode line OR Firefox's own
      // "Started devtools server on N" (the latter is the reliable signal in
      // headless runs, where the author-mode debug-port line may not fire).
      const m =
        text.match(/Firefox debug port:\s*(\d{3,5})/i) ||
        text.match(/Started devtools server on\s*(\d{3,5})/i)
      if (m) server.rdpPort = Number(m[1])
    }
    if (
      !server.addonReady &&
      /Firefox Add-on ready for development|Add-on ready for development/i.test(
        text
      )
    ) {
      server.addonReady = true
    }
  }
  proc.stdout?.on('data', onData)
  proc.stderr?.on('data', onData)
  return server
}

async function waitForRdpReady(
  server: DevServer,
  timeoutMs = 90000
): Promise<number> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (server.rdpPort !== undefined && server.addonReady) return server.rdpPort
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(
    `Firefox RDP not ready within ${timeoutMs}ms.\n` +
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
  for (const root of DEV_ROOTS) {
    try {
      fs.rmSync(path.join(dir, root, 'firefox'), {recursive: true, force: true})
    } catch {}
    try {
      fs.rmSync(path.join(dir, root, 'extension-profile-firefox'), {
        recursive: true,
        force: true
      })
    } catch {}
  }
}

function getLatestContentScriptMtime(dir: string): number {
  let latest = 0
  for (const root of DEV_ROOTS) {
    const csDir = path.join(dir, root, 'firefox', 'content_scripts')
    if (!fs.existsSync(csDir)) continue
    try {
      for (const f of fs.readdirSync(csDir)) {
        if (!/\.js$/.test(f) || /\.map$/.test(f)) continue
        const mt = fs.statSync(path.join(csDir, f)).mtimeMs
        if (mt > latest) latest = mt
      }
    } catch {}
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
  throw new Error(
    `firefox content_scripts bundle not re-emitted within ${timeoutMs}ms`
  )
}

// ---------------------------------------------------------------------------
// Minimal Firefox RDP probe — opens a fresh socket per evaluation. Same
// shape as my-ext empirical: greeting → listTabs → getTarget on tab
// descriptor → evaluateJSAsync → JSON-stringified primitive result.
// ---------------------------------------------------------------------------

function rdpEvalAgainstExample(
  port: number,
  expression: string
): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const sock = net.createConnection({host: '127.0.0.1', port}, () => {})
    let buf = Buffer.alloc(0)
    let stage: 'greeting' | 'listTabs' | 'getTarget' | 'eval' = 'greeting'
    let pendingFrom: string | null = null
    let consoleActor: string | null = null
    let evalResultId: string | null = null
    let timer: NodeJS.Timeout | null = null
    function send(packet: any) {
      pendingFrom = packet.to
      const json = JSON.stringify(packet)
      sock.write(
        Buffer.from(`${Buffer.byteLength(json, 'utf-8')}:${json}`, 'utf-8')
      )
    }
    const teardown = () => {
      if (timer) clearTimeout(timer)
      try {
        sock.end()
      } catch {}
    }
    const fail = (err: Error) => {
      teardown()
      rejectPromise(err)
    }
    const done = (value: string) => {
      teardown()
      resolvePromise(value)
    }
    const onParsed = (packet: any) => {
      if (stage === 'greeting') {
        stage = 'listTabs'
        send({to: 'root', type: 'listTabs'})
        return
      }
      if (stage === 'listTabs' && packet.from === 'root' && packet.tabs) {
        const list = Array.isArray(packet.tabs) ? packet.tabs : []
        const tab = list.find((t: any) =>
          String(t?.url || '').includes('example.com')
        )
        if (!tab?.actor) return fail(new Error('no example.com tab'))
        stage = 'getTarget'
        send({to: tab.actor, type: 'getTarget'})
        return
      }
      if (stage === 'getTarget' && packet.from === pendingFrom) {
        const actor =
          packet?.frame?.consoleActor ||
          packet?.consoleActor ||
          packet?.target?.consoleActor
        if (!actor) return fail(new Error('no consoleActor on tab target'))
        consoleActor = actor
        stage = 'eval'
        send({to: consoleActor, type: 'evaluateJSAsync', text: expression})
        return
      }
      if (stage === 'eval' && packet.from === consoleActor) {
        // The result packet also has resultID — check the typed packet
        // first so we don't swallow it as just-the-ack.
        if (
          packet.type === 'evaluationResult' &&
          (!evalResultId || packet.resultID === evalResultId)
        ) {
          const r = packet.result
          if (typeof r === 'string') return done(r)
          if (r && typeof r === 'object') return done(JSON.stringify(r))
          return done('')
        }
        if (typeof packet.resultID === 'string' && !packet.type) {
          evalResultId = packet.resultID
          return
        }
      }
    }
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      while (true) {
        const colon = buf.indexOf(0x3a)
        if (colon < 0) break
        const len = parseInt(buf.subarray(0, colon).toString('utf-8'), 10)
        if (Number.isNaN(len)) {
          fail(new Error('bad framing'))
          return
        }
        if (buf.length < colon + 1 + len) break
        const body = buf.subarray(colon + 1, colon + 1 + len).toString('utf-8')
        buf = buf.subarray(colon + 1 + len)
        try {
          onParsed(JSON.parse(body))
        } catch {}
      }
    })
    sock.on('error', fail)
    sock.on('close', () => {
      if (stage !== 'eval') return
    })
    timer = setTimeout(() => fail(new Error('rdp eval timeout')), 10_000)
  })
}

function domContainsNeedleExpr(needle: string): string {
  const n = JSON.stringify(needle)
  return `JSON.stringify((function(){
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
  })())`
}

function readStylePropertyExpr(className: string, prop: string): string {
  const selector = JSON.stringify('.' + className)
  const propStr = JSON.stringify(prop)
  // Walk the LATEST data-extension-root host in document order. Firefox's
  // executeScript-based reinjection creates a fresh sandbox per call, so
  // the wrapper's __EXTENSIONJS_DEV_REINJECT__ registry doesn't share
  // state across reinjects and old roots stay mounted. The user-visible
  // "new content" lives in the most recently appended root — read that
  // one for computed-style assertions, otherwise we'd pick up the
  // original baseline mount and assertions would always look stale.
  return `JSON.stringify((function(){
    var hosts = Array.from(
      document.querySelectorAll(
        '[data-extension-root]:not([data-extension-root="extension-js-devtools"])'
      )
    );
    for (var i = hosts.length - 1; i >= 0; i--) {
      var host = hosts[i];
      var root = host && host.shadowRoot ? host.shadowRoot : null;
      if (!root) continue;
      var el = null;
      try {
        el = root.querySelector(${selector});
      } catch (e) {}
      if (!el) continue;
      try {
        var cs = ((el.ownerDocument && el.ownerDocument.defaultView) || window).getComputedStyle(el);
        return cs.getPropertyValue(${propStr}).trim();
      } catch (e) {
        return null;
      }
    }
    return null;
  })())`
}

// Reload the at-launch example.com tab once, post-readiness. The launched tab
// finished loading example.com BEFORE extension.js installed the unpacked add-on
// over RDP; WebExtensions do not retroactively inject a declarative content
// script into a tab that already loaded, so the starting tab never mounts the
// script. A single reload after the add-on is ready makes the script inject on
// that navigation — after which every edit must land IN PLACE with no further
// navigation. location.reload() tears the page (and the console actor) down
// mid-eval, so the evaluationResult usually never returns; that rejection is
// expected and swallowed — the mount poll in Step 1 is the real signal. See
// docs/followups/firefox-launcher-at-launch-injection-race.md.
async function rdpReloadExampleTab(port: number): Promise<void> {
  try {
    await rdpEvalAgainstExample(port, 'location.reload()')
  } catch {}
}

async function probeContains(port: number, needle: string): Promise<boolean> {
  try {
    const raw = await rdpEvalAgainstExample(port, domContainsNeedleExpr(needle))
    return JSON.parse(raw) === true
  } catch {
    return false
  }
}

async function probeStyleProperty(
  port: number,
  className: string,
  prop: string
): Promise<string | null> {
  try {
    const raw = await rdpEvalAgainstExample(
      port,
      readStylePropertyExpr(className, prop)
    )
    const parsed = JSON.parse(raw) as string | null
    return parsed
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Parameterized tests
// ---------------------------------------------------------------------------

if (EXAMPLES.length === 0) {
  baseTest.skip('no content-script examples discovered', () => {})
}

for (const example of EXAMPLES) {
  baseTest.describe(`firefox content-script reload: ${example.name}`, () => {
    baseTest.describe.configure({mode: 'serial', timeout: 240000})

    let server: DevServer | null = null
    let originalJsSource: string | null = null
    let originalCssSource: string | null = null

    baseTest.beforeAll(async ({}, testInfo) => {
      testInfo.setTimeout(240000)
      cleanDevRoots(example.dir)
      originalJsSource = fs.readFileSync(example.jsAnchor.file, 'utf8')
      if (example.styleTarget) {
        originalCssSource = fs.readFileSync(example.styleTarget.file, 'utf8')
      }
      server = startDev(example.dir)
      const port = await waitForRdpReady(server, 90000)
      // Wait for the first manifest to land on disk.
      const deadline = Date.now() + 60000
      while (Date.now() < deadline) {
        const hit = DEV_ROOTS.map((root) =>
          path.join(example.dir, root, 'firefox', 'manifest.json')
        ).some((p) => fs.existsSync(p))
        if (hit) break
        await new Promise((r) => setTimeout(r, 300))
      }
      // Now that the add-on is installed and the build has landed, reload the
      // starting tab once so the content script injects (see
      // rdpReloadExampleTab). Without this the at-launch tab never mounts in
      // slow/headless hosts where the add-on install loses the race against the
      // initial page load, and Step 1 fails spuriously.
      await rdpReloadExampleTab(port)
    })

    baseTest.afterAll(async () => {
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

    baseTest(
      'edits + reverts + syntax recovery propagate into the same open tab',
      async () => {
        if (!server || server.rdpPort === undefined) {
          throw new Error('firefox dev server not ready')
        }
        const port = server.rdpPort

        // Step 1 — initial mount: poll for the original anchor in the
        // starting tab (--starting-url=example.com), which beforeAll reloaded
        // once post-readiness so the content script injected. From here on the
        // tab is never navigated again — every edit must land IN PLACE.
        await expect
          .poll(() => probeContains(port, example.jsAnchor.anchor), {
            timeout: 30000,
            intervals: [250, 500, 1000]
          })
          .toBe(true)

        // Step 2 — JS edit lands.
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
            .poll(() => probeContains(port, jsMarker), {
              timeout: 30000,
              intervals: [250, 500, 1000]
            })
            .toBe(true)
        } catch (err) {
          const diagRaw = await rdpEvalAgainstExample(
            port,
            `JSON.stringify((function(){
              var hosts = Array.from(document.querySelectorAll('[data-extension-root]:not([data-extension-root="extension-js-devtools"])'));
              return {
                url: location.href,
                hostCount: hosts.length,
                hosts: hosts.map(function(h){
                  var sh = h.shadowRoot;
                  return {
                    snippet: sh ? String(sh.textContent || '').slice(-300) : null,
                    gen: h.getAttribute('data-extjs-reinject-generation') || ''
                  };
                })
              };
            })())`
          )
          throw new Error(
            `JS marker "${jsMarker}" never reached the open Firefox tab.\n` +
              `Page state: ${diagRaw}\n\n` +
              `Dev tail:\n${server!.output.slice(-3000)}`
          )
        }

        // Step 3 — JS revert lands.
        {
          const baseline = getLatestContentScriptMtime(example.dir)
          fs.writeFileSync(example.jsAnchor.file, originalJsSource!, 'utf8')
          await waitForBundleNewerThan(example.dir, baseline, 45000)
          await expect
            .poll(
              async () => {
                const hasMarker = await probeContains(port, jsMarker)
                const hasAnchor = await probeContains(
                  port,
                  example.jsAnchor.anchor
                )
                return hasAnchor && !hasMarker
              },
              {timeout: 30000, intervals: [250, 500, 1000]}
            )
            .toBe(true)
        }

        // Step 4 — JS syntax error: dev process must not crash, last good
        // state stays. This is the regression for the BuildEmitter
        // ERR_UNHANDLED_ERROR crash.
        {
          const beforeAnchor = await probeContains(
            port,
            example.jsAnchor.anchor
          )
          if (!beforeAnchor) {
            throw new Error(
              `precondition: anchor not visible *before* writing the syntax ` +
                `error — earlier step left the page empty. Dev tail:\n${server!.output.slice(-2000)}`
            )
          }
          const broken =
            originalJsSource +
            '\n// __EXTJS_PROBE_SYNTAX_ERROR__\nconst x = ;\n'
          fs.writeFileSync(example.jsAnchor.file, broken, 'utf8')
          await new Promise((r) => setTimeout(r, 8000))
          const stillThere = await probeContains(port, example.jsAnchor.anchor)
          if (!stillThere) {
            const diagRaw = await rdpEvalAgainstExample(
              port,
              `JSON.stringify((function(){
                var hosts = Array.from(document.querySelectorAll('[data-extension-root]'));
                return {
                  url: location.href,
                  hostCount: hosts.length,
                  hosts: hosts.map(function(h){
                    return {
                      kind: h.getAttribute('data-extension-root') || '',
                      shadowSnippet: h.shadowRoot ? String(h.shadowRoot.textContent || '').slice(0, 120) : null,
                      gen: h.getAttribute('data-extjs-reinject-generation') || ''
                    };
                  })
                };
              })())`
            )
            throw new Error(
              `Firefox: anchor "${example.jsAnchor.anchor}" disappeared ` +
                `during JS syntax error — recoverability broken.\n` +
                `Page state: ${diagRaw}\n\n` +
                `Dev tail:\n${server!.output.slice(-3000)}`
            )
          }
        }

        // Step 5 — JS post-fix recovery.
        {
          const recoveryMarker = `RECOVERED_${Date.now()}_${Math.floor(
            Math.random() * 1e6
          )}`
          const baseline = getLatestContentScriptMtime(example.dir)
          const recoveredJs = originalJsSource!
            .split(example.jsAnchor.anchor)
            .join(`${example.jsAnchor.anchor} ${recoveryMarker}`)
          fs.writeFileSync(example.jsAnchor.file, recoveredJs, 'utf8')
          await waitForBundleNewerThan(example.dir, baseline, 45000)
          await expect
            .poll(() => probeContains(port, recoveryMarker), {
              timeout: 30000,
              intervals: [250, 500, 1000]
            })
            .toBe(true)
          // Restore for CSS phase.
          const cleanupBaseline = getLatestContentScriptMtime(example.dir)
          fs.writeFileSync(example.jsAnchor.file, originalJsSource!, 'utf8')
          await waitForBundleNewerThan(example.dir, cleanupBaseline, 45000)
          await expect
            .poll(() => probeContains(port, recoveryMarker), {
              timeout: 30000,
              intervals: [250, 500, 1000]
            })
            .toBe(false)
        }

        // ---- CSS scenarios — non-modules stylesheets only ----
        if (
          example.styleTarget &&
          !/\.module\.(css|scss|sass|less)$/i.test(example.styleTarget.file)
        ) {
          // Wait for .content_script to be reachable before editing CSS.
          await expect
            .poll(
              () => probeStyleProperty(port, 'content_script', 'outline-style'),
              {
                timeout: 30000,
                intervals: [250, 500, 1000]
              }
            )
            .not.toBeNull()

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

          const readProbe = async () => {
            const value = await probeStyleProperty(
              port,
              'content_script',
              cssProbe
            )
            return (value || '').replace(/['"\s]/g, '')
          }

          // Step 6 — CSS edit lands.
          await expect
            .poll(readProbe, {timeout: 30000, intervals: [250, 500, 1000]})
            .toBe(cssMarker)

          // Step 7 — CSS syntax error: previous good rule stays.
          {
            const broken =
              `${originalCssSource}\n\n` +
              `.content_script { ${cssProbe}: "${cssMarker}"; }\n` +
              `.content_script { color: \n`
            fs.writeFileSync(example.styleTarget.file, broken, 'utf8')
            await new Promise((r) => setTimeout(r, 8000))
            const heldValue = await readProbe()
            if (heldValue !== cssMarker) {
              throw new Error(
                `Firefox: CSS prop ${cssProbe}=${cssMarker} lost during ` +
                  `CSS syntax error — got ${JSON.stringify(heldValue)}.\n` +
                  `Dev tail:\n${server!.output.slice(-3000)}`
              )
            }
          }

          // Step 8 — CSS post-fix recovery.
          const recoveryProbe = `--reload-recovery-${Date.now()}-${Math.floor(
            Math.random() * 1e6
          )}`
          const recoveryValue = `${Date.now().toString(36)}r`
          const recoveryCss =
            `${originalCssSource}\n\n` +
            `.content_script { ${recoveryProbe}: "${recoveryValue}"; }\n`
          const recoveryBaseline = getLatestContentScriptMtime(example.dir)
          fs.writeFileSync(example.styleTarget.file, recoveryCss, 'utf8')
          await waitForBundleNewerThan(example.dir, recoveryBaseline, 45000)
          await expect
            .poll(
              async () => {
                const value = await probeStyleProperty(
                  port,
                  'content_script',
                  recoveryProbe
                )
                return (value || '').replace(/['"\s]/g, '')
              },
              {timeout: 30000, intervals: [250, 500, 1000]}
            )
            .toBe(recoveryValue)

          // Step 9 — CSS revert.
          const revertBaseline = getLatestContentScriptMtime(example.dir)
          fs.writeFileSync(example.styleTarget.file, originalCssSource!, 'utf8')
          await waitForBundleNewerThan(example.dir, revertBaseline, 45000)
          await expect
            .poll(
              async () => {
                const value = await probeStyleProperty(
                  port,
                  'content_script',
                  recoveryProbe
                )
                return (value || '').replace(/['"\s]/g, '')
              },
              {timeout: 30000, intervals: [250, 500, 1000]}
            )
            .toBe('')
        }
      }
    )
  })
}
