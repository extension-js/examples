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
  // Wait for page to load - use condition-based wait instead of fixed timeout
  const h1 = page.locator('h1').first()
  await test.expect(h1).toBeVisible({timeout: 60000})
  const textContent = await h1.textContent()
  test.expect(textContent).toContain('Action Extension')
})
