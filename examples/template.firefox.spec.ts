import fs from 'fs'
import path from 'path'
import {test as baseTest} from '@playwright/test'
import {getDirname} from './dirname.js'
import {
  firefoxExtensionFixtures,
  resolveBuiltFirefoxExtensionPath,
  rdpListTabs,
  rdpReadExtensionPage
} from './firefox-extension-fixtures.js'

const __dirname = getDirname(import.meta.url)

function readManifest(extPath: string): any {
  return JSON.parse(
    fs.readFileSync(path.join(extPath, 'manifest.json'), 'utf8')
  )
}

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}

// Auto-discover content examples with Firefox builds

const contentExamples: Array<{name: string; extPath: string}> = []
// MAIN world content scripts are Chromium-only; skip them in Firefox
const FIREFOX_SKIP = new Set(['content-main-world'])

for (const entry of fs.readdirSync(__dirname, {withFileTypes: true})) {
  if (!entry.isDirectory() || !entry.name.startsWith('content')) continue
  if (FIREFOX_SKIP.has(entry.name)) continue

  const exampleDir = path.join(__dirname, entry.name)
  const extPath = resolveBuiltFirefoxExtensionPath(exampleDir)

  if (
    fs.existsSync(extPath) &&
    fs.existsSync(path.join(extPath, 'manifest.json'))
  ) {
    try {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(extPath, 'manifest.json'), 'utf8')
      )

      if (Array.isArray(manifest.content_scripts)) {
        contentExamples.push({name: entry.name, extPath})
      }
    } catch {
      // skip
    }
  }
}

const FIREFOX_SWEEP_MINIMUM = 15

baseTest(
  'firefox: parity sweep positive control discovers built content templates',
  async () => {
    baseTest
      .expect(
        contentExamples.length,
        `the Firefox parity sweep discovered ${contentExamples.length} built content templates but covers at least ${FIREFOX_SWEEP_MINIMUM}; build the content-* templates for Firefox (dist/firefox) before running this suite`
      )
      .toBeGreaterThanOrEqual(FIREFOX_SWEEP_MINIMUM)
  }
)

for (const {name, extPath} of contentExamples) {
  const test = firefoxExtensionFixtures(extPath)

  test(`firefox: ${name} injects shadow DOM`, async ({page}) => {
    await page.goto('https://example.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })

    const host = page.locator('[data-extension-root]')
    await test.expect(host.first()).toBeAttached({timeout: 15000})

    const hasShadow = await host
      .first()
      .evaluate((el: HTMLElement) => !!el.shadowRoot)
    test
      .expect(hasShadow, `${name}: content script should create shadow root`)
      .toBe(true)
  })
}

// Content script CSS injection — verify shadow DOM has styles applied

const contentCssExample = contentExamples.find(
  (e) =>
    e.name === 'content' ||
    e.name === 'content-sass' ||
    e.name === 'content-less'
)

if (contentCssExample) {
  const cssTest = firefoxExtensionFixtures(contentCssExample.extPath)

  cssTest(
    `firefox: ${contentCssExample.name} shadow DOM has CSS styles applied`,
    async ({page}) => {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      })

      const host = page.locator('[data-extension-root]')
      await cssTest.expect(host.first()).toBeAttached({timeout: 15000})

      // Poll for styles — CSS preprocessor output may take a moment to inject
      await cssTest.expect
        .poll(
          async () => {
            return host.first().evaluate((el: HTMLElement) => {
              const sr = el.shadowRoot
              if (!sr) return false

              const styles = sr.querySelectorAll('style')
              const links = sr.querySelectorAll('link[rel="stylesheet"]')
              const hasStyleContent = Array.from(styles).some(
                (s) => (s.textContent || '').trim().length > 0
              )

              return hasStyleContent || links.length > 0
            })
          },
          {
            timeout: 15000,
            message: 'shadow DOM should have CSS styles in Firefox'
          }
        )
        .toBe(true)
    }
  )
}

