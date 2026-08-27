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

test('injected UI offers the Open options button by default', async ({
  page
}) => {
  await page.goto('https://example.com/')
  // No click first: the button has to be on screen the moment the content
  // script injects, because that is the state the docs recorder films.
  await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'button'
  )
  const buttons = await page
    .locator('#extension-root, [data-extension-root="true"]')
    .evaluate((host: HTMLElement) =>
      Array.from(host.shadowRoot?.querySelectorAll('button') ?? []).map(
        (button) => ({
          text: button.textContent?.trim(),
          accessibleName: button.getAttribute('aria-label')
        })
      )
    )
  test
    .expect(buttons.some((button) => button.text === 'Open options'))
    .toBe(true)
  test
    .expect(buttons.some((button) => button.accessibleName === 'Open options'))
    .toBe(true)
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
