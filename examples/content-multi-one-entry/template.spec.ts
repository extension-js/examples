// content-multi-one-entry: 4 scripts in a single content_scripts manifest entry.
// Import tree: script-*.js → utils/create-badge.js → utils/constants.js
// Validates: all 4 positions render, deep import chain resolves, badge text
// from level-2 constants appears in all shadow DOMs.

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
const TITLES = [
  'Content Template #1',
  'Content Template #2',
  'Content Template #3',
  'Content Template #4'
]

test('all four shadow DOM hosts are injected', async ({page}) => {
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

test('each position renders its own title', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  for (let i = 0; i < POSITIONS.length; i++) {
    const host = page.locator(`[data-extension-root="${POSITIONS[i]}"]`)
    await test.expect(host).toBeAttached({timeout: 15000})
    const title = await host.evaluate((el: HTMLElement) => {
      return el.shadowRoot?.querySelector('h1')?.textContent || ''
    })
    test
      .expect(title, `${POSITIONS[i]} should show "${TITLES[i]}"`)
      .toBe(TITLES[i])
  }
})

// Key test: badge text comes from a level-2 import
// (constants.js → create-badge.js → script-*.js). If the import tree
// is broken at any level, the badge won't render.
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
      .expect(badgeText, `${pos}: badge should include version from constants`)
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

baseTest(
  'single manifest entry produces single content script bundle',
  async () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pathToExtension, 'manifest.json'), 'utf8')
    )
    baseTest.expect(manifest.content_scripts).toHaveLength(1)
    baseTest
      .expect(manifest.content_scripts[0].js)
      .toEqual(['content_scripts/content-0.js'])
  }
)
