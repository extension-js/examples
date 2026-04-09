// content-multi-three-entries: 4 scripts across 3 manifest content_scripts entries.
// Entry 0: [script-top-left.js, script-top-right.js] → content-0.js
// Entry 1: [script-bottom-left.js]                    → content-1.js
// Entry 2: [script-bottom-right.js]                   → content-2.js
//
// Import tree (per script): script-*.js → utils/create-badge.js → utils/constants.js
// Validates: entry isolation, cross-entry shared imports resolve, badge renders.

import fs from 'fs'
import path from 'path'
import {test as baseTest} from '@playwright/test'
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

const POSITIONS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const

test('all four shadow DOM hosts are injected across three entries', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  for (const pos of POSITIONS) {
    const host = page.locator(`[data-extension-root="${pos}"]`)
    await test.expect(host).toBeAttached({timeout: 15000})
    const hasShadow = await host.evaluate((el: HTMLElement) => !!el.shadowRoot)
    test.expect(hasShadow, `${pos} should have a shadow root`).toBe(true)
  }
})

// Badge from deep import chain verifies shared dependencies resolve in each
// independently-bundled entry. constants.js is imported transitively by all
// four scripts, but they live in three separate bundles.
test('badge from deep import chain renders in all positions', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  for (const pos of POSITIONS) {
    const host = page.locator(`[data-extension-root="${pos}"]`)
    await test.expect(host).toBeAttached({timeout: 15000})

    const badgeText = await host.evaluate((el: HTMLElement) => {
      const badge = el.shadowRoot?.querySelector('[data-badge]')
      return badge?.textContent || ''
    })
    test
      .expect(
        badgeText,
        `${pos}: badge from constants.js → create-badge.js should render`
      )
      .toContain('extension.js')
    test
      .expect(badgeText, `${pos}: badge should include version`)
      .toContain('v1')
  }
})

test('all positions have styled containers (position:fixed)', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  for (const pos of POSITIONS) {
    const host = page.locator(`[data-extension-root="${pos}"]`)
    await test.expect(host).toBeAttached({timeout: 15000})

    await test.expect
      .poll(
        async () => {
          return host.evaluate((el: HTMLElement) => {
            const div = el.shadowRoot?.querySelector('div')
            if (!div) return null
            return window.getComputedStyle(div).position
          })
        },
        {timeout: 15000, message: `${pos}: styles never applied`}
      )
      .toBe('fixed')
  }
})

// Verify the build tool preserves the 3-entry structure from the source manifest.
// Each entry must produce its own bundle so the browser loads them independently.
baseTest(
  'three manifest entries produce three separate content script bundles',
  async () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pathToExtension, 'manifest.json'), 'utf8')
    )
    baseTest.expect(manifest.content_scripts).toHaveLength(3)
    // Entry 0: two scripts bundled together
    baseTest
      .expect(manifest.content_scripts[0].js)
      .toEqual(['content_scripts/content-0.js'])
    // Entry 1: one script
    baseTest
      .expect(manifest.content_scripts[1].js)
      .toEqual(['content_scripts/content-1.js'])
    // Entry 2: one script
    baseTest
      .expect(manifest.content_scripts[2].js)
      .toEqual(['content_scripts/content-2.js'])
    // All three bundles must exist on disk
    for (let i = 0; i < 3; i++) {
      const jsPath = path.join(
        pathToExtension,
        `content_scripts/content-${i}.js`
      )
      baseTest
        .expect(fs.existsSync(jsPath), `content-${i}.js should exist`)
        .toBe(true)
    }
  }
)

// Verify shared imports are resolved in each independently-bundled entry.
// constants.js exports are used in all 4 scripts across 3 bundles.
// Each bundle must include the constants (no shared chunk for content scripts).
baseTest(
  'each bundle contains the shared constants (no cross-bundle import)',
  async () => {
    for (let i = 0; i < 3; i++) {
      const jsPath = path.join(
        pathToExtension,
        `content_scripts/content-${i}.js`
      )
      const code = fs.readFileSync(jsPath, 'utf8')
      baseTest
        .expect(
          code.includes('extension.js'),
          `content-${i}.js should contain BADGE_LABEL from constants.js`
        )
        .toBe(true)
    }
  }
)
