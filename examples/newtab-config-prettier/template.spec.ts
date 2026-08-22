import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('should exist an element with the welcome message text', async ({
  page,
  extensionId
}) => {
  await page.goto(
    `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  )
  // Wait for page to fully load - use condition-based wait instead of fixed timeout
  const h1 = await page.waitForSelector('h1', {
    state: 'visible',
    timeout: 60000
  })
  const textContent = await h1.textContent()
  test.expect(textContent).toMatch(/Welcome to your/i)
})

test('should exist a default color value', async ({page, extensionId}) => {
  await page.goto(
    `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  )
  await page.waitForSelector('h1', {state: 'visible', timeout: 60000})
  const h1 = page.locator('h1')
  const color = await page.evaluate(
    (locator) => {
      return window.getComputedStyle(locator!).getPropertyValue('color')
    },
    await h1.elementHandle()
  )
  test.expect(color).toEqual('rgb(201, 201, 201)')
})
