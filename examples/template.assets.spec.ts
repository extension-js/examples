// Template asset pipeline verification
//
// For each representative template, verifies that:
//   1. Content scripts render in shadow DOM with expected elements + styles
//   2. HTML pages (action popup, newtab, sidebar) render expected heading
//   3. Icons and images are accessible via extension URLs
//   4. CSS preprocessor output (sass, less, css-modules) produces styles
//   5. Framework components (React, Vue, Svelte, Preact) mount and render
//   6. Background service worker registers successfully
//
// Uses pre-built extensions (resolveBuiltExtensionPath handles building).
// No mocking — real Chromium, real extension, real page rendering.

import {expect} from '@playwright/test'
import {
  extensionFixtures,
  getShadowRootElement,
  waitForShadowElement,
  getSidebarPath,
  resolveBuiltExtensionPath
} from './extension-fixtures.js'
import {getDirname} from './dirname.js'
import path from 'path'
import fs from 'fs'

const __dirname = getDirname(import.meta.url)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readManifest(exampleDir: string): any {
  const manifestPath = path.join(exampleDir, 'src', 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    return null
  }
}

function getPopupPath(manifest: any): string | null {
  return (
    manifest?.action?.default_popup ||
    manifest?.['chromium:action']?.default_popup ||
    manifest?.['firefox:browser_action']?.default_popup ||
    null
  )
}

function getNewtabPath(manifest: any): string | null {
  return manifest?.chrome_url_overrides?.newtab || null
}

function getSidebarHtmlPath(manifest: any): string | null {
  return (
    manifest?.['chromium:side_panel']?.default_path ||
    manifest?.['firefox:sidebar_action']?.default_panel ||
    null
  )
}

function normalize(p: string): string {
  return p.replace(/^\.\//, '')
}

// ---------------------------------------------------------------------------
// Content templates: shadow DOM, styles, images
// ---------------------------------------------------------------------------

const CONTENT_TEMPLATES = [
  {
    name: 'content',
    expectedTitle: 'Content Template',
    hostSelector: '#extension-root, [data-extension-root="true"]',
    expectedBg: 'rgb(10, 12, 16)'
  },
  {
    name: 'content-css-modules',
    expectedTitle: 'Content Template',
    hostSelector: '#extension-root, [data-extension-root="true"]',
    expectedBg: 'rgb(255, 255, 255)'
  },
  {
    name: 'content-sass',
    expectedTitle: 'Content Template',
    hostSelector: '#extension-root, [data-extension-root="true"]',
    expectedBg: 'rgb(10, 12, 16)'
  },
  {
    name: 'content-less',
    expectedTitle: 'Content Template',
    hostSelector: '#extension-root, [data-extension-root="true"]',
    expectedBg: 'rgb(10, 12, 16)'
  },
  {
    name: 'content-sass-modules',
    expectedTitle: 'Content Template',
    hostSelector: '#extension-root, [data-extension-root="true"]',
    expectedBg: 'rgb(10, 12, 16)'
  },
  {
    name: 'content-less-modules',
    expectedTitle: 'Content Template',
    hostSelector: '#extension-root, [data-extension-root="true"]',
    expectedBg: 'rgb(10, 12, 16)'
  },
  {
    name: 'content-main-world',
    expectedTitle: 'Main World Content',
    hostSelector: '[data-extension-root="true"]',
    expectedBg: 'rgb(10, 12, 16)'
  },
  {
    name: 'content-multi-one-entry',
    expectedTitle: 'Content Template',
    hostSelector: '[data-extension-root]',
    expectedBg: 'rgb(26, 31, 46)'
  },
  {
    name: 'content-multi-three-entries',
    expectedTitle: 'Content Template',
    hostSelector: '[data-extension-root]',
    expectedBg: 'rgb(26, 31, 46)'
  }
]

for (const tmpl of CONTENT_TEMPLATES) {
  const exampleDir = path.join(__dirname, tmpl.name)
  if (!fs.existsSync(path.join(exampleDir, 'src', 'manifest.json'))) continue

  const pathToExtension = resolveBuiltExtensionPath(exampleDir)
  const test = extensionFixtures(pathToExtension)

  test.describe(`${tmpl.name}: content script assets`, () => {
    test('shadow DOM host element exists', async ({page}) => {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })
      const host = await waitForShadowElement(
        page,
        tmpl.hostSelector,
        'div, h1',
        30000
      )
      test.expect(host).not.toBeNull()
    })

    test('title element renders expected text', async ({page}) => {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })
      await expect
        .poll(
          async () => {
            return page.evaluate((sel) => {
              const host = document.querySelector(sel)
              if (!host?.shadowRoot) return null
              const el =
                host.shadowRoot.querySelector('h1') ||
                host.shadowRoot.querySelector('h2')
              return el?.textContent || null
            }, tmpl.hostSelector)
          },
          {
            timeout: 30000,
            message: `${tmpl.name}: title should contain "${tmpl.expectedTitle}"`
          }
        )
        .toContain(tmpl.expectedTitle)
    })

    test('container has correct position and background from stylesheet', async ({
      page
    }) => {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })
      // CSS modules/preprocessor modules inject styles asynchronously —
      // poll until the container has position:fixed (proves selectors match).
      await expect
        .poll(
          async () => {
            return page.evaluate((sel) => {
              const host = document.querySelector(sel)
              if (!host?.shadowRoot) return null
              const div = host.shadowRoot.querySelector('div')
              if (!div) return null
              const cs = window.getComputedStyle(div)
              return cs.position === 'fixed' ? true : null
            }, tmpl.hostSelector)
          },
          {
            timeout: 30000,
            message: `${tmpl.name}: container never got position:fixed — CSS module selectors may not match class names`
          }
        )
        .toBe(true)

      // Verify exact background-color to catch mismatched CSS module hashes
      const bg = await page.evaluate((sel) => {
        const host = document.querySelector(sel)
        const div = host!.shadowRoot!.querySelector('div')!
        return window.getComputedStyle(div).backgroundColor
      }, tmpl.hostSelector)
      test
        .expect(bg, `${tmpl.name}: background-color should match stylesheet`)
        .toBe(tmpl.expectedBg)
    })
  })
}

