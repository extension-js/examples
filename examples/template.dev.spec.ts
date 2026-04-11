// HMR live-update tests for HTML-page templates (popups, newtab, sidebar).
//
// Scope: verifies that editing an HTML source file triggers a live update
// in the browser WITHOUT a manual reload (HMR/hot-reload path).
//
// Does NOT test hard-reload persistence — that's in template.reload.spec.ts.
// Does NOT test content scripts — those don't use HMR (they use CDP reinject).
//
// Complementary to:
//   template.reload.spec.ts  — hard-reload persistence + content scripts
//   template.assets.spec.ts  — rendered output verification (shadow DOM, CSS, etc.)
//   template.multi-browser.spec.ts — production build × browser matrix

import {expect} from '@playwright/test'
import fs from 'fs'
import path from 'path'
import {spawn, type ChildProcess} from 'child_process'
import {getDirname} from './dirname.js'
import {
  extensionFixtures,
  getShadowRootElement,
  getSidebarPath
} from './extension-fixtures.js'

type Manifest = {
  content_scripts?: Array<{js?: string[]}>
  action?: {default_popup?: string}
  chrome_url_overrides?: {newtab?: string}
  ['chromium:action']?: {default_popup?: string}
  ['firefox:browser_action']?: {default_popup?: string}
  ['chromium:side_panel']?: {default_path?: string}
  ['firefox:sidebar_action']?: {default_panel?: string}
}

const __dirname = getDirname(import.meta.url)
const examplesDir = __dirname

const DEV_ROOTS = ['.extension', 'dist', 'build']
const DEV_CHANNELS = ['chrome', 'chromium', 'chrome-mv3']
const localCliCjs = process.env.EXTENSION_LOCAL_CLI_CJS || ''

function listExampleDirs(): string[] {
  return fs
    .readdirSync(examplesDir, {withFileTypes: true})
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => name !== 'init')
}

function cleanDevRoots(exampleDir: string) {
  for (const root of DEV_ROOTS) {
    try {
      fs.rmSync(path.join(exampleDir, root), {recursive: true, force: true})
    } catch {
      // Best-effort cleanup for deterministic retries.
    }
  }
}

function readManifest(exampleDir: string): Manifest | null {
  const manifestPath = path.join(exampleDir, 'src', 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    return null
  }
}

function normalizeRelativePath(value: string): string {
  return value.replace(/^\.\//, '')
}

function getHtmlEntryPath(manifest: Manifest): string | null {
  return (
    manifest.action?.default_popup ||
    manifest['chromium:action']?.default_popup ||
    manifest['firefox:browser_action']?.default_popup ||
    manifest.chrome_url_overrides?.newtab ||
    manifest['chromium:side_panel']?.default_path ||
    manifest['firefox:sidebar_action']?.default_panel ||
    null
  )
}

async function waitForDevManifest(
  exampleDir: string,
  timeoutMs = 60000
): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    for (const root of DEV_ROOTS) {
      for (const channel of DEV_CHANNELS) {
        const candidate = path.join(exampleDir, root, channel)
        if (fs.existsSync(path.join(candidate, 'manifest.json'))) {
          return candidate
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Dev manifest not found for ${exampleDir}`)
}

function appendHtmlBodyProbe(source: string, marker: string): string {
  const probe = `\n<div data-extjs-dev-live-probe="true">${marker}</div>\n`
  if (source.includes('</body>')) {
    return source.replace('</body>', `${probe}</body>`)
  }
  return `${source}${probe}`
}

function getHtmlPageUrl(
  manifest: Manifest,
  extensionId: string,
  entryPath: string
): string {
  if (
    manifest.chrome_url_overrides?.newtab &&
    normalizeRelativePath(manifest.chrome_url_overrides.newtab) === entryPath
  ) {
    return 'chrome://newtab'
  }
  if (entryPath.includes('sidebar/')) {
    return getSidebarPath(extensionId)
  }
  return `chrome-extension://${extensionId}/${entryPath}`
}

function startDev(exampleDir: string): ChildProcess {
  const env = {
    ...process.env,
    EXTENSION_AUTHOR_MODE: 'true'
  }
  const spawnOpts = {cwd: exampleDir, env, stdio: 'pipe' as const}
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
  if (proc.killed) return
  proc.kill('SIGTERM')
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5000)
    proc.on('close', () => {
      clearTimeout(timeout)
      resolve(null)
    })
  })
}

