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
  },
  {
    name: 'content-typescript',
    expectedTitle: 'Content Template',
    hostSelector: '#extension-root, [data-extension-root="true"]',
    expectedBg: 'rgb(10, 12, 16)'
  },
  {
    name: 'content-env',
    expectedTitle: 'Content Template',
    hostSelector: '#extension-root, [data-extension-root="true"]',
    expectedBg: 'rgb(10, 12, 16)'
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
// Tailwind content templates: stylesheet must be PostCSS-compiled
// ---------------------------------------------------------------------------
//
// Regression guard for the `?url` / `new URL(..., import.meta.url)` class of
// bugs where the raw stylesheet (with `@import "tailwindcss"`) ships instead
// of the compiled output. Symptoms when broken:
//   - h2 with `text-white` falls back to default black
//   - flex/grid/sizing utilities no-op, collapsing the wrapper to intrinsic
//     content size — often pushing it off-screen
// Asserting the computed h2 color and an in-viewport bounding rect catches
// both failure modes deterministically.
const TAILWIND_CONTENT_TEMPLATES = [
  'content-react',
  'content-preact',
  'content-vue',
  'content-svelte'
]

// Extract the compiled CSS that a content script would fetch at runtime.
// Handles both emission modes that the build may produce:
//   - A standalone file under content_scripts/*.css (when CSS is large enough)
//   - An inlined data URI embedded in a content_scripts/*.js bundle (when small)
// Returns null if no CSS could be located under the built extension dir.
function readCompiledContentCss(builtExtDir: string): string | null {
  const csDir = path.join(builtExtDir, 'content_scripts')
  if (!fs.existsSync(csDir)) return null
  const entries = fs.readdirSync(csDir, {withFileTypes: true})
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.css')) {
      return fs.readFileSync(path.join(csDir, entry.name), 'utf8')
    }
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue
    const js = fs.readFileSync(path.join(csDir, entry.name), 'utf8')
    const m = js.match(/"data:text\/css;base64,([A-Za-z0-9+/=]+)"/)
    if (m) return Buffer.from(m[1], 'base64').toString('utf8')
  }
  return null
}

for (const name of TAILWIND_CONTENT_TEMPLATES) {
  const exampleDir = path.join(__dirname, name)
  if (!fs.existsSync(path.join(exampleDir, 'src', 'manifest.json'))) continue

  const pathToExtension = resolveBuiltExtensionPath(exampleDir)
  const test = extensionFixtures(pathToExtension)
  const hostSelector = '#extension-root, [data-extension-root="true"]'

  test.describe(`${name}: tailwind content script assets`, () => {
    test('compiled CSS contains tailwind output (build-time check)', async () => {
      const css = readCompiledContentCss(pathToExtension)
      test
        .expect(
          css,
          `${name}: no CSS asset located under content_scripts/ — check build pipeline`
        )
        .not.toBeNull()
      // Source is `@import "tailwindcss"` (~30 bytes). If PostCSS ran, the
      // compiled output is many KB and carries the tailwindcss header marker
      // plus actual utility class rules we reference in the components. If
      // either is missing, the raw source shipped uncompiled — the exact
      // class of bug that would escape to users as an invisible widget.
      test
        .expect(
          /tailwindcss/i.test(css!),
          `${name}: emitted CSS missing tailwindcss header — stylesheet shipped uncompiled`
        )
        .toBe(true)
      test
        .expect(
          /\.text-white(?:[^a-zA-Z0-9_-]|$)/.test(css!),
          `${name}: emitted CSS missing .text-white rule — tailwind utility classes were not compiled`
        )
        .toBe(true)
      test
        .expect(
          !/@import\s+["']tailwindcss["']/.test(css!),
          `${name}: emitted CSS still contains raw @import "tailwindcss" directive — PostCSS never ran`
        )
        .toBe(true)
    })

    test('h2 computed color is white (tailwind compiled)', async ({page}) => {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })
      const h2 = await waitForShadowElement(page, hostSelector, 'h2', 30000)
      test.expect(h2, `${name}: h2 not found in shadow DOM`).not.toBeNull()
      await expect
        .poll(
          async () =>
            page.evaluate((sel) => {
              const host = document.querySelector(sel)
              const el = host?.shadowRoot?.querySelector('h2')
              if (!el) return null
              return window
                .getComputedStyle(el as HTMLElement)
                .getPropertyValue('color')
            }, hostSelector),
          {
            timeout: 30000,
            message: `${name}: h2 text-white resolved to default color — tailwind stylesheet shipped uncompiled`
          }
        )
        .toBe('rgb(255, 255, 255)')
    })

    test('shadow container renders within viewport', async ({page}) => {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })
      const host = await waitForShadowElement(page, hostSelector, 'div', 30000)
      test
        .expect(host, `${name}: content container not found in shadow DOM`)
        .not.toBeNull()
      const rect = await host!.evaluate((node) => {
        const r = (node as HTMLElement).getBoundingClientRect()
        return {x: r.x, y: r.y, w: r.width, h: r.height}
      })
      const vp = page.viewportSize() || {width: 1280, height: 720}
      test
        .expect(
          rect.x + rect.w > 0 && rect.y + rect.h > 0,
          `${name}: container rendered off-screen: ${JSON.stringify(rect)}`
        )
        .toBe(true)
      test
        .expect(
          rect.x < vp.width && rect.y < vp.height,
          `${name}: container past viewport: ${JSON.stringify(rect)} vs ${vp.width}x${vp.height}`
        )
        .toBe(true)
    })
  })
}

