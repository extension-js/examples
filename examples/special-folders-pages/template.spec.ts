import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('pages/welcome.html is accessible', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/pages/welcome.html`)
  const h1 = await page.locator('h1').first()
  await test.expect(h1).toContainText('Welcome')
})
