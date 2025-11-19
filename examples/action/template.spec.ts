import path from 'path'
import {
  extensionFixtures,
  getExtensionId,
  resolveBuiltExtensionPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/action'
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('action popup page renders', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(`chrome-extension://${extensionId}/action/index.html`)
  const h1 = await page.locator('h1').first()
  await test.expect(h1).toContainText('Action Extension')
})
