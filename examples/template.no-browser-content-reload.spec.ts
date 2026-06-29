// `extension dev --no-browser` content-script reload gate — VISIBLE BEHAVIOR.
//
// The controller-less counterpart to template.content-reload.spec.ts. That suite
// lets `extension dev` launch its own Chrome and reloads content scripts through
// the CDP controller. This suite removes the controller: it runs `--no-browser`,
// loads the built `dist/chromium` into an independent Playwright Chrome, and
// asserts an edit reaches the OPEN tab IN PLACE — driven only by the control
// bridge (dev server -> service-worker producer -> chrome.scripting.executeScript
// re-injection). Nothing here triggers a reload: no page.reload(), no CDP
// runtime.reload. If the broadcast/re-injection chain regresses, the marker never
// appears and this fails.
//
// It also live-proves the self-mount: the content script mounts under
// `--no-browser` with no controller present (the original hmr-no-browser concern).
//
// Scoped to the canonical `content` example (JS, MV3, <all_urls>,
// `[data-extension-root]` + `.content_title` "Content Template"). The re-injection
// path is framework-agnostic; the controller suite covers the framework matrix.

import {expect, type Page} from '@playwright/test'
import fs from 'fs'
import path from 'path'
import {spawn, type ChildProcess} from 'child_process'
import {getDirname} from './dirname.js'
import {extensionFixtures} from './extension-fixtures.js'

const __dirname = getDirname(import.meta.url)
const examplesDir = __dirname
const localCliCjs = process.env.EXTENSION_LOCAL_CLI_CJS || ''

const DEV_ROOTS = ['.extension', 'dist', 'build']
const DEV_CHANNELS = ['chrome', 'chromium', 'chrome-mv3']

const contentExampleDir = path.join(examplesDir, 'content')
const contentDevPath = path.join(contentExampleDir, 'dist', 'chromium')
const scriptPath = path.join(contentExampleDir, 'src', 'content', 'scripts.js')
const stylePath = path.join(contentExampleDir, 'src', 'content', 'styles.css')
const ANCHOR = 'Content Template'

// --- dev (--no-browser) harness ---------------------------------------------

function startDev(exampleDir: string): ChildProcess {
  const env = {...process.env, EXTENSION_AUTHOR_MODE: 'true'}
  const spawnOpts = {
    cwd: exampleDir,
    env,
    stdio: 'pipe' as const,
    detached: process.platform !== 'win32'
  }
  const args = localCliCjs
    ? [
        localCliCjs,
        'dev',
        exampleDir,
        '--browser=chromium',
        '--no-browser',
        '--install=false'
      ]
    : [
        'extension',
        'dev',
        exampleDir,
        '--browser=chromium',
        '--no-browser',
        '--install=false'
      ]
  const command = localCliCjs ? process.execPath : 'pnpm'
  return spawn(command, args, spawnOpts)
}