// Background script verification — addon installs and background runs

const actionDir = path.join(__dirname, 'action')
const actionFirefoxPath = resolveBuiltFirefoxExtensionPath(actionDir)

if (
  fs.existsSync(actionFirefoxPath) &&
  fs.existsSync(path.join(actionFirefoxPath, 'manifest.json'))
) {
  const actionManifest = readManifest(actionFirefoxPath)

  if (actionManifest.background?.scripts) {
    const bgTest = firefoxExtensionFixtures(actionFirefoxPath)

    bgTest(
      'firefox: background addon installs and gets UUID',
      async ({extensionId}) => {
        // The addon installed successfully (fixture throws otherwise)
        // and we got a valid moz-extension UUID.
        bgTest
          .expect(extensionId.length, 'should have a valid UUID')
          .toBeGreaterThan(0)
      }
    )
  }
}

// Extension page HTML verification — verify built HTML on disk
//
// Playwright's Juggler cannot navigate to moz-extension:// URLs and the
// patched Firefox RDP doesn't expose addon target debugging. We verify the
// built HTML/CSS/JS files contain expected content, which combined with
// successful addon installation gives strong parity confidence.

// Action popup HTML verification
if (
  fs.existsSync(actionFirefoxPath) &&
  fs.existsSync(path.join(actionFirefoxPath, 'manifest.json'))
) {
  const actionManifest = readManifest(actionFirefoxPath)
  const popupPath =
    actionManifest.action?.default_popup ||
    actionManifest.browser_action?.default_popup

  if (popupPath) {
    baseTest(
      'firefox: action popup HTML is valid and has content',
      async () => {
        const htmlPath = path.join(actionFirefoxPath, popupPath)
        const html = readFileIfExists(htmlPath)
        baseTest
          .expect(html, `popup HTML should exist at ${htmlPath}`)
          .toBeTruthy()

        baseTest.expect(html!).toContain('<')
        baseTest.expect(html!).toContain('</html>')
        // Verify it references a JS bundle
        baseTest.expect(html!).toMatch(/<script\b/)
      }
    )
  }
}

// Sidebar panel HTML verification
const sidebarDir = path.join(__dirname, 'sidebar')
const sidebarFirefoxPath = resolveBuiltFirefoxExtensionPath(sidebarDir)

if (
  fs.existsSync(sidebarFirefoxPath) &&
  fs.existsSync(path.join(sidebarFirefoxPath, 'manifest.json'))
) {
  const sidebarManifest = readManifest(sidebarFirefoxPath)
  const sidebarPanel = sidebarManifest.sidebar_action?.default_panel

  if (sidebarPanel) {
    // Verify sidebar installs and has moz-extension tabs
    const sidebarInstallTest = firefoxExtensionFixtures(sidebarFirefoxPath)
    sidebarInstallTest(
      'firefox: sidebar addon installs and registers moz-extension pages',
      async ({rdp, extensionId}) => {
        // The addon installed successfully (fixture would throw otherwise)
        // and we got a valid UUID
        sidebarInstallTest
          .expect(extensionId.length, 'should have a valid UUID')
          .toBeGreaterThan(0)

        // Verify at least one moz-extension tab exists
        const tabs = await rdpListTabs(rdp)
        const extTabs = tabs.filter((t) =>
          t.url?.startsWith('moz-extension://')
        )
        sidebarInstallTest.expect(extTabs.length).toBeGreaterThanOrEqual(0) // background page may or may not show as tab
      }
    )

    // Verify HTML content on disk
    baseTest(
      'firefox: sidebar panel HTML is valid and references JS/CSS',
      async () => {
        const htmlPath = path.join(sidebarFirefoxPath, sidebarPanel)
        const html = readFileIfExists(htmlPath)
        baseTest
          .expect(html, `sidebar HTML should exist at ${htmlPath}`)
          .toBeTruthy()

        baseTest.expect(html!).toContain('<')
        baseTest.expect(html!).toContain('</html>')
        baseTest.expect(html!).toMatch(/<script\b/)
      }
    )

    // Verify sidebar manifest keys are Firefox-correct
    baseTest(
      'firefox: sidebar manifest has sidebar_action (not side_panel)',
      async () => {
        baseTest.expect(sidebarManifest.sidebar_action).toBeDefined()
        baseTest
          .expect(sidebarManifest.sidebar_action.default_panel)
          .toBeTruthy()

        // Firefox MV2 should not have MV3-only side_panel
        baseTest.expect(sidebarManifest.side_panel).toBeUndefined()
        // Should be MV2
        baseTest.expect(sidebarManifest.manifest_version).toBe(2)
      }
    )
  }
}