async function expectHtmlText(page: any, text: string) {
  await expect
    .poll(
      async () => ((await page.locator('body').textContent()) || '').trim(),
      {
        timeout: 60000
      }
    )
    .toContain(text)
}

async function expectHtmlTextAbsent(page: any, text: string) {
  await expect
    .poll(
      async () => ((await page.locator('body').textContent()) || '').trim(),
      {
        timeout: 60000
      }
    )
    .not.toContain(text)
}

const examples = listExampleDirs()

for (const example of examples) {
  const exampleDir = path.join(examplesDir, example)
  const manifest = readManifest(exampleDir)
  if (!manifest) continue

  const htmlEntryPath = getHtmlEntryPath(manifest)

  if (htmlEntryPath) {
    const devPath = path.join(exampleDir, 'dist', 'chromium')
    const test = extensionFixtures(devPath)

    test.describe(`${example}: dev html`, () => {
      test.describe.configure({mode: 'serial'})

      let proc: ReturnType<typeof startDev> | null = null
      const entryPath = normalizeRelativePath(htmlEntryPath)

      test.beforeAll(async () => {
        cleanDevRoots(exampleDir)
        proc = startDev(exampleDir)
        await waitForDevManifest(exampleDir)
      })

      test.afterAll(async () => {
        if (proc) await stopDev(proc)
      })

      test('updates html UI on change', async ({page, extensionId}) => {
        const filePath = path.join(exampleDir, 'src', entryPath)
        const original = fs.readFileSync(filePath, 'utf8')

        const pageUrl = getHtmlPageUrl(manifest, extensionId, entryPath)

        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        })
        const updatedText = `DevLiveHtmlUpdate${Date.now()}`

        try {
          const updated = appendHtmlBodyProbe(original, updatedText)
          fs.writeFileSync(filePath, updated, 'utf8')
          await expectHtmlText(page, updatedText)
          fs.writeFileSync(filePath, original, 'utf8')
          await expectHtmlTextAbsent(page, updatedText)
        } finally {
          fs.writeFileSync(filePath, original, 'utf8')
        }
      })

      test('recovers after syntax error in html entry', async ({
        page,
        extensionId
      }) => {
        const filePath = path.join(exampleDir, 'src', entryPath)
        const original = fs.readFileSync(filePath, 'utf8')

        const pageUrl = getHtmlPageUrl(manifest, extensionId, entryPath)

        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        })
        const recoveredText = `DevLiveHtmlRecovered${Date.now()}`

        try {
          const broken = `${original}\n<script>const __SYNTAX_ERROR__ = ;</script>\n`
          fs.writeFileSync(filePath, broken, 'utf8')
          const recovered = appendHtmlBodyProbe(original, recoveredText)
          fs.writeFileSync(filePath, recovered, 'utf8')
          await expectHtmlText(page, recoveredText)
          fs.writeFileSync(filePath, original, 'utf8')
          await expectHtmlTextAbsent(page, recoveredText)
        } finally {
          fs.writeFileSync(filePath, original, 'utf8')
        }
      })
    })
  }
}

// ---------------------------------------------------------------------------
// Content script: live-update + hard-reload persistence
// ---------------------------------------------------------------------------
// Verifies that editing a content script source file:
//   1. Live-updates the injected shadow DOM on the page.
//   2. Survives multiple Cmd+Shift+R (hard reload) cycles.
//   3. Does not flash stale content from a previous edit after a new edit.
// ---------------------------------------------------------------------------

const contentExampleDir = path.join(examplesDir, 'content')
const contentManifest = readManifest(contentExampleDir)

