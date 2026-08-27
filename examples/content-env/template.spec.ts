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
