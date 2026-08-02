import path from 'path'
import {
  extensionFixtures,
  gotoExtensionPage,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('sidebar page renders', async ({page, extensionId}) => {
  await gotoExtensionPage(
    page,
    pathToExtension,
    extensionId,
    'sidebar/index.html'
  )
  const root = await page.locator('body').first()
  await test.expect(root).toBeVisible()
})
