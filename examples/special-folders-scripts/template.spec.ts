import path from 'path'
import {execSync} from 'child_process'
import {
  extensionFixtures,
  getDirname,
  getExtensionId
} from '../extension-fixtures'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/special-folders-scripts'
const pathToExtension = path.join(__dirname, `dist/chrome`)
const test = extensionFixtures(pathToExtension, true)

test.beforeAll(async () => {
  execSync(`pnpm extension build ${exampleDir}`, {
    cwd: path.join(__dirname, '..')
  })
})

test('pages/index.html is accessible', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(`chrome-extension://${extensionId}/pages/index.html`)
  await test
    .expect(page)
    .toHaveURL(`chrome-extension://${extensionId}/pages/index.html`)
})
