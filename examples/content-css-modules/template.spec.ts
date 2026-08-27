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

  // Poll until styles are applied — CSS modules inject asynchronously
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

  // content-css-modules uses light theme: bg #ffffff, color #0a0c10
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
      'container should have white background (#ffffff)'
    )
    .toBe('rgb(255, 255, 255)')
  test
    .expect(result.color, 'text should be dark (#0a0c10)')
    .toBe('rgb(10, 12, 16)')
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
    timeout: 30000
  })
  const host = page.locator('#extension-root, [data-extension-root="true"]')
  await test.expect(host.first()).toBeAttached({timeout: 15000})

  // The class name is hashed by CSS Modules, so the button is found by its
  // accessible label rather than by a selector the build rewrites.
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
      {timeout: 15000, message: 'options button never appeared in shadow DOM'}
    )
    .toBe('Open options')
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

test('options page class names come from the CSS module', async ({
  page,
  extensionId
}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const status = page.locator('#status')
  await test.expect(status).toBeVisible({timeout: 60000})
  // A hashed name proves the module pipeline ran instead of a plain stylesheet
  const className = await status.evaluate((el: HTMLElement) => el.className)
  test.expect(className).not.toBe('')
  test.expect(className).not.toBe('options_status')
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
