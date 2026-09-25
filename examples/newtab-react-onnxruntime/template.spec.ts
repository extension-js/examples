import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('should exist an element with the YOLO title text', async ({
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

  const h1 = await page.waitForSelector('h1', {
    state: 'visible',
    timeout: 60000
  })
  const textContent = await h1.textContent()
  test.expect(textContent).toMatch(/YOLO/i)
})
