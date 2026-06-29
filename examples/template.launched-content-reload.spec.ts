// Launched-Chromium content-script reload gate — DETERMINISTIC edition.
//
// The `content-reload` suite drives the launched browser through a raw CDP tab
// (/json/new + a bare WebSocket, no Runtime.enable) because, with the OLD CDP-
// controller reinject, Playwright-owned pages observed stale DOM. Its CSS phase
// is flaky on some machines for that reason.
//
// Under Option B the launched browser reloads through the SAME control-bridge
// SW producer as `--no-browser` (dev server -> service worker ->
// chrome.scripting.executeScript re-injection into every matching tab). Because
// the producer targets tabs by URL — not by a CDP-discovered target set — a
// Playwright page attached via connectOverCDP is now a first-class reinject
// target and observes the update deterministically. This suite proves that: it
// launches a real Chrome via `extension dev`, attaches Playwright over CDP, and
// asserts a JS edit AND a CSS edit propagate into the already-open page with no
// navigation and no manual reload — including the deterministic CSS axis the
// raw-CDP suite can't reliably assert.
//
// Scoped to the canonical `content` example (JS, MV3, <all_urls>,
// `[data-extension-root="true"]` shadow host with `.content_title` "Content
// Template" + a `.content_script` stylesheet). Custom CSS properties round-trip
// verbatim through getComputedStyle, giving an exact-equality signal.

import {
  expect,
  test as baseTest,
  chromium,
  type Browser,
  type Page
} from '@playwright/test'
import fs from 'fs'
import path from 'path'
import {spawn, type ChildProcess} from 'child_process'
import {getDirname} from './dirname.js'

const __dirname = getDirname(import.meta.url)
const examplesDir = __dirname
const localCliCjs = process.env.EXTENSION_LOCAL_CLI_CJS || ''

const DEV_ROOTS = ['.extension', 'dist', 'build']
const DEV_CHANNELS = ['chrome', 'chromium', 'chrome-mv3']

const contentExampleDir = path.join(examplesDir, 'content')
const scriptPath = path.join(contentExampleDir, 'src', 'content', 'scripts.js')
const stylePath = path.join(contentExampleDir, 'src', 'content', 'styles.css')
const ANCHOR = 'Content Template'

// --- launched-dev harness ---------------------------------------------------

interface DevServer {
  proc: ChildProcess
  output: string
  cdpPort?: number
}

function startDev(exampleDir: string): DevServer {
  const env = {...process.env, EXTENSION_AUTHOR_MODE: 'true'}
  const command = localCliCjs ? process.execPath : 'pnpm'
  const args = localCliCjs
    ? [localCliCjs, 'dev', exampleDir, '--browser=chromium', '--install=false']
    : ['extension', 'dev', exampleDir, '--browser=chromium', '--install=false']
  const proc = spawn(command, args, {
    cwd: exampleDir,
    env,
    stdio: 'pipe',
    detached: process.platform !== 'win32'
  })
  const server: DevServer = {proc, output: ''}
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
  // Same three-phase wait as the raw-CDP suite: port parsed, the dev server's
  // own CDP handshake done, and the extension registered (Extension ID logged)
  // so the first page we open doesn't race the initial content-script
  // registration.
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
    `CDP did not become ready within ${timeoutMs}ms.\nLast output:\n${server.output.slice(-2000)}`
  )
}

async function stopDev(server: DevServer) {
  if (server.proc.killed || server.proc.exitCode !== null) return
  const pid = server.proc.pid
  const signalTree = (signal: NodeJS.Signals) => {
    try {
      if (process.platform !== 'win32' && pid) process.kill(-pid, signal)
      else server.proc.kill(signal)
    } catch {
      // group already gone
    }
  }
  const closed = new Promise<void>((resolve) =>
    server.proc.on('close', () => resolve())
  )
  const waitMs = (ms: number) =>
    new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), ms)
    )
  signalTree('SIGTERM')
  const outcome = await Promise.race([
    closed.then(() => 'closed' as const),
    waitMs(5000)
  ])
  if (outcome === 'timeout') {
    signalTree('SIGKILL')
    await Promise.race([closed, waitMs(5000)])
  }
}

function cleanDevRoots(dir: string) {
  for (const root of DEV_ROOTS)
    for (const ch of DEV_CHANNELS) {
      try {
        fs.rmSync(path.join(dir, root, ch), {recursive: true, force: true})
      } catch {}
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

// Read the rendered title from the shadow root. Returns '' on any failure (the
// SW re-injects under us; an evaluate can briefly race the reinject teardown).
// The poller just retries.
async function readContentTitle(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => {
      const host = document.querySelector('[data-extension-root="true"]')
      const sr = host ? (host as HTMLElement).shadowRoot : null
      const el = sr ? sr.querySelector('.content_title') : null
      return el ? el.textContent || '' : ''
    })
  } catch {
    return ''
  }
}

