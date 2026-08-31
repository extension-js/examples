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

test('options page renders and saves a setting', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })

  const h1 = page.locator('h1').first()
  await test.expect(h1).toBeVisible({timeout: 60000})
  const heading = await h1.textContent()
  test.expect(heading).toContain('Options Page')

  // Loaded from the extension origin, chrome.storage is present, so the page
  // reports its saved settings rather than the missing-namespace fallback.
  const status = page.locator('#status')
  await test.expect(status).toContainText('Saved settings loaded', {
    timeout: 60000
  })

  const toggle = page.locator('#greet')
  await test.expect(toggle).not.toBeChecked()
  await toggle.check()
  await test.expect(status).toContainText('greeted by name', {timeout: 60000})

  // The setting is read back from chrome.storage.sync, not from the checkbox,
  // so a page that only flipped the box in the DOM fails here.
  const stored = await page.evaluate(
    () =>
      new Promise((resolve) =>
        chrome.storage.sync.get({greet: false}, (saved) => resolve(saved.greet))
      )
  )
  test.expect(stored).toBe(true)
})
