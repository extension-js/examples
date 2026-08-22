import type {Page} from '@playwright/test'
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

async function waitForWelcomeHeading(page: Page) {
  await test.expect
    .poll(
      async () => {
        try {
          return await page.locator('h1').first().textContent()
        } catch {
          return null
        }
      },
      {
        timeout: 60000
      }
    )
    .toMatch(/Welcome to your/i)
}

test('should exist an element with the welcome message text', async ({
  page,
  extensionId
}) => {
  // Use extension URL pattern for reliable navigation
  await page.goto(
    `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  )
  await waitForWelcomeHeading(page)
})

test('should exist a default color value', async ({page, extensionId}) => {
  await page.goto(
    `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  )
  await waitForWelcomeHeading(page)
  const h1 = page.locator('h1')
  const color = await page.evaluate(
    (locator) => {
      return window.getComputedStyle(locator!).getPropertyValue('color')
    },
    await h1.elementHandle()
  )
  test.expect(color).toEqual('rgb(201, 201, 201)')
})
