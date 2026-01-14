import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('new tab page renders with title', async ({page, extensionId}) => {
  // Use extension URL pattern for reliable navigation
  await page.goto(
    `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  )
  // Wait for page to fully load - use condition-based wait instead of fixed timeout
  const title = page.locator('.title').first()
  await test.expect(title).toBeVisible({timeout: 60000})
  await test.expect(title).toHaveText('Branded New Tab')
})