// ---------------------------------------------------------------------------
// HTML page templates: action popup, newtab, sidebar
// ---------------------------------------------------------------------------

interface HtmlTemplate {
  name: string
  getUrl: (extensionId: string, manifest: any) => string | null
  expectedHeading: string
}

const HTML_TEMPLATES: HtmlTemplate[] = [
  {
    name: 'action',
    getUrl: (eid, m) => {
      const p = getPopupPath(m)
      return p ? `chrome-extension://${eid}/${normalize(p)}` : null
    },
    expectedHeading: 'Action Extension'
  },
  {
    name: 'new',
    getUrl: (_eid, _m) => 'chrome://newtab',
    expectedHeading: 'New Extension'
  },
  {
    name: 'sidebar',
    getUrl: (eid, _m) => getSidebarPath(eid),
    expectedHeading: 'Sidebar Extension'
  }
]

for (const tmpl of HTML_TEMPLATES) {
  const exampleDir = path.join(__dirname, tmpl.name)
  if (!fs.existsSync(path.join(exampleDir, 'src', 'manifest.json'))) continue

  const manifest = readManifest(exampleDir)
  if (!manifest) continue

  const pathToExtension = resolveBuiltExtensionPath(exampleDir)
  const test = extensionFixtures(pathToExtension)

  test.describe(`${tmpl.name}: HTML page assets`, () => {
    test('page renders expected heading', async ({page, extensionId}) => {
      const url = tmpl.getUrl(extensionId, manifest)
      test.skip(!url, `${tmpl.name}: no URL could be resolved`)

      await page.goto(url!, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })
      const heading = page.locator('h1, h2').first()
      await test.expect(heading).toBeVisible({timeout: 30000})
      const text = await heading.textContent()
      test.expect(text).toContain(tmpl.expectedHeading)
    })

    test('page has applied CSS (body has non-default styles)', async ({
      page,
      extensionId
    }) => {
      const url = tmpl.getUrl(extensionId, manifest)
      test.skip(!url, `${tmpl.name}: no URL`)

      await page.goto(url!, {
        waitUntil: 'load',
        timeout: 60000
      })

      // All HTML page templates use background-color: #0a0c10 → rgb(10, 12, 16).
      // Asserting the exact value proves the correct stylesheet loaded.
      await expect
        .poll(
          async () =>
            page.evaluate(
              () => window.getComputedStyle(document.body).backgroundColor
            ),
          {
            timeout: 30000,
            message: `${tmpl.name}: CSS not loaded — body background remains default`
          }
        )
        .toBe('rgb(10, 12, 16)')
    })

    test('icon image is accessible', async ({page, extensionId}) => {
      const iconUrl = `chrome-extension://${extensionId}/icons/icon.png`
      const resp = await page.goto(iconUrl, {timeout: 10000})
      test
        .expect(resp?.status(), `${tmpl.name}: icon returned non-200`)
        .toBe(200)
    })
  })
}