if (
  contentManifest?.content_scripts?.some(
    (cs) => Array.isArray(cs.js) && cs.js.length > 0
  )
) {
  const contentDevPath = path.join(contentExampleDir, 'dist', 'chromium')
  const contentTest = extensionFixtures(contentDevPath)

  // FIXME: Content script reload depends on a timing-sensitive chain:
  // file change → recompile (new hash) → CDP extension reload → re-inject.
  // This is flaky in test environments. Stabilise the reload mechanism first.
  contentTest.describe.skip('content: dev hard-reload persistence', () => {
    contentTest.describe.configure({mode: 'serial'})

    let proc: ReturnType<typeof startDev> | null = null

    contentTest.beforeAll(async () => {
      cleanDevRoots(contentExampleDir)
      proc = startDev(contentExampleDir)
      await waitForDevManifest(contentExampleDir)
    })

    contentTest.afterAll(async () => {
      if (proc) await stopDev(proc)
    })

    contentTest(
      'content script edit persists across hard reloads',
      async ({page}) => {
        const scriptPath = path.join(
          contentExampleDir,
          'src',
          'content',
          'scripts.js'
        )
        const original = fs.readFileSync(scriptPath, 'utf8')
        const marker = `E2E-PERSIST-${Date.now()}`

        try {
          await page.goto('https://example.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
          })

          const initialTitle = await getShadowRootElement(
            page,
            '[data-extension-root="true"]',
            '.content_title'
          )
          expect(initialTitle).not.toBeNull()
          expect(await initialTitle!.textContent()).toBe('Content Template')

          const edited = original.replace('Content Template', marker)
          fs.writeFileSync(scriptPath, edited, 'utf8')

          await expect
            .poll(
              async () => {
                await page.reload({waitUntil: 'domcontentloaded'})
                const el = await getShadowRootElement(
                  page,
                  '[data-extension-root="true"]',
                  '.content_title',
                  5000
                )
                return el ? await el.textContent() : ''
              },
              {timeout: 30000}
            )
            .toBe(marker)

          for (let i = 0; i < 3; i++) {
            await page.reload({waitUntil: 'domcontentloaded'})

            const el = await getShadowRootElement(
              page,
              '[data-extension-root="true"]',
              '.content_title',
              15000
            )
            expect(
              el ? await el.textContent() : '',
              `hard reload #${i + 1} reverted to stale content`
            ).toBe(marker)
          }

          const marker2 = `E2E-PERSIST-2-${Date.now()}`
          const edited2 = original.replace('Content Template', marker2)
          fs.writeFileSync(scriptPath, edited2, 'utf8')

          await expect
            .poll(
              async () => {
                await page.reload({waitUntil: 'domcontentloaded'})
                const el = await getShadowRootElement(
                  page,
                  '[data-extension-root="true"]',
                  '.content_title',
                  5000
                )
                return el ? await el.textContent() : ''
              },
              {timeout: 30000}
            )
            .toBe(marker2)

          await page.reload({waitUntil: 'domcontentloaded'})

          const finalEl = await getShadowRootElement(
            page,
            '[data-extension-root="true"]',
            '.content_title',
            15000
          )
          const finalText = finalEl ? await finalEl.textContent() : ''
          expect(finalText).toBe(marker2)
          expect(finalText).not.toBe(marker)
        } finally {
          fs.writeFileSync(scriptPath, original, 'utf8')
        }
      }
    )
  })

  // JS syntax error recovery: break the content script, then fix it.
  // Verifies the dev server survives a JS syntax error and recovers.
  // FIXME: Same timing issue as hard-reload persistence above.
  contentTest.describe.skip('content: dev JS syntax error recovery', () => {
    contentTest.describe.configure({mode: 'serial', timeout: 120000})

    let jsProc: ReturnType<typeof startDev> | null = null

    contentTest.beforeAll(async () => {
      cleanDevRoots(contentExampleDir)
      jsProc = startDev(contentExampleDir)
      await waitForDevManifest(contentExampleDir)
    })

    contentTest.afterAll(async () => {
      if (jsProc) await stopDev(jsProc)
    })

    contentTest(
      'recovers after JS syntax error in content script',
      async ({page}) => {
        const scriptPath = path.join(
          contentExampleDir,
          'src',
          'content',
          'scripts.js'
        )
        const original = fs.readFileSync(scriptPath, 'utf8')
        const marker = `JS-RECOVER-${Date.now()}`

        try {
          await page.goto('https://example.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
          })

          // Verify initial render
          const initialEl = await getShadowRootElement(
            page,
            '[data-extension-root="true"]',
            '.content_title',
            15000
          )
          expect(initialEl).not.toBeNull()

          // Introduce a JS syntax error
          const broken = original.replace(
            'export default function',
            'export default function\nconst __SYNTAX_ERROR__ = ;'
          )
          fs.writeFileSync(scriptPath, broken, 'utf8')

          // Wait for the dev server to attempt recompile (may error)
          await new Promise((r) => setTimeout(r, 5000))

          // Fix: replace title with marker
          const fixed = original.replace('Content Template', marker)
          fs.writeFileSync(scriptPath, fixed, 'utf8')

          // The dev server should recover and the new content should appear
          await expect
            .poll(
              async () => {
                await page.reload({waitUntil: 'domcontentloaded'})
                const el = await getShadowRootElement(
                  page,
                  '[data-extension-root="true"]',
                  '.content_title',
                  5000
                )
                return el ? await el.textContent() : ''
              },
              {timeout: 60000}
            )
            .toBe(marker)
        } finally {
          fs.writeFileSync(scriptPath, original, 'utf8')
        }
      }
    )
  })
}

