import {test, expect} from '@playwright/test'
import {readFileSync, existsSync} from 'fs'
import {join} from 'path'
import {getDirname} from '../dirname.js'
import {
  extensionFixtures,
  resolveBuiltExtensionPath,
  getShadowRootElement
} from '../extension-fixtures.js'

const __dirname = getDirname(import.meta.url)
const exampleDir = __dirname
const srcDir = join(exampleDir, 'src')
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const runtimeTest = extensionFixtures(pathToExtension)

test.describe('Content Custom Font Template', () => {
  test('should have all required files', async () => {
    const requiredFiles = [
      'package.json',
      'src/manifest.json',
      'src/background.js',
      'src/content/scripts.js',
      'src/content/styles.css',
      'src/options/index.html',
      'src/options/scripts.js',
      'src/options/styles.css',
      'postcss.config.js',
      'README.md'
    ]

    for (const file of requiredFiles) {
      const filePath = join(exampleDir, file)
      expect(existsSync(filePath), `${file} should exist`).toBe(true)
    }

    // Fonts readme may be committed as Markdown in public/ or as a text file in fonts/
    const readmeCandidates = ['public/fonts/README.md', 'fonts/README.txt']
    const hasAnyReadme = readmeCandidates.some((p) =>
      existsSync(join(exampleDir, p))
    )
    // Fonts directory is optional - fonts may be added by users
    // expect(hasAnyReadme, 'Either public/fonts/README.md or fonts/README.txt should exist').toBe(true)

    const logoCandidates = ['src/images/icon.png']
    const hasAnyLogo = logoCandidates.some((p) =>
      existsSync(join(exampleDir, p))
    )
    expect(hasAnyLogo, 'A logo file should exist at src/images/icon.png').toBe(
      true
    )
  })

  test('should have correct package.json', async () => {
    const packageJson = JSON.parse(
      readFileSync(join(exampleDir, 'package.json'), 'utf8')
    )

    expect(packageJson.name).toContain('content-custom-font')
    expect(packageJson.description).toContain('custom font')
    expect(packageJson.description).toContain('font')
    expect(packageJson.devDependencies).toHaveProperty('tailwindcss')
  })

  test('should have correct manifest.json', async () => {
    const manifest = JSON.parse(
      readFileSync(join(srcDir, 'manifest.json'), 'utf8')
    )

    expect(manifest.name).toContain('Custom Fonts')
    expect(manifest.description).toContain('custom font')
    expect(manifest.web_accessible_resources).toBeDefined()

    const fontResources = manifest.web_accessible_resources[0].resources
    expect(fontResources).toContain('fonts/*.woff2')
    expect(fontResources).toContain('fonts/*.woff')
    expect(fontResources).toContain('fonts/*.ttf')
    expect(fontResources).toContain('fonts/*.otf')
  })

  test('should have correct font-face declarations in CSS', async () => {
    const css = readFileSync(join(srcDir, 'content/styles.css'), 'utf8')

    expect(css).toContain('@font-face')
    expect(css).toContain('font-family: "Momo Signature"')
    expect(css).toContain('font-display: swap')
  })

  test('should reuse the custom font on the options page', async () => {
    const css = readFileSync(join(srcDir, 'options/styles.css'), 'utf8')

    expect(css).toContain('@font-face')
    expect(css).toContain('font-family: "Momo Signature"')
  })

  test('should have content script with font demo', async () => {
    const script = readFileSync(join(srcDir, 'content/scripts.js'), 'utf8')

    expect(script).toContain('font_momo_signature')
    // The font name "Momo Signature" is defined in CSS, not JS
  })

  test('should have README content', async () => {
    const readme = readFileSync(join(exampleDir, 'README.md'), 'utf8')

    expect(readme).toContain('Custom Font')
    expect(readme.length).toBeGreaterThan(100)
  })
})

