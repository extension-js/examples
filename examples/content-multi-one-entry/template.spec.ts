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

// The options page is a second surface on top of the four injected elements.
// Only the top-left script carries the Open options button, so the template
// keeps showing what it is about: one manifest entry, four scripts.
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
