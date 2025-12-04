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

test('localized action popup page renders', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/action/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  // Wait for JavaScript to populate the localized content - use condition-based wait
  const header = page.locator('h1').first()
  await test.expect(header).toBeVisible({timeout: 60000})
  // The title is localized, so check for any text content
  const textContent = await header.textContent()
  test.expect(textContent?.trim().length).toBeGreaterThan(0)
})