runtimeTest('custom font is applied in shadow DOM', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const fontDemo = await getShadowRootElement(
    page,
    '[data-extension-root="true"]',
    '.font_momo_signature',
    30000
  )
  runtimeTest.expect(fontDemo).not.toBeNull()
  // Verify the computed font-family includes the custom font name
  const fontFamily = await fontDemo!.evaluate((el) =>
    window.getComputedStyle(el).getPropertyValue('font-family')
  )
  runtimeTest.expect(fontFamily.toLowerCase()).toContain('momo signature')
})

runtimeTest('content script shows the options button', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const button = await getShadowRootElement(
    page,
    '[data-extension-root="true"]',
    'button[aria-label="Open options"]',
    30000
  )
  runtimeTest.expect(button).not.toBeNull()
  const text = await button!.evaluate((el) => el.textContent)
  runtimeTest.expect(text).toBe('Open options')
})

runtimeTest('options page renders', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const h1 = page.locator('h1').first()
  await runtimeTest.expect(h1).toBeVisible({timeout: 60000})
  const textContent = await h1.textContent()
  runtimeTest.expect(textContent).toContain('Options')
  // The page is set in the same face the injected badge uses
  const fontFamily = await h1.evaluate((el) =>
    window.getComputedStyle(el).getPropertyValue('font-family')
  )
  runtimeTest.expect(fontFamily.toLowerCase()).toContain('momo signature')
})

runtimeTest(
  'options page shows the setting checkbox',
  async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })
    const checkbox = page.locator('#show-badge')
    await runtimeTest.expect(checkbox).toBeVisible({timeout: 60000})
    await runtimeTest.expect(checkbox).toBeChecked({timeout: 60000})
    const statusLine = page.locator('#status')
    await runtimeTest.expect(statusLine).toContainText('chrome.storage.sync', {
      timeout: 60000
    })
  }
)

// The options page advertises that unticking the setting takes the injected UI
// off the page, so this asserts the rendered result and not the stored value.
// An earlier version hid the host with a plain `style.display` assignment,
// which the CSSOM drops over the host's own `all: initial !important`: the
// checkbox round-tripped through storage and the badge stayed on screen, and
// every other assertion in this file still passed.
runtimeTest(
  'unticking the setting actually hides the injected UI',
  async ({page, context, extensionId}) => {
    await page.goto('https://example.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })
    const host = page
      .locator('#extension-root, [data-extension-root="true"]')
      .first()
    await runtimeTest.expect(host).toBeAttached({timeout: 30000})
    // The UI lives in a shadow root, so reach through the host for the button
    // the page itself never has.
    const injectedUi = host.locator('css=[aria-label="Open options"]')
    await runtimeTest.expect(injectedUi).toBeVisible({timeout: 30000})

    const optionsPage = await context.newPage()
    await optionsPage.goto(
      `chrome-extension://${extensionId}/options/index.html`,
      {waitUntil: 'domcontentloaded', timeout: 60000}
    )
    const status = optionsPage.locator('#status')
    // The checkbox starts unchecked in markup and is filled in from storage, so
    // wait for that read before toggling or the load can undo the click.
    await runtimeTest.expect(status).toContainText('chrome.storage.sync', {
      timeout: 60000
    })
    const checkbox = optionsPage.locator('#show-badge')
    await runtimeTest.expect(checkbox).toBeChecked({timeout: 60000})
    await checkbox.uncheck()
    await runtimeTest.expect(status).toContainText('Saved', {timeout: 60000})
    await page.bringToFront()

    await runtimeTest.expect
      .poll(
        async () =>
          host.evaluate(
            (el: HTMLElement) => window.getComputedStyle(el).display
          ),
        {timeout: 20000, message: 'the host never reached display none'}
      )
      .toBe('none')
    await runtimeTest.expect(injectedUi).toBeHidden({timeout: 20000})

    await optionsPage.bringToFront()
    await checkbox.check()
    await page.bringToFront()
    await runtimeTest.expect(injectedUi).toBeVisible({timeout: 20000})
    await runtimeTest.expect
      .poll(
        async () =>
          host.evaluate(
            (el: HTMLElement) => window.getComputedStyle(el).display
          ),
        {timeout: 20000, message: 'the host never came back'}
      )
      .not.toBe('none')
    await optionsPage.close()
  }
)
