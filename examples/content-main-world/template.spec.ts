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
