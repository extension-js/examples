// content-main-world: Single content script in MAIN world context.
// Import tree: scripts.js → utils/create-badge.js → utils/constants.js
// Validates: MAIN world execution, deep import chain, badge from constants,
// computed styles, and window property proving main-world access.

import fs from 'fs'
import path from 'path'
import {test as baseTest} from '@playwright/test'
import {
  extensionFixtures,
  waitForShadowElement,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('shadow DOM host with content_script class exists', async ({page}) => {
  await page.goto('https://example.com/')
  const div = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script'
  )
  test.expect(div).not.toBeNull()
})

test('h1 renders Main World Content text', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  const h1 = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script > h1',
    30000
  )
  test.expect(h1).not.toBeNull()
  const text = await h1!.evaluate((node) => node.textContent)
  test.expect(text).toContain('Main World Content')
})

test('h1 has correct computed color from stylesheet', async ({page}) => {
  await page.goto('https://example.com/')
  const h1 = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script > h1'
  )
  test.expect(h1).not.toBeNull()
  const color = await h1!.evaluate((node) =>
    window.getComputedStyle(node as HTMLElement).getPropertyValue('color')
  )
  test.expect(color).toEqual('rgb(201, 201, 201)')
})

// Key test: badge text comes from level-2 import
// (constants.js → create-badge.js → scripts.js). Proves the bundler
// traces the full import tree even for MAIN world scripts.
test('badge from deep import chain renders', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  const host = page.locator('#extension-root, [data-extension-root="true"]')
  await test.expect(host.first()).toBeAttached({timeout: 15000})

  const badgeText = await host.first().evaluate((el: HTMLElement) => {
    const badge = el.shadowRoot?.querySelector('[data-badge]')
    return badge?.textContent || ''
  })
  test
    .expect(
      badgeText,
      'badge from constants.js → create-badge.js should render'
    )
    .toContain('extension.js')
  test.expect(badgeText).toContain('v1')
})

// Verify the script runs in MAIN world by checking the window property
// set by scripts.js. ISOLATED world scripts cannot set window properties
// visible to page scripts.
test('script sets window property proving MAIN world execution', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  // Wait for the content script to inject
  const host = page.locator('#extension-root, [data-extension-root="true"]')
  await test.expect(host.first()).toBeAttached({timeout: 15000})

  const isMainWorld = await page.evaluate(
    () => (window as any).__EXTJS_MAIN_WORLD_ACTIVE === true
  )
  test
    .expect(
      isMainWorld,
      'window.__EXTJS_MAIN_WORLD_ACTIVE should be true in MAIN world'
    )
    .toBe(true)
})

// Build-level: verify the built manifest has world: "MAIN" on the entry
// and the build tool injects a bridge script in ISOLATED world.
baseTest('built manifest has world MAIN and bridge script', async () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(pathToExtension, 'manifest.json'), 'utf8')
  )
  const mainEntry = manifest.content_scripts.find(
    (e: any) => e.world === 'MAIN'
  )
  baseTest.expect(mainEntry, 'should have a MAIN world entry').toBeTruthy()
  baseTest.expect(mainEntry.js.length).toBe(1)

  // Build tool should also inject a bridge/loader script in ISOLATED world
  const isolatedEntries = manifest.content_scripts.filter(
    (e: any) => !e.world || e.world === 'ISOLATED'
  )
  baseTest
    .expect(
      isolatedEntries.length,
      'should have at least one ISOLATED world script (bridge)'
    )
    .toBeGreaterThanOrEqual(1)
})

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

// The button is drawn by the MAIN world script, which has no chrome.runtime.
// Its click travels to the ISOLATED world companion over window.postMessage.
test('main world UI carries an always-visible Open options button', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const host = page.locator('#extension-root, [data-extension-root="true"]')
  await test.expect(host.first()).toBeAttached({timeout: 15000})
  await test.expect
    .poll(
      async () => {
        return host.first().evaluate((el: HTMLElement) => {
          const button = el.shadowRoot?.querySelector(
            'button[aria-label="Open options"]'
          )
          return button ? button.textContent : null
        })
      },
      {timeout: 15000, message: 'Open options button never rendered'}
    )
    .toBeTruthy()
})

// The companion answers with the stored setting, and the MAIN world UI stays
// visible by default, so a visible host proves the bridge round-trip ran.
test('isolated world companion keeps the UI visible by default', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const host = page.locator('#extension-root, [data-extension-root="true"]')
  await test.expect(host.first()).toBeAttached({timeout: 15000})
  await test.expect
    .poll(
      async () => {
        return host
          .first()
          .evaluate((el: HTMLElement) => window.getComputedStyle(el).display)
      },
      {timeout: 15000, message: 'host display never resolved'}
    )
    .not.toBe('none')
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
  const host = page
    .locator('#extension-root, [data-extension-root="true"]')
    .first()
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
