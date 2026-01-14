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
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  // Wait for shadow host to exist (multi-entry uses specific data attributes)
  // waitForSelector handles waiting internally
  await page.waitForSelector('[data-extension-root]', {
    state: 'attached',
    timeout: 60000
  })
  const shadowRootHandle = await page
    .locator('[data-extension-root]')
    .first()
    .evaluateHandle((host: HTMLElement) => host.shadowRoot)
  test.expect(shadowRootHandle).not.toBeNull()
})