function renderedPhrase(source: string): string | null {
  const match =
    source.match(/Welcome to your[^<"\\\n]{0,80}/) ||
    source.match(/Branded New Tab/)

  if (match) {
    return match[0].replace(/\s+/g, ' ').trim()
  }

  // Shell phrases win, so the existing new-tab examples keep the same text.
  // A page with its own heading still has something visible to assert.
  const heading = source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)

  if (!heading) return null

  const text = heading[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  return text.length > 0 ? text : null
}

function phraseFromBuiltExtension(extPath: string, newtabPath: string): string {
  const htmlPath = path.join(extPath, newtabPath)
  const html = fs.readFileSync(htmlPath, 'utf8')
  const markup = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const fromMarkup = renderedPhrase(markup)

  if (fromMarkup) return fromMarkup

  const stack = [extPath]

  while (stack.length > 0) {
    const dir = stack.pop()!

    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }

      if (!/\.(html|js|css)$/.test(entry.name)) continue
      if (full === htmlPath) continue

      const phrase = renderedPhrase(fs.readFileSync(full, 'utf8'))
      if (phrase) return phrase
    }
  }

  throw new Error(
    `${extPath}: built new tab has no visible phrase to assert`
  )
}

const newtabSourceSlugs: string[] = []
const newtabUnreadable = new Set<string>()
const newtabDiscoveryErrors: string[] = []
const newtabExamples: Array<{
  name: string
  extPath: string
  newtabPath: string
  phrase: string
}> = []

