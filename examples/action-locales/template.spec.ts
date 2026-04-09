import {execSync} from 'child_process'
import fs from 'fs'
import path from 'path'
import {test as baseTest} from '@playwright/test'
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(pathToExtension, 'manifest.json'))) {
    execSync(`node ../../scripts/build-with-manifest.mjs build`, {
      cwd: __dirname,
      stdio: 'inherit'
    })
  }
})

test('localized action popup page renders with i18n string', async ({
  page,
  extensionId
}) => {
  await page.goto(`chrome-extension://${extensionId}/action/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  // Wait for JavaScript to populate the localized content - use condition-based wait
  const header = page.locator('h1').first()
  await test.expect(header).toBeVisible({timeout: 60000})
  // Verify the actual localized string from _locales/en/messages.json is rendered
  const textContent = await header.textContent()
  test.expect(textContent?.trim()).toContain('Welcome to your Locale Extension')
})

// Build-level i18n verification: _locales must survive the build pipeline
// and __MSG_*__ manifest patterns must reference valid locale keys.
baseTest.describe('i18n build artifacts', () => {
  baseTest('_locales/en/messages.json exists in build output', () => {
    const messagesPath = path.join(
      pathToExtension,
      '_locales',
      'en',
      'messages.json'
    )
    baseTest
      .expect(
        fs.existsSync(messagesPath),
        '_locales/en/messages.json must be present in build output'
      )
      .toBe(true)
    const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'))
    baseTest.expect(Object.keys(messages).length).toBeGreaterThan(0)
  })

  baseTest(
    '__MSG_*__ manifest patterns reference valid locale keys',
    () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(pathToExtension, 'manifest.json'), 'utf8')
      )
      const messages = JSON.parse(
        fs.readFileSync(
          path.join(pathToExtension, '_locales', 'en', 'messages.json'),
          'utf8'
        )
      )
      const manifestStr = JSON.stringify(manifest)
      const msgRefs = manifestStr.match(/__MSG_(\w+)__/g) || []
      for (const ref of msgRefs) {
        const key = ref.replace(/__MSG_(\w+)__/, '$1')
        baseTest
          .expect(
            messages[key],
            `manifest references __MSG_${key}__ but _locales/en/messages.json has no "${key}" key`
          )
          .toBeDefined()
      }
    }
  )
})
