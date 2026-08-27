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

// The options page is a second surface on top of the four injected elements.
// Only the top-left script carries the Open options button, so the template
// keeps showing what it is about: three manifest entries, three bundles.
test('options page renders', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const h1 = page.locator('h1').first()
  await test.expect(h1).toBeVisible({timeout: 60000})
  const textContent = await h1.textContent()
  test.expect(textContent).toContain('Options')
})

test('options page shows the setting checkbox', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const checkbox = page.locator('#show-badge')
  await test.expect(checkbox).toBeVisible({timeout: 60000})
  await test.expect(checkbox).toBeChecked({timeout: 60000})
  const statusLine = page.locator('#status')
  await test.expect(statusLine).toContainText('chrome.storage.sync', {
    timeout: 60000
  })
})

test('only the top-left element carries the Open options button', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  for (const pos of POSITIONS) {
    const host = page.locator(`[data-extension-root="${pos}"]`)
    await test.expect(host).toBeAttached({timeout: 15000})
    const label = await host.evaluate((el: HTMLElement) => {
      const button = el.shadowRoot?.querySelector('[aria-label="Open options"]')
      return button?.textContent || ''
    })
    test
      .expect(label, `${pos}: only top-left should own the button`)
      .toBe(pos === 'top-left' ? 'Open options' : '')
  }
})

// The options page advertises that unticking the setting takes the injected UI
// off the page, so this asserts the rendered result and not the stored value.
// An earlier version hid the host with a plain `style.display` assignment,
// which the CSSOM drops over the host's own `all: initial !important`: the
// checkbox round-tripped through storage and the badge stayed on screen, and
// every other assertion in this file still passed.
test('unticking the setting actually hides the injected UI', async ({
  page,
  context,
  extensionId
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  // This template injects four elements and only the top-left one reads the
  // setting, so the assertions below stay on that one.
  const host = page.locator('[data-extension-root="top-left"]')
  await test.expect(host).toBeAttached({timeout: 30000})
  // The UI lives in a shadow root, so reach through the host for the button
  // the page itself never has.
  const injectedUi = host.locator('css=[aria-label="Open options"]')
  await test.expect(injectedUi).toBeVisible({timeout: 30000})

  const optionsPage = await context.newPage()
  await optionsPage.goto(
    `chrome-extension://${extensionId}/options/index.html`,
    {waitUntil: 'domcontentloaded', timeout: 60000}
  )
  const status = optionsPage.locator('#status')
  // The checkbox starts unchecked in markup and is filled in from storage, so
  // wait for that read before toggling or the load can undo the click.
  await test.expect(status).toContainText('chrome.storage.sync', {
    timeout: 60000
  })
  const checkbox = optionsPage.locator('#show-badge')
  await test.expect(checkbox).toBeChecked({timeout: 60000})
  await checkbox.uncheck()
  await test.expect(status).toContainText('Saved', {timeout: 60000})
  await page.bringToFront()

  await test.expect
    .poll(
      async () =>
        host.evaluate((el: HTMLElement) => window.getComputedStyle(el).display),
      {timeout: 20000, message: 'the host never reached display none'}
    )
    .toBe('none')
  await test.expect(injectedUi).toBeHidden({timeout: 20000})

  await optionsPage.bringToFront()
  await checkbox.check()
  await page.bringToFront()
  await test.expect(injectedUi).toBeVisible({timeout: 20000})
  await test.expect
    .poll(
      async () =>
        host.evaluate((el: HTMLElement) => window.getComputedStyle(el).display),
      {timeout: 20000, message: 'the host never came back'}
    )
    .not.toBe('none')
  await optionsPage.close()
})
