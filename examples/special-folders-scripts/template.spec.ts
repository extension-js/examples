import path from 'path'
import {
  extensionFixtures,
  getExtensionId,
  resolveBuiltExtensionPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/special-folders-scripts'
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('pages/index.html is accessible', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(`chrome-extension://${extensionId}/pages/index.html`)
  await test
    .expect(page)
    .toHaveURL(`chrome-extension://${extensionId}/pages/index.html`)
})
