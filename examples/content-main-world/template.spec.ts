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

test('content script injects the options button', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const button = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script > button.content_button',
    60000
  )
  if (!button) {
    throw new Error('options button not found in Shadow DOM')
  }
  const label = await button.evaluate((node) => node.getAttribute('aria-label'))
  test.expect(label).toEqual('Open options')
})

test('options page shows the setting checkbox', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const checkbox = page.locator('#badge-left')
  await test.expect(checkbox).toBeVisible({timeout: 60000})
  await test.expect(checkbox).not.toBeChecked({timeout: 60000})
  const statusLine = page.locator('#status')
  await test.expect(statusLine).toContainText('chrome.storage.sync', {
    timeout: 60000
  })
})

// The injected UI runs in the MAIN world, where chrome.storage does not
// exist, so the setting only reaches it through the ISOLATED world companion
// and window.postMessage. Geometry is the honest witness for both the move
// and that bridge: a class name or a style string can change while the UI
// stays exactly where it was, which is how a badge that never budged once
// shipped past a fully green suite.
test('the setting moves the badge from right to left', async ({
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

  const middle = (page.viewportSize()?.width ?? 1280) / 2
  const badgeCenterX = async () => {
    const box = await injectedUi.boundingBox()
    if (!box) throw new Error('the injected UI paints no box')
    return box.x + box.width / 2
  }
  test.expect(await badgeCenterX()).toBeGreaterThan(middle)

  const optionsPage = await context.newPage()
  await optionsPage.goto(
    `chrome-extension://${extensionId}/options/index.html`,
    {waitUntil: 'domcontentloaded', timeout: 60000}
  )
  const status = optionsPage.locator('#status')
  // The checkbox is filled in from storage after the page loads, so wait for
  // that read before toggling or the load can undo the click.
  await test.expect(status).toContainText('chrome.storage.sync', {
    timeout: 60000
  })
  const checkbox = optionsPage.locator('#badge-left')
  await test.expect(checkbox).not.toBeChecked({timeout: 60000})
  await checkbox.check()
  await test.expect(status).toContainText('Saved', {timeout: 60000})
  await page.bringToFront()

  await test.expect
    .poll(badgeCenterX, {
      timeout: 20000,
      message: 'the badge never reached the left half of the viewport'
    })
    .toBeLessThan(middle)
  await test.expect(injectedUi).toBeVisible({timeout: 20000})

  await optionsPage.bringToFront()
  await checkbox.uncheck()
  await test.expect(status).toContainText('Saved', {timeout: 60000})
  await page.bringToFront()
  await test.expect
    .poll(badgeCenterX, {
      timeout: 20000,
      message: 'the badge never came back to the right half of the viewport'
    })
    .toBeGreaterThan(middle)
  await optionsPage.close()
})