// Read a computed CSS property off `.content_script` in the shadow root,
// quote/whitespace-normalized. Custom properties round-trip verbatim, so a
// unique probe value gives an exact-equality signal the new stylesheet is live.
async function readStyleProbe(page: Page, prop: string): Promise<string> {
  try {
    const value = await page.evaluate((p) => {
      const host = document.querySelector('[data-extension-root="true"]')
      const sr = host ? (host as HTMLElement).shadowRoot : null
      const el = sr ? sr.querySelector('.content_script') : null
      if (!el) return ''
      const view = el.ownerDocument.defaultView || window
      return view.getComputedStyle(el as Element).getPropertyValue(p)
    }, prop)
    return (value || '').replace(/['"\s]/g, '')
  } catch {
    return ''
  }
}

// --- tests ------------------------------------------------------------------

baseTest.describe(
  'content reload on launched Chromium (connectOverCDP)',
  () => {
    baseTest.describe.configure({mode: 'serial', timeout: 180000})

    const ORIGINAL = fs.readFileSync(scriptPath, 'utf8')
    const STYLE_ORIGINAL = fs.readFileSync(stylePath, 'utf8')

    let server: DevServer | null = null
    let browser: Browser | null = null
    let page: Page | null = null

    baseTest.beforeAll(async ({}, testInfo) => {
      testInfo.setTimeout(180000)
      cleanDevRoots(contentExampleDir)
      server = startDev(contentExampleDir)
      const cdpPort = await waitForCdpReady(server, 90000)

      // Attach to the Chrome that `extension dev` launched.
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`)
      const ctx = browser.contexts()[0] || (await browser.newContext())
      page = await ctx.newPage()
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })

      // The content script must self-mount in the launched browser before we edit.
      await expect
        .poll(() => readContentTitle(page!), {
          timeout: 45000,
          intervals: [250, 500, 1000]
        })
        .toBe(ANCHOR)
    })

    baseTest.afterAll(async () => {
      try {
        fs.writeFileSync(scriptPath, ORIGINAL, 'utf8')
      } catch {}
      try {
        fs.writeFileSync(stylePath, STYLE_ORIGINAL, 'utf8')
      } catch {}
      try {
        if (browser) await browser.close()
      } catch {}
      if (server) await stopDev(server)
      server = null
      browser = null
      page = null
    })

    baseTest(
      'JS edit re-injects into the open tab in place — no navigation',
      async () => {
        const marker = `LaunchedReload-${Date.now()}`
        try {
          const baseline = getLatestContentScriptMtime(contentExampleDir)
          fs.writeFileSync(
            scriptPath,
            ORIGINAL.split(ANCHOR).join(marker),
            'utf8'
          )
          await waitForBundleNewerThan(contentExampleDir, baseline, 45000)

          await expect
            .poll(() => readContentTitle(page!), {
              timeout: 60000,
              intervals: [500, 1000, 2000]
            })
            .toBe(marker)

          // Revert propagates back the same way.
          const revertBaseline = getLatestContentScriptMtime(contentExampleDir)
          fs.writeFileSync(scriptPath, ORIGINAL, 'utf8')
          await waitForBundleNewerThan(contentExampleDir, revertBaseline, 45000)

          await expect
            .poll(() => readContentTitle(page!), {
              timeout: 60000,
              intervals: [500, 1000, 2000]
            })
            .toBe(ANCHOR)
        } finally {
          fs.writeFileSync(scriptPath, ORIGINAL, 'utf8')
        }
      }
    )

    // The deterministic CSS axis the raw-CDP `content-reload` suite can't reliably
    // assert. Same SW-producer re-injection, observed through a Playwright page.
    baseTest(
      'CSS edit re-injects styles into the open tab in place',
      async () => {
        const probe = `--reload-probe-${Date.now()}`
        const marker = Date.now().toString(36)
        try {
          // Stylesheet must be live before we edit it.
          await expect
            .poll(() => readStyleProbe(page!, 'color'), {timeout: 45000})
            .not.toBe('')

          const baseline = getLatestContentScriptMtime(contentExampleDir)
          fs.writeFileSync(
            stylePath,
            `${STYLE_ORIGINAL}\n.content_script { ${probe}: "${marker}"; }\n`,
            'utf8'
          )
          await waitForBundleNewerThan(contentExampleDir, baseline, 45000)

          await expect
            .poll(() => readStyleProbe(page!, probe), {
              timeout: 60000,
              intervals: [500, 1000, 2000]
            })
            .toBe(marker)

          // Revert clears the property the same way.
          const revertBaseline = getLatestContentScriptMtime(contentExampleDir)
          fs.writeFileSync(stylePath, STYLE_ORIGINAL, 'utf8')
          await waitForBundleNewerThan(contentExampleDir, revertBaseline, 45000)

          await expect
            .poll(() => readStyleProbe(page!, probe), {
              timeout: 60000,
              intervals: [500, 1000, 2000]
            })
            .toBe('')
        } finally {
          fs.writeFileSync(stylePath, STYLE_ORIGINAL, 'utf8')
        }
      }
    )
  }
)
