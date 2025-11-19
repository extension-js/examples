import path from 'path'
import {
  extensionFixtures,
  getExtensionId,
  resolveBuiltExtensionPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('action popup page renders', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(`chrome-extension://${extensionId}/action/index.html`)
  const root = await page.locator('body').first()
  await test.expect(root).toBeVisible()
})
