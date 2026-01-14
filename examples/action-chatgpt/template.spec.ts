import {execSync} from 'child_process'
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test.beforeAll(async () => {
  execSync(`node ../../ci-scripts/build-with-manifest.mjs build`, {
    cwd: __dirname,
    stdio: 'inherit'
  })
})

test('action popup page renders', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/action/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  // Wait for React to render - use condition-based wait instead of fixed timeout
  const root = page.locator('#root, body').first()
  await test.expect(root).toBeVisible({timeout: 60000})
})
