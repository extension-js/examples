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

test('should exist an element with the class name content_script', async ({
  page
}) => {
  await page.goto('https://example.com/')
  const div = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script'
  )
  if (!div) {
    throw new Error('div with class content_script not found in Shadow DOM')
  }
  test.expect(div).not.toBeNull()
})

test('should exist an h1 element with specified content', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  // Wait for content script to inject - waitForShadowElement handles waiting internally
  const h1 = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script > h1',
    60000
  )
  if (!h1) {
    throw new Error('h1 element not found in Shadow DOM')
  }
  const textContent = await h1.evaluate((node) => node.textContent)
  test.expect(textContent).toContain('Content Template')
})

test('should exist a default color value', async ({page}) => {
  await page.goto('https://example.com/')
  const h1 = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script > h1'
  )
  if (!h1) {
    throw new Error('h1 element not found in Shadow DOM')
  }
  const color = await h1.evaluate((node) =>
    window.getComputedStyle(node as HTMLElement).getPropertyValue('color')
  )
  test.expect(color).toEqual('rgb(201, 201, 201)')
})

// Verify import.meta.env.EXTENSION_PUBLIC_DESCRIPTION_TEXT is compiled into
// the background script. The build replaces import.meta.env.* at compile time.
// .env.chrome sets it to "Chrome Extension example".
baseTest('env variable is compiled into built background script', async () => {
  // MV3 emits `background/service_worker.js`; MV2 (Firefox) emits
  // `background/scripts.js`. Try both so the fixture stays portable
  // regardless of which dist is mounted at `pathToExtension`.
  const bgCandidates = [
    path.join(pathToExtension, 'background', 'service_worker.js'),
    path.join(pathToExtension, 'background', 'scripts.js')
  ]
  const bgPath = bgCandidates.find((p) => fs.existsSync(p)) || bgCandidates[0]
  const bgCode = fs.readFileSync(bgPath, 'utf8')
  const envValues = [
    'Chrome Extension example',
    'Chromium Extension example',
    'Chromium-based example',
    'Edge Extension example',
    'Firefox Add-on example'
  ]
  const isInjected = envValues.some((v) => bgCode.includes(v))
  baseTest
    .expect(
      isInjected,
      'background script should contain the injected env value'
    )
    .toBe(true)
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

test('options page shows the compiled env value', async ({
  page,
  extensionId
}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const buildLine = page.locator('#build')
  await test.expect(buildLine).toContainText('example', {timeout: 60000})
})
