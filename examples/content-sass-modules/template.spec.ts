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

test('CSS module class names produce matching computed styles', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  const host = page.locator('#extension-root, [data-extension-root="true"]')
  await test.expect(host.first()).toBeAttached({timeout: 15000})

  // Poll until styles are applied, CSS modules inject asynchronously
  await test.expect
    .poll(
      async () => {
        return host.first().evaluate((el: HTMLElement) => {
          const sr = el.shadowRoot
          if (!sr) return null
          const div = sr.querySelector('div')
          if (!div) return null
          const cs = window.getComputedStyle(div)
          return cs.position !== 'static' ? true : null
        })
      },
      {
        timeout: 15000,
        message: 'CSS module styles never applied to shadow DOM container'
      }
    )
    .toBeTruthy()

  // content-sass-modules uses dark theme: bg #0a0c10, color #c9c9c9
  const result = await host.first().evaluate((el: HTMLElement) => {
    const sr = el.shadowRoot!
    const div = sr.querySelector('div')!
    const cs = window.getComputedStyle(div)
    return {
      position: cs.position,
      backgroundColor: cs.backgroundColor,
      color: cs.color
    }
  })
  test
    .expect(result.position, 'container should be position:fixed')
    .toBe('fixed')
  test
    .expect(
      result.backgroundColor,
      'container should have dark background (#0a0c10)'
    )
    .toBe('rgb(10, 12, 16)')
  test
    .expect(result.color, 'text should be light (#c9c9c9)')
    .toBe('rgb(201, 201, 201)')
})

test('h1 title has correct font-weight from CSS module', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  const host = page.locator('#extension-root, [data-extension-root="true"]')
  await test.expect(host.first()).toBeAttached({timeout: 15000})

  await test.expect
    .poll(
      async () => {
        return host.first().evaluate((el: HTMLElement) => {
          const h1 = el.shadowRoot?.querySelector('h1')
          if (!h1) return null
          return window.getComputedStyle(h1).fontWeight
        })
      },
      {timeout: 10000, message: 'h1 font-weight never resolved'}
    )
    .toBeTruthy()

  const fw = await host.first().evaluate((el: HTMLElement) => {
    return window.getComputedStyle(el.shadowRoot!.querySelector('h1')!)
      .fontWeight
  })
  test.expect(fw, 'title should be bold (700)').toBe('700')
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
