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
