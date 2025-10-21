import path from 'path'
import {execSync} from 'child_process'
import {extensionFixtures, getExtensionId} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/special-folders-pages'
const pathToExtension = path.join(__dirname, `dist/chrome`)
const test = extensionFixtures(pathToExtension, true)

test.beforeAll(async () => {
  execSync(`node ../../ci-scripts/build-with-manifest.mjs build`, {
    cwd: __dirname,
    stdio: 'inherit'
  })
})

test('pages/welcome.html is accessible', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(`chrome-extension://${extensionId}/pages/welcome.html`)
  const h1 = await page.locator('h1').first()
  await test.expect(h1).toContainText('Welcome')
})
