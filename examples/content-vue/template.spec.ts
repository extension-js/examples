import path from 'path'
import {
  extensionFixtures,
  waitForShadowElement,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('should exist an element with the class name extension-root', async ({
  page
}) => {
  await page.goto('https://example.com/')
  const shadowRootHandle = await page
    .locator('#extension-root, [data-extension-root="true"]')
    .evaluateHandle((host: HTMLElement) => host.shadowRoot)

  // Validate that the Shadow DOM exists
  test.expect(shadowRootHandle).not.toBeNull()

  // Verify Shadow DOM has children
  const shadowChildrenCount = await shadowRootHandle.evaluate(
    (shadowRoot: ShadowRoot) => shadowRoot.children.length
  )
  test.expect(shadowChildrenCount).toBeGreaterThan(0)
})

test('should exist an h2 element with specified content', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  // Wait for content script to inject - waitForShadowElement handles waiting internally
  const h2 = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'h2',
    60000
  )
  if (!h2) {
    throw new Error('h2 element not found in Shadow DOM')
  }
  const textContent = await h2.evaluate((node) => node.textContent)
  await test
    .expect(textContent)
    .toContain(
      'This is a content script running Vue, TypeScript, and Tailwind.css'
    )
})

test('should exist a default color value', async ({page}) => {
  await page.goto('https://example.com/')
  const h2 = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'h2'
  )
  if (!h2) {
    throw new Error('h2 element not found in Shadow DOM')
  }
  const color = await h2.evaluate((node) =>
    window.getComputedStyle(node as HTMLElement).getPropertyValue('color')
  )
  test.expect(color).toEqual('rgb(255, 255, 255)')
})

test('should load all images successfully', async ({page}) => {
  await page.goto('https://example.com/')
  const shadowRootHandle = await page
    .locator('#extension-root, [data-extension-root="true"]')
    .evaluateHandle((host: HTMLElement) => host.shadowRoot)

  const imagesHandle = await shadowRootHandle.evaluateHandle(
    (shadow: ShadowRoot) => Array.from(shadow.querySelectorAll('img'))
  )

  const imageHandles = await imagesHandle.getProperties()
  const results: boolean[] = []

  for (const [, imageHandle] of imageHandles) {
    const naturalWidth = await imageHandle.evaluate(
      (img) => (img as HTMLImageElement).naturalWidth
    )
    const naturalHeight = await imageHandle.evaluate(
      (img) => (img as HTMLImageElement).naturalHeight
    )
    const loadedSuccessfully = naturalWidth > 0 && naturalHeight > 0
    results.push(loadedSuccessfully)
  }

  test.expect(results.every((result) => result)).toBeTruthy()
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
  test.expect(textContent).toContain('Vue Content Options')
})

test('options page shows the setting checkbox', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const checkbox = page.locator('#badge-left')
  await test.expect(checkbox).toBeVisible({timeout: 60000})
  await test.expect(checkbox).toHaveAttribute('type', 'checkbox')
  const statusLine = page.locator('#status')
  await test.expect(statusLine).toContainText('chrome.storage.sync', {
    timeout: 60000
  })
})

// The options page advertises that the setting moves the injected UI to the
// other edge of the page, so this asserts the rendered geometry and not the
// stored value or the class on the element. An earlier feature here hid the
// host with a plain `style.display` assignment, which the CSSOM drops over the
// host's own `all: initial !important`: the checkbox round-tripped through
// storage, nothing on screen changed, and every other assertion still passed.
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
  // The UI lives in a shadow root, so reach through the host for the panel
  // the page itself never has.
  const injectedUi = host.locator('css=.content_script')
  await test.expect(injectedUi).toBeVisible({timeout: 30000})

  const viewport = page.viewportSize() || {width: 1280, height: 720}
  const middle = viewport.width / 2
  const centerX = async () => {
    const box = await injectedUi.boundingBox()
    return box ? box.x + box.width / 2 : -1
  }

  const before = await centerX()
  test
    .expect(before, 'the badge did not start on the right half')
    .toBeGreaterThan(middle)

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
  const checkbox = optionsPage.locator('#badge-left')
  await test.expect(checkbox).not.toBeChecked({timeout: 60000})
  await checkbox.check()
  await test.expect(status).toContainText('Saved', {timeout: 60000})
  await page.bringToFront()

  await test.expect
    .poll(centerX, {
      timeout: 20000,
      message: 'the badge never reached the left half of the viewport'
    })
    .toBeLessThan(middle)
  const after = await centerX()
  test.expect(after, 'the badge never travelled left').toBeLessThan(before)

  await optionsPage.bringToFront()
  await checkbox.uncheck()
  await test.expect(status).toContainText('Saved', {timeout: 60000})
  await page.bringToFront()
  await test.expect
    .poll(centerX, {
      timeout: 20000,
      message: 'the badge never came back to the right half'
    })
    .toBeGreaterThan(middle)
  await optionsPage.close()
})
