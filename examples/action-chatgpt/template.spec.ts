import path from 'path'
import {execSync} from 'child_process'
import {extensionFixtures, getExtensionId} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const pathToExtension = path.join(__dirname, `dist/chrome`)
const test = extensionFixtures(pathToExtension, true)

test.beforeAll(async () => {
  execSync(`node ../../ci-scripts/build-with-manifest.mjs build`, {
    cwd: __dirname,
    stdio: 'inherit'
  })
})

test('action popup page renders', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(`chrome-extension://${extensionId}/action/index.html`)
  const root = await page.locator('body').first()
  await test.expect(root).toBeVisible()
})
