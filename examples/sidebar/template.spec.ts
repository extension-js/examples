import path from 'path'
import {
  extensionFixtures,
  getExtensionId,
  getSidebarPath,
  resolveBuiltExtensionPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/sidebar'
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('sidebar page renders', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(getSidebarPath(extensionId))
  const h1 = await page.locator('h1').first()
  await test.expect(h1).toContainText('Sidebar Extension')
})