// ---------------------------------------------------------------------------
// Framework templates: mount + render
// ---------------------------------------------------------------------------

const FRAMEWORK_TEMPLATES = [
  {name: 'react', selector: '#root, [data-extension-root]'},
  {name: 'vue', selector: '#app, #root, [data-extension-root]'},
  {name: 'svelte', selector: '#root, [data-extension-root]'},
  {name: 'preact', selector: '#root, [data-extension-root]'}
]

for (const tmpl of FRAMEWORK_TEMPLATES) {
  const exampleDir = path.join(__dirname, tmpl.name)
  if (!fs.existsSync(path.join(exampleDir, 'src', 'manifest.json'))) continue

  const manifest = readManifest(exampleDir)
  if (!manifest) continue

  const sidebarHtml = getSidebarHtmlPath(manifest)
  if (!sidebarHtml) continue

  const pathToExtension = resolveBuiltExtensionPath(exampleDir)
  const test = extensionFixtures(pathToExtension)

  test.describe(`${tmpl.name}: framework mount`, () => {
    test('sidebar page mounts framework component', async ({
      page,
      extensionId
    }) => {
      await page.goto(getSidebarPath(extensionId), {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })

      const heading = page.locator('h1, h2').first()
      await test.expect(heading).toBeVisible({timeout: 30000})
    })

    test('content script renders via framework', async ({page}) => {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })

      const host = await waitForShadowElement(
        page,
        '#extension-root, [data-extension-root="true"]',
        'div, h1, h2, p',
        30000
      )
      test
        .expect(host, `${tmpl.name}: content script framework did not mount`)
        .not.toBeNull()
    })
  })
}

// ---------------------------------------------------------------------------
// Background service worker registration
// ---------------------------------------------------------------------------

const BG_TEMPLATES = ['content', 'action', 'javascript', 'new', 'sidebar']

for (const templateName of BG_TEMPLATES) {
  const exampleDir = path.join(__dirname, templateName)
  if (!fs.existsSync(path.join(exampleDir, 'src', 'manifest.json'))) continue

  const manifest = readManifest(exampleDir)
  if (!manifest?.background) continue

  const pathToExtension = resolveBuiltExtensionPath(exampleDir)
  const test = extensionFixtures(pathToExtension)

  test.describe(`${templateName}: background service worker`, () => {
    test('service worker is registered', async ({context}) => {
      const workers = context.serviceWorkers()
      if (workers.length === 0) {
        try {
          await context.waitForEvent('serviceworker', {timeout: 10000})
        } catch {
          // Extension might not have MV3 service worker
        }
      }
      // Either we found workers at start or after waiting
      const allWorkers = context.serviceWorkers()
      const extensionWorkers = allWorkers.filter((w) =>
        w.url().startsWith('chrome-extension://')
      )
      test
        .expect(
          extensionWorkers.length,
          `${templateName}: no extension service worker found`
        )
        .toBeGreaterThan(0)
    })
  })
}
