import path from 'path'
import {
  extensionFixtures,
  getExtensionId,
  resolveBuiltExtensionPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/new-browser-flags'
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('new tab page renders with title', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(`chrome-extension://${extensionId}/newtab/index.html`)
  const title = await page.locator('.title').first()
  await test.expect(title).toHaveText('Branded New Tab')
})
