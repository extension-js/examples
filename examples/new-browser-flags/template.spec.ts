import path from 'path'
import {execSync} from 'child_process'
import {
  extensionFixtures,
  getDirname,
  getExtensionId
} from '../extension-fixtures'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/new-browser-flags'
const pathToExtension = path.join(__dirname, `dist/chrome`)
const test = extensionFixtures(pathToExtension, true)

test.beforeAll(async () => {
  execSync(`pnpm extension build ${exampleDir}`, {
    cwd: path.join(__dirname, '..')
  })
})

test('new tab page renders with title', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(`chrome-extension://${extensionId}/newtab/index.html`)
  const title = await page.locator('.title').first()
  await test.expect(title).toHaveText('Branded New Tab')
})