async function stopDev(proc: ChildProcess) {
  if (proc.killed || proc.exitCode !== null) return
  const pid = proc.pid
  const signalTree = (signal: NodeJS.Signals) => {
    try {
      if (process.platform !== 'win32' && pid) process.kill(-pid, signal)
      else proc.kill(signal)
    } catch {
      // group already gone
    }
  }
  const closed = new Promise<void>((resolve) =>
    proc.on('close', () => resolve())
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

async function waitForDevManifest(
  dir: string,
  timeoutMs = 60000
): Promise<void> {
  const start = Date.now()
  const channels = ['chromium', 'chrome-mv3']
  while (Date.now() - start < timeoutMs) {
    for (const root of DEV_ROOTS) {
      for (const ch of channels) {
        const manifestPath = path.join(dir, root, ch, 'manifest.json')
        try {
          if (fs.statSync(manifestPath).size > 0) {
            JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
            return
          }
        } catch {
          // partial/missing — keep polling
        }
      }
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Dev manifest not found for ${dir}`)
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

// Read the content script's rendered title from the shadow root. Returns '' on
// any failure (the SW re-injects under us; an evaluate can briefly race the
// reinject teardown). The poller just retries.
async function readContentTitle(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => {
      const host = document.querySelector('[data-extension-root="true"]')
      const sr = host ? (host as HTMLElement).shadowRoot : null
      if (!sr) return ''
      const el = sr.querySelector('.content_title')
      return el ? el.textContent || '' : ''
    })
  } catch {
    return ''
  }
}

// Read a computed CSS property off `.content_script` in the shadow root, quote/
// whitespace-normalized. Returns '' on any failure (same reinject-race tolerance
// as readContentTitle). Custom properties round-trip verbatim, so a unique probe
// value gives an exact-equality signal that the new stylesheet is live.
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

// --- test -------------------------------------------------------------------

const test = extensionFixtures(contentDevPath)

test.describe('content reload under --no-browser', () => {
  test.describe.configure({mode: 'serial', timeout: 180000})

  // Captured at collection time, before any test edits the files.
  const ORIGINAL = fs.readFileSync(scriptPath, 'utf8')
  const STYLE_ORIGINAL = fs.readFileSync(stylePath, 'utf8')
  let proc: ChildProcess | null = null

  test.beforeAll(async () => {
    cleanDevRoots(contentExampleDir)
    proc = startDev(contentExampleDir)
    await waitForDevManifest(contentExampleDir)
  })

  test.afterAll(async () => {
    try {
      fs.writeFileSync(scriptPath, ORIGINAL, 'utf8')
    } catch {}
    try {
      fs.writeFileSync(stylePath, STYLE_ORIGINAL, 'utf8')
    } catch {}
    if (proc) await stopDev(proc)
    proc = null
  })

  test('edit re-injects into the open tab in place — no manual reload', async ({
    page
  }) => {
    const marker = `NoBrowserReload-${Date.now()}`

    try {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })

      // Self-mount under --no-browser: the content script ran with no CDP
      // controller present. (Guards the original hmr-no-browser concern live.)
      await expect
        .poll(() => readContentTitle(page), {
          timeout: 45000,
          intervals: [250, 500, 1000]
        })
        .toBe(ANCHOR)

      // Edit -> dev server broadcasts a content-scripts reload -> SW producer
      // re-injects the fresh script into this tab. We never reload it.
      const baseline = getLatestContentScriptMtime(contentExampleDir)
      fs.writeFileSync(scriptPath, ORIGINAL.split(ANCHOR).join(marker), 'utf8')
      await waitForBundleNewerThan(contentExampleDir, baseline, 45000)

      await expect
        .poll(() => readContentTitle(page), {
          timeout: 60000,
          intervals: [500, 1000, 2000]
        })
        .toBe(marker)

      // Revert propagates back the same way.
      const revertBaseline = getLatestContentScriptMtime(contentExampleDir)
      fs.writeFileSync(scriptPath, ORIGINAL, 'utf8')
      await waitForBundleNewerThan(contentExampleDir, revertBaseline, 45000)

      await expect
        .poll(() => readContentTitle(page), {
          timeout: 60000,
          intervals: [500, 1000, 2000]
        })
        .toBe(ANCHOR)
    } finally {
      fs.writeFileSync(scriptPath, ORIGINAL, 'utf8')
    }
  })

  test('a tab opened AFTER an edit gets the fresh build (dynamic re-registration)', async ({
    page,
    context
  }) => {
    const marker = `NoBrowserNewTab-${Date.now()}`

    try {
      // Open a first tab so the SW is alive and the content script mounted once.
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })
      await expect
        .poll(() => readContentTitle(page), {timeout: 45000})
        .toBe(ANCHOR)

      // Edit; wait for the in-place update so we know the reload chain ran and
      // the SW re-registered the dynamic content scripts.
      const baseline = getLatestContentScriptMtime(contentExampleDir)
      fs.writeFileSync(scriptPath, ORIGINAL.split(ANCHOR).join(marker), 'utf8')
      await waitForBundleNewerThan(contentExampleDir, baseline, 45000)
      await expect
        .poll(() => readContentTitle(page), {timeout: 60000})
        .toBe(marker)

      // A BRAND-NEW tab must inject the FRESH build — not the stale build still
      // referenced by the static manifest registration.
      const newTab = await context.newPage()
      try {
        await newTab.goto('https://example.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        })
        await expect
          .poll(() => readContentTitle(newTab), {
            timeout: 60000,
            intervals: [500, 1000, 2000]
          })
          .toBe(marker)
        // Exactly one root — the static (stale) + dynamic (fresh) double-inject
        // must converge to a single fresh mount, not leave a duplicate behind.
        await expect
          .poll(
            () =>
              newTab
                .evaluate(
                  () =>
                    document.querySelectorAll(
                      '[data-extension-root]:not([data-extension-root="extension-js-devtools"])'
                    ).length
                )
                .catch(() => -1),
            {timeout: 15000, intervals: [250, 500, 1000]}
          )
          .toBe(1)
      } finally {
        await newTab.close()
      }
    } finally {
      fs.writeFileSync(scriptPath, ORIGINAL, 'utf8')
    }
  })

  // Deterministic CSS-reload coverage. The launched content-reload suite's CSS
  // phase is flaky on some machines (CSS-in-JS hydration over a raw-CDP tab);
  // this exercises the SAME product behavior through the reliable SW-producer
  // re-injection that both --no-browser and (Option B) launched Chromium use.
  test('CSS edit re-injects styles into the open tab in place', async ({
    page
  }) => {
    const probe = `--reload-probe-${Date.now()}`
    const marker = Date.now().toString(36)

    try {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })
      // Wait until the content script has mounted and applied its stylesheet.
      await expect
        .poll(() => readStyleProbe(page, 'color'), {timeout: 45000})
        .not.toBe('')

      // Append a unique custom property; re-injection re-runs the content script,
      // which re-fetches the (now-edited) stylesheet into its shadow root.
      const baseline = getLatestContentScriptMtime(contentExampleDir)
      fs.writeFileSync(
        stylePath,
        `${STYLE_ORIGINAL}\n.content_script { ${probe}: "${marker}"; }\n`,
        'utf8'
      )
      await waitForBundleNewerThan(contentExampleDir, baseline, 45000)
      await expect
        .poll(() => readStyleProbe(page, probe), {
          timeout: 60000,
          intervals: [500, 1000, 2000]
        })
        .toBe(marker)

      // Revert clears the property the same way.
      const revertBaseline = getLatestContentScriptMtime(contentExampleDir)
      fs.writeFileSync(stylePath, STYLE_ORIGINAL, 'utf8')
      await waitForBundleNewerThan(contentExampleDir, revertBaseline, 45000)
      await expect
        .poll(() => readStyleProbe(page, probe), {
          timeout: 60000,
          intervals: [500, 1000, 2000]
        })
        .toBe('')
    } finally {
      fs.writeFileSync(stylePath, STYLE_ORIGINAL, 'utf8')
    }
  })
})