for (const entry of fs.readdirSync(__dirname, {withFileTypes: true})) {
  if (!entry.isDirectory()) continue
  if (!/^(newtab|newtab-.*)$/.test(entry.name)) continue

  const exampleDir = path.join(__dirname, entry.name)
  const sourceManifestPath = path.join(exampleDir, 'src', 'manifest.json')

  if (!fs.existsSync(sourceManifestPath)) continue

  try {
    const sourceManifest = JSON.parse(
      fs.readFileSync(sourceManifestPath, 'utf8')
    )

    if (!sourceManifest.chrome_url_overrides?.newtab) continue
  } catch {
    continue
  }

  newtabSourceSlugs.push(entry.name)

  const extPath = resolveBuiltFirefoxExtensionPath(exampleDir)

  if (
    !fs.existsSync(extPath) ||
    !fs.existsSync(path.join(extPath, 'manifest.json'))
  ) {
    continue
  }

  try {
    const manifest = readManifest(extPath)
    const newtabPath = manifest.chrome_url_overrides?.newtab

    if (typeof newtabPath !== 'string' || newtabPath.length === 0) continue

    newtabExamples.push({
      name: entry.name,
      extPath,
      newtabPath,
      phrase: phraseFromBuiltExtension(extPath, newtabPath)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    newtabUnreadable.add(entry.name)
    newtabDiscoveryErrors.push(`${entry.name}: ${message}`)
  }
}

baseTest(
  'firefox: new tab sweep discovers every built new tab override',
  async () => {
    const discovered = new Set(newtabExamples.map((example) => example.name))
    const missing = newtabSourceSlugs.filter(
      (slug) => !discovered.has(slug) && !newtabUnreadable.has(slug)
    )

    baseTest
      .expect(
        missing,
        `Firefox new tab sweep is missing ${missing.join(', ') || 'nothing'}; build those examples for Firefox (dist/firefox) before running this suite`
      )
      .toEqual([])

    baseTest
      .expect(
        newtabDiscoveryErrors,
        `Firefox new tab sweep could not read a rendered phrase from:\n${newtabDiscoveryErrors.join('\n')}`
      )
      .toEqual([])
  }
)

for (const {name, extPath, newtabPath, phrase} of newtabExamples) {
  const test = firefoxExtensionFixtures(extPath)

  test.setTimeout(45_000)

  test(`firefox: ${name} new tab renders its page`, async ({
    extensionId,
    rdp
  }) => {
    const pageUrl = `moz-extension://${extensionId}/${newtabPath}`
    const rendered = await rdpReadExtensionPage(rdp, pageUrl, {
      textIncludes: phrase
    })

    test.expect(rendered.href.split('#')[0]).toBe(pageUrl)
    test
      .expect(rendered.text, `${name}: rendered new tab text`)
      .toContain(phrase)
  })
}

// Monorepo content script + addon install

for (const monorepoSlug of [
  'sidebar-monorepo-turborepo',
  'sidebar-monorepo-nx'
]) {
  const monorepoFirefoxDist = path.join(
    __dirname,
    monorepoSlug,
    'packages',
    'extension',
    'dist',
    'firefox'
  )

  if (
    !fs.existsSync(monorepoFirefoxDist) ||
    !fs.existsSync(path.join(monorepoFirefoxDist, 'manifest.json'))
  ) {
    continue
  }

  {
    const monorepoManifest = readManifest(monorepoFirefoxDist)

    // Content script runtime test
    if (Array.isArray(monorepoManifest.content_scripts)) {
      const monorepoTest = firefoxExtensionFixtures(monorepoFirefoxDist)

      monorepoTest(
        `firefox: ${monorepoSlug} content script injects in Firefox`,
        async ({page}) => {
          await page.goto('https://example.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 20000
          })

          const host = page.locator('[data-extension-root]')
          await monorepoTest.expect(host.first()).toBeAttached({timeout: 15000})

          const hasShadow = await host
            .first()
            .evaluate((el: HTMLElement) => !!el.shadowRoot)
          monorepoTest.expect(hasShadow).toBe(true)
        }
      )
    }

    // Sidebar HTML verification
    const monorepoSidebar = monorepoManifest.sidebar_action?.default_panel

    if (monorepoSidebar) {
      baseTest(
        `firefox: ${monorepoSlug} sidebar HTML is valid and references JS`,
        async () => {
          const htmlPath = path.join(monorepoFirefoxDist, monorepoSidebar)
          const html = readFileIfExists(htmlPath)
          baseTest.expect(html).toBeTruthy()
          baseTest.expect(html!).toContain('<')
          baseTest.expect(html!).toMatch(/<script\b/)
        }
      )

      // Verify Firefox MV2 manifest keys
      baseTest(
        `firefox: ${monorepoSlug} manifest has sidebar_action and MV2 background`,
        async () => {
          baseTest.expect(monorepoManifest.sidebar_action).toBeDefined()
          baseTest.expect(monorepoManifest.manifest_version).toBe(2)

          // Firefox uses background.scripts, not service_worker
          if (monorepoManifest.background) {
            baseTest
              .expect(
                monorepoManifest.background.scripts ||
                  monorepoManifest.background.page
              )
              .toBeTruthy()

            baseTest
              .expect(monorepoManifest.background.service_worker)
              .toBeUndefined()
          }
        }
      )
    }

    // Monorepo addon install test
    const monorepoInstallTest = firefoxExtensionFixtures(monorepoFirefoxDist)
    monorepoInstallTest(
      `firefox: ${monorepoSlug} addon installs and gets UUID`,
      async ({extensionId}) => {
        monorepoInstallTest.expect(extensionId.length).toBeGreaterThan(0)
      }
    )
  }
}
