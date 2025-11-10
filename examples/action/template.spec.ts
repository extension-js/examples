import path from 'path'
import {execSync} from 'child_process'
import {
  extensionFixtures,
  getDirname,
  getExtensionId
} from '../extension-fixtures'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/action'
const pathToExtension = path.join(__dirname, `dist/chrome`)
const test = extensionFixtures(pathToExtension, true)

test.beforeAll(async () => {
  execSync(`pnpm extension build ${exampleDir}`, {
    cwd: path.join(__dirname, '..')
  })
})

test('action popup page renders', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(`chrome-extension://${extensionId}/action/index.html`)
  const h1 = await page.locator('h1').first()
  await test.expect(h1).toContainText('Action Extension')
})
