import path from 'path'
import {execSync} from 'child_process'
import {
  extensionFixtures,
  getExtensionId,
  getSidebarPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/sidebar'
const pathToExtension = path.join(__dirname, `dist/chrome`)
const test = extensionFixtures(pathToExtension, true)

test.beforeAll(async () => {
  execSync(`node ../../ci-scripts/build-with-manifest.mjs build`, {
    cwd: __dirname,
    stdio: 'inherit'
  })
})

test('sidebar page renders', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(getSidebarPath(extensionId))
  const h1 = await page.locator('h1').first()
  await test.expect(h1).toContainText('Sidebar Extension')
})
