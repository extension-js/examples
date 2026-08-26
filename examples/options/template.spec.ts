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
  execSync(`node ../../scripts/build-with-manifest.mjs build`, {
    cwd: __dirname,
    stdio: 'inherit'
  })
})

test('options page renders', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  // Wait for page to load - use condition-based wait instead of fixed timeout
  const h1 = page.locator('h1').first()
  await test.expect(h1).toBeVisible({timeout: 60000})
  const textContent = await h1.textContent()
  test.expect(textContent).toContain('Options Extension')
})

test('options page shows the setting control', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const checkbox = page.locator('#show-badge')
  await test.expect(checkbox).toBeVisible({timeout: 60000})
  const statusLine = page.locator('#status')
  await test.expect(statusLine).toContainText('chrome.storage.sync', {
    timeout: 60000
  })
})

test('content script injects the badge and its options button', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const host = page.locator('[data-extension-root]')
  await test.expect(host).toHaveCount(1, {timeout: 60000})
  // The badge lives in a shadow root, so reach through the host rather than
  // querying the page for a selector the page itself never has.
  const button = host.locator('css=.content_button')
  await test.expect(button).toHaveText('Open options', {timeout: 60000})
})