// ---------------------------------------------------------------------------
// Pill-style content templates: javascript / typescript / framework starters
// ---------------------------------------------------------------------------
//
// These templates render a button.content_pill inside a shadow-DOM wrapper.
// The pill has `background: var(--sidebar-bg, #0a0c10)` — a plain CSS fallback
// that resolves to rgb(10, 12, 16) when the stylesheet is actually applied.
// Asserting the pill's computed background catches the same "CSS never
// applied" class of regression as the tailwind suite above, for templates
// that don't use tailwind utilities.
const PILL_CONTENT_TEMPLATES = [
  'javascript',
  'typescript',
  'react',
  'preact',
  'vue',
  'svelte'
]

for (const name of PILL_CONTENT_TEMPLATES) {
  const exampleDir = path.join(__dirname, name)
  if (!fs.existsSync(path.join(exampleDir, 'src', 'manifest.json'))) continue

  const pathToExtension = resolveBuiltExtensionPath(exampleDir)
  const test = extensionFixtures(pathToExtension)
  const hostSelector = '#extension-root, [data-extension-root="true"]'

  test.describe(`${name}: pill content script assets`, () => {
    test('pill renders with expected background', async ({page}) => {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })
      const pill = await waitForShadowElement(
        page,
        hostSelector,
        '.content_pill',
        30000
      )
      test
        .expect(pill, `${name}: .content_pill not found in shadow DOM`)
        .not.toBeNull()
      await expect
        .poll(
          async () =>
            page.evaluate((sel) => {
              const host = document.querySelector(sel)
              const el = host?.shadowRoot?.querySelector('.content_pill')
              if (!el) return null
              return window
                .getComputedStyle(el as HTMLElement)
                .getPropertyValue('background-color')
            }, hostSelector),
          {
            timeout: 30000,
            message: `${name}: .content_pill background did not resolve to sidebar-bg #0a0c10 — CSS never applied`
          }
        )
        .toBe('rgb(10, 12, 16)')
    })

    test('pill text "Open sidebar" is visible on screen', async ({page}) => {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })
      const textEl = await waitForShadowElement(
        page,
        hostSelector,
        '.content_pill_text',
        30000
      )
      test
        .expect(textEl, `${name}: .content_pill_text not found`)
        .not.toBeNull()
      const info = await textEl!.evaluate((el) => {
        const r = (el as HTMLElement).getBoundingClientRect()
        return {
          text: el.textContent || '',
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height
        }
      })
      test
        .expect(info.text.trim(), `${name}: pill text mismatch`)
        .toBe('Open sidebar')
      const vp = page.viewportSize() || {width: 1280, height: 720}
      test
        .expect(
          info.w > 0 && info.h > 0 && info.x < vp.width && info.y < vp.height,
          `${name}: pill text not visible: ${JSON.stringify(info)}`
        )
        .toBe(true)
    })
  })
}

