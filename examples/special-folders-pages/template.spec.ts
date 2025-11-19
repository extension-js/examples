import path from 'path'
import {
  extensionFixtures,
  getExtensionId,
  resolveBuiltExtensionPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/special-folders-pages'
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('pages/welcome.html is accessible', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(`chrome-extension://${extensionId}/pages/welcome.html`)
  const h1 = await page.locator('h1').first()
  await test.expect(h1).toContainText('Welcome')
})
