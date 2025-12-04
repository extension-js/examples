import path from 'path'
import {
  extensionFixtures,
  getSidebarPath,
  resolveBuiltExtensionPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('sidebar page renders', async ({page, extensionId}) => {
  await page.goto(getSidebarPath(extensionId))
  const root = await page.locator('body').first()
  await test.expect(root).toBeVisible()
})