// ---------------------------------------------------------------------------
// content-custom-font: fonts + plain CSS (via @import "tailwindcss" passthrough)
// ---------------------------------------------------------------------------
{
  const name = 'content-custom-font'
  const exampleDir = path.join(__dirname, name)
  if (fs.existsSync(path.join(exampleDir, 'src', 'manifest.json'))) {
    const pathToExtension = resolveBuiltExtensionPath(exampleDir)
    const test = extensionFixtures(pathToExtension)
    const hostSelector = '#extension-root, [data-extension-root="true"]'

    test.describe(`${name}: content script assets`, () => {
      test('compiled CSS has no raw @import "tailwindcss"', async () => {
        const css = readCompiledContentCss(pathToExtension)
        test.expect(css, `${name}: no CSS asset emitted`).not.toBeNull()
        test
          .expect(
            !/@import\s+["']tailwindcss["']/.test(css!),
            `${name}: emitted CSS still contains raw @import "tailwindcss" — PostCSS never ran`
          )
          .toBe(true)
      })

      test('container background resolves to #f3f4f6', async ({page}) => {
        await page.goto('https://example.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        })
        const host = await waitForShadowElement(
          page,
          hostSelector,
          '.content_script',
          30000
        )
        test.expect(host, `${name}: .content_script not found`).not.toBeNull()
        await expect
          .poll(
            async () =>
              page.evaluate((sel) => {
                const h = document.querySelector(sel)
                const el = h?.shadowRoot?.querySelector('.content_script')
                if (!el) return null
                return window
                  .getComputedStyle(el as HTMLElement)
                  .getPropertyValue('background-color')
              }, hostSelector),
            {
              timeout: 30000,
              message: `${name}: .content_script background did not resolve — CSS not applied`
            }
          )
          .toBe('rgb(243, 244, 246)')
      })

      test('custom font glyph text renders on screen', async ({page}) => {
        await page.goto('https://example.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        })
        const demo = await waitForShadowElement(
          page,
          hostSelector,
          '.font_demo.font_momo_signature',
          30000
        )
        test
          .expect(demo, `${name}: .font_demo.font_momo_signature not found`)
          .not.toBeNull()
        const rect = await demo!.evaluate((el) => {
          const r = (el as HTMLElement).getBoundingClientRect()
          return {x: r.x, y: r.y, w: r.width, h: r.height}
        })
        const vp = page.viewportSize() || {width: 1280, height: 720}
        test
          .expect(
            rect.w > 0 && rect.h > 0 && rect.x < vp.width && rect.y < vp.height,
            `${name}: font demo block not visible: ${JSON.stringify(rect)}`
          )
          .toBe(true)
      })
    })
  }
}

// ---------------------------------------------------------------------------
// new-browser-flags: inline-styled indicator (no shadow DOM)
// ---------------------------------------------------------------------------
{
  const name = 'new-browser-flags'
  const exampleDir = path.join(__dirname, name)
  if (fs.existsSync(path.join(exampleDir, 'src', 'manifest.json'))) {
    const pathToExtension = resolveBuiltExtensionPath(exampleDir)
    const test = extensionFixtures(pathToExtension)

    test.describe(`${name}: content script indicator`, () => {
      test('indicator text appears on the page', async ({page}) => {
        await page.goto('https://example.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        })
        // Indicator is created inline and auto-removed after 5s. Poll with a
        // short window to catch it before teardown.
        await expect
          .poll(
            async () =>
              page.evaluate(() => {
                const el = Array.from(document.querySelectorAll('div')).find(
                  (d) =>
                    (d.textContent || '').includes(
                      'Browser Flags Extension Loaded!'
                    )
                )
                if (!el) return null
                const r = el.getBoundingClientRect()
                return {
                  visible: r.width > 0 && r.height > 0,
                  bg: window.getComputedStyle(el).backgroundColor
                }
              }),
            {
              timeout: 8000,
              intervals: [200],
              message: `${name}: indicator never appeared on page`
            }
          )
          .toMatchObject({visible: true, bg: 'rgb(76, 175, 80)'})
      })
    })
  }
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
      // Icons keep their in-project paths in the build output (extension
      // >= 4.0.4), so the manifest declaration is the source of truth.
      const iconPath = Object.values(manifest?.icons ?? {})[0] as
        | string
        | undefined
      test.skip(!iconPath, `${tmpl.name}: manifest declares no icons`)

      const iconUrl = `chrome-extension://${extensionId}/${normalize(iconPath!)}`
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
