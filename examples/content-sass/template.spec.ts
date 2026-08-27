import path from 'path'
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('mounts content script Shadow DOM', async ({page}) => {
  await page.goto('https://example.com/')
  const shadowRootHandle = await page
    .locator('#extension-root, [data-extension-root="true"]')
    .evaluateHandle((host: HTMLElement) => host.shadowRoot)
  test.expect(shadowRootHandle).not.toBeNull()
})

test('SCSS styles produce correct background-color in shadow DOM', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const host = page.locator('#extension-root, [data-extension-root="true"]')
  await test.expect(host).toBeAttached({timeout: 15000})
  await test.expect
    .poll(
      async () => {
        return host.evaluate((el: HTMLElement) => {
          const div = el.shadowRoot?.querySelector('div')
          if (!div) return null
          return window.getComputedStyle(div).backgroundColor
        })
      },
      {
        timeout: 15000,
        message: 'SCSS should compile to correct background-color'
      }
    )
    .toBe('rgb(10, 12, 16)')
})

test('content script injects the options button', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const host = page
    .locator('#extension-root, [data-extension-root="true"]')
    .first()
  await test.expect(host).toBeAttached({timeout: 30000})
  const button = host.locator('css=[aria-label="Open options"]')
  await test.expect(button).toBeVisible({timeout: 30000})
  await test.expect(button).toHaveText('Open options')
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

// The options page advertises that the setting moves the injected UI from one
// edge to the other, so this asserts the geometry the user sees and not the
// stored value. An earlier hide/show shipped as a plain `style.display` write
// the CSSOM dropped over the host's own `all: initial !important`: the value
// round-tripped through storage, the badge never budged, and every assertion
// in this file still passed.
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
  // Geometry is the only honest witness here: a style string or a class name
  // can change while the badge stays exactly where it was.
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