// ---------------------------------------------------------------------------
// Dev-mode CSS link injection & React HMR verification
// ---------------------------------------------------------------------------
// Verifies that:
//   1. Dev-mode HTML output contains a <link rel="stylesheet"> tag.
//   2. React Fast Refresh runtime is present (no $RefreshSig$ errors).
// Uses `new-react` as the representative React + CSS template.
// ---------------------------------------------------------------------------

const reactExampleDir = path.join(examplesDir, 'new-react')
const reactManifest = readManifest(reactExampleDir)

if (reactManifest) {
  const reactDevPath = path.join(reactExampleDir, 'dist', 'chromium')
  const reactTest = extensionFixtures(reactDevPath)

  reactTest.describe('new-react: dev CSS link & React HMR', () => {
    reactTest.describe.configure({mode: 'serial'})

    let proc: ReturnType<typeof startDev> | null = null

    reactTest.beforeAll(async () => {
      cleanDevRoots(reactExampleDir)
      proc = startDev(reactExampleDir)
      await waitForDevManifest(reactExampleDir)
    })

    reactTest.afterAll(async () => {
      if (proc) await stopDev(proc)
    })

    reactTest(
      'dev HTML output includes a CSS stylesheet link',
      async ({page, extensionId}) => {
        await page.goto(
          `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`,
          {waitUntil: 'domcontentloaded', timeout: 60000}
        )

        // Verify the <link rel="stylesheet"> tag was injected by patch-html
        const cssLink = page.locator('link[rel="stylesheet"]')
        await expect(cssLink).toHaveCount(1, {timeout: 10000})
        const href = await cssLink.getAttribute('href')
        expect(href).toMatch(/\.css$/)
      }
    )

    reactTest(
      'React page renders without $RefreshSig$ errors',
      async ({page, extensionId}) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))

        await page.goto(
          `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`,
          {waitUntil: 'domcontentloaded', timeout: 60000}
        )

        // Wait for React to mount
        const heading = page.locator('h1')
        await expect(heading).toBeVisible({timeout: 30000})

        // No $RefreshSig$ or $RefreshReg$ errors should have fired
        const refreshErrors = errors.filter(
          (e) => e.includes('$RefreshSig$') || e.includes('$RefreshReg$')
        )
        expect(
          refreshErrors,
          'React Fast Refresh runtime errors detected'
        ).toHaveLength(0)
      }
    )
  })
}
