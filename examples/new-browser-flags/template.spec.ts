import path from 'path'
import {execSync} from 'child_process'
import {extensionFixtures, getExtensionId} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/new-browser-flags'
const pathToExtension = path.join(__dirname, `dist/chrome`)
const test = extensionFixtures(pathToExtension, true)

test.beforeAll(async () => {
  execSync(`node ../../ci-scripts/build-with-manifest.mjs build`, {
    cwd: __dirname,
    stdio: 'inherit'
  })
})

test('new tab page renders with title', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(`chrome-extension://${extensionId}/newtab/index.html`)
  const title = await page.locator('.title').first()
  await test.expect(title).toHaveText('Branded New Tab')
})
