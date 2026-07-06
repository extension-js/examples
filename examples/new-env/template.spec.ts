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

test('should exist an element with the welcome message text', async ({
  page,
  extensionId
}) => {
  await page.goto(
    `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  )
  // Wait for page to fully load - use condition-based wait instead of fixed timeout
  const h1 = await page.waitForSelector('h1', {
    state: 'visible',
    timeout: 60000
  })
  const textContent = await h1.textContent()
  test.expect(textContent).toMatch(/Welcome to your/i)
})

test('should exist a default color value', async ({page, extensionId}) => {
  await page.goto(
    `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  )
  await page.waitForSelector('h1', {state: 'visible', timeout: 60000})
  const h1 = page.locator('h1')
  const color = await page.evaluate(
    (locator) => {
      return window.getComputedStyle(locator!).getPropertyValue('color')
    },
    await h1.elementHandle()
  )
  test.expect(color).toEqual('rgb(201, 201, 201)')
})

test('should render description text element', async ({page, extensionId}) => {
  await page.goto(
    `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  )
  // The description-text span has inline fallback text in the HTML.
  // scripts.ts attempts to read import.meta.env.EXTENSION_PUBLIC_DESCRIPTION_TEXT
  // and update it. Verify the element is present and has text content.
  const descriptionEl = page.locator('#description-text')
  await test.expect(descriptionEl).toBeVisible({timeout: 60000})
  const text = await descriptionEl.textContent()
  test.expect(text?.trim().length).toBeGreaterThan(0)
})

// Verify import.meta.env.EXTENSION_PUBLIC_DESCRIPTION_TEXT is compiled into
// the built newtab script. The build replaces import.meta.env.* at compile
// time. .env.chrome sets it to "Chrome Extension".
// Uses a fresh prod build because dev-live tests clean dist/ before running.
baseTest('env variable is compiled into built newtab script', async () => {
  const prodPath = path.join(__dirname, 'dist', 'chrome')
  if (!fs.existsSync(path.join(prodPath, 'manifest.json'))) {
    execSync(
      'node ../../scripts/build-with-manifest.mjs build --browser=chrome',
      {cwd: __dirname, stdio: 'pipe', timeout: 60000}
    )
  }
  const jsPath = path.join(prodPath, 'chrome_url_overrides', 'newtab.js')
  const jsCode = fs.readFileSync(jsPath, 'utf8')
  const envValues = [
    'Chrome Extension',
    'Chromium Extension',
    'Chromium-based Extension',
    'Edge Extension',
    'Firefox Add-on'
  ]
  const isInjected = envValues.some((v) => jsCode.includes(v))
  baseTest
    .expect(isInjected, 'newtab script should contain the injected env value')
    .toBe(true)
})
