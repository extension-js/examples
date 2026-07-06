import {test, expect} from '@playwright/test'
import {
  extensionFixtures,
  waitForShadowElement,
  getSidebarPath,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'
import path from 'path'
import fs from 'fs'
import {execSync} from 'child_process'

const __dirname = getDirname(import.meta.url)
const monorepoRoot = __dirname
const extensionPackageDir = path.join(__dirname, 'packages', 'extension')
const analyticsPackageDir = path.join(__dirname, 'packages', 'analytics')

// Ensure build exists
const buildScript = path.join(
  __dirname,
  '..',
  '..',
  'scripts',
  'build-with-manifest.mjs'
)
const expectedDist = path.join(extensionPackageDir, 'dist', 'chrome')
if (!fs.existsSync(path.join(expectedDist, 'manifest.json'))) {
  try {
    execSync(`node ${buildScript} build --browser=chrome`, {
      cwd: extensionPackageDir,
      stdio: 'inherit'
    })
  } catch {
    /* noop */
  }
}
const pathToExtension = expectedDist
const runtimeTest = extensionFixtures(pathToExtension)

// ---------------------------------------------------------------------------
// Monorepo structure validation (static checks)
// ---------------------------------------------------------------------------

test.describe('Monorepo Structure', () => {
  test('build output lives inside nested packages/extension/dist, not root dist', () => {
    // Common monorepo gotcha: build output placed at root instead of in the
    // workspace package. Extension.js must respect the package boundary.
    const rootDist = path.join(monorepoRoot, 'dist')
    const rootDistHasManifest =
      fs.existsSync(rootDist) &&
      fs.existsSync(path.join(rootDist, 'chrome', 'manifest.json'))
    expect(
      rootDistHasManifest,
      'Build output should NOT appear at monorepo root dist/'
    ).toBe(false)

    expect(
      fs.existsSync(path.join(expectedDist, 'manifest.json')),
      'Build output should be in packages/extension/dist/chrome/'
    ).toBe(true)
  })

  test('pnpm-workspace.yaml declares packages/*', () => {
    const wsFile = path.join(monorepoRoot, 'pnpm-workspace.yaml')
    expect(fs.existsSync(wsFile)).toBe(true)
    const content = fs.readFileSync(wsFile, 'utf8')
    expect(content).toContain('packages/*')
  })

  test('workspace packages have correct package.json metadata', () => {
    const extPkg = JSON.parse(
      fs.readFileSync(path.join(extensionPackageDir, 'package.json'), 'utf8')
    )
    expect(extPkg.name).toContain('monorepo')
    expect(extPkg.private).toBe(true)

    const analyticsPkg = JSON.parse(
      fs.readFileSync(path.join(analyticsPackageDir, 'package.json'), 'utf8')
    )
    expect(analyticsPkg.exports).toBeDefined()
    expect(analyticsPkg.exports['.']).toBe('./src/index.js')
  })

  test('analytics package exports a valid module', () => {
    const indexPath = path.join(analyticsPackageDir, 'src', 'index.js')
    expect(fs.existsSync(indexPath)).toBe(true)
    const content = fs.readFileSync(indexPath, 'utf8')
    expect(content).toContain('export')
    expect(content).toContain('trackEvent')
  })

  test('extension.config.js is at monorepo root', () => {
    const configPath = path.join(monorepoRoot, 'extension.config.js')
    expect(fs.existsSync(configPath)).toBe(true)
    const content = fs.readFileSync(configPath, 'utf8')
    expect(content).toContain('browser')
    expect(content).toContain('profile')
  })

  test('turbo.json declares build task with correct inputs/outputs', () => {
    const turboPath = path.join(monorepoRoot, 'turbo.json')
    expect(fs.existsSync(turboPath)).toBe(true)
    const turbo = JSON.parse(fs.readFileSync(turboPath, 'utf8'))
    expect(turbo.tasks.build).toBeDefined()
    expect(turbo.tasks.build.outputs).toContain('dist/**')
  })
})

// ---------------------------------------------------------------------------
// Build artifact completeness
// ---------------------------------------------------------------------------

test.describe('Monorepo Build Artifacts', () => {
  test('manifest.json has all expected keys', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(expectedDist, 'manifest.json'), 'utf8')
    )
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.name).toContain('Monorepo')
    expect(manifest.content_scripts).toBeDefined()
    expect(manifest.content_scripts.length).toBeGreaterThan(0)
    expect(manifest.background).toBeDefined()
    expect(manifest.side_panel).toBeDefined()
    expect(manifest.side_panel.default_path).toContain('sidebar/')
  })

  test('content script JS exists and is non-empty', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(expectedDist, 'manifest.json'), 'utf8')
    )
    for (const cs of manifest.content_scripts) {
      for (const jsFile of cs.js || []) {
        const jsPath = path.join(expectedDist, jsFile)
        expect(
          fs.existsSync(jsPath),
          `content script ${jsFile} should exist`
        ).toBe(true)
        const content = fs.readFileSync(jsPath, 'utf8')
        expect(content.length).toBeGreaterThan(100)
      }
    }
  })

  test('background service worker exists', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(expectedDist, 'manifest.json'), 'utf8')
    )
    const sw = manifest.background?.service_worker
    expect(sw, 'manifest should declare a service_worker').toBeTruthy()
    expect(
      fs.existsSync(path.join(expectedDist, sw)),
      `service worker ${sw} should exist on disk`
    ).toBe(true)
  })

  test('sidebar HTML exists and references CSS + JS', () => {
    const sidebarHtml = path.join(expectedDist, 'sidebar', 'index.html')
    expect(fs.existsSync(sidebarHtml)).toBe(true)
    const html = fs.readFileSync(sidebarHtml, 'utf8')
    // Must have a stylesheet link
    expect(html).toMatch(/link[^>]+rel="stylesheet"/)
    expect(html).toMatch(/\.css/)
    // Must have a script tag
    expect(html).toMatch(/<script[^>]+src=/)
  })

  test('sidebar CSS file exists and is non-empty', () => {
    const sidebarCss = path.join(expectedDist, 'sidebar', 'index.css')
    expect(fs.existsSync(sidebarCss)).toBe(true)
    const css = fs.readFileSync(sidebarCss, 'utf8')
    expect(css.trim().length).toBeGreaterThan(0)
  })

  test('sidebar JS file exists', () => {
    const sidebarJs = path.join(expectedDist, 'sidebar', 'index.js')
    expect(fs.existsSync(sidebarJs)).toBe(true)
  })

  test('icons are present in build output', () => {
    // Icons keep their in-project paths in the build output (extension
    // >= 4.0.4), so verify every icon the built manifest declares exists.
    const manifest = JSON.parse(
      fs.readFileSync(path.join(expectedDist, 'manifest.json'), 'utf8')
    )
    const iconPaths = Object.values(manifest.icons ?? {}) as string[]
    expect(iconPaths.length, 'manifest should declare icons').toBeGreaterThan(0)
    for (const iconPath of iconPaths) {
      expect(
        fs.existsSync(path.join(expectedDist, iconPath)),
        `icon ${iconPath} should exist in build output`
      ).toBe(true)
    }
  })

  test('no dev-only artifacts in production build', () => {
    const hotDir = path.join(expectedDist, 'hot')
    expect(fs.existsSync(hotDir), 'hot/ should not exist').toBe(false)

    const allFiles: string[] = []
    try {
      for (const f of fs.readdirSync(expectedDist, {recursive: true})) {
        allFiles.push(String(f))
      }
    } catch {}

    const hotUpdates = allFiles.filter((f) => f.includes('.hot-update.'))
    expect(hotUpdates.length, 'no hot-update files should be present').toBe(0)
  })

  test('no root-level monorepo files leak into build output', () => {
    // Common gotcha: turbo.json, pnpm-workspace.yaml, root package.json
    // leaking into the extension build output
    const shouldNotExist = [
      'turbo.json',
      'pnpm-workspace.yaml',
      'pnpm-lock.yaml',
      'extension.config.js'
    ]
    for (const file of shouldNotExist) {
      expect(
        fs.existsSync(path.join(expectedDist, file)),
        `${file} should not leak into build output`
      ).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Multi-browser build correctness
// ---------------------------------------------------------------------------

test.describe('Monorepo Multi-Browser Builds', () => {
  const firefoxDist = path.join(extensionPackageDir, 'dist', 'firefox')
  const edgeDist = path.join(extensionPackageDir, 'dist', 'edge')

  test('Firefox build uses MV2 with sidebar_action (not side_panel)', () => {
    test.skip(
      !fs.existsSync(path.join(firefoxDist, 'manifest.json')),
      'Firefox build not available'
    )
    const manifest = JSON.parse(
      fs.readFileSync(path.join(firefoxDist, 'manifest.json'), 'utf8')
    )
    expect(manifest.manifest_version).toBe(2)
    // Firefox MV2 must use sidebar_action, not side_panel
    expect(manifest.sidebar_action).toBeDefined()
    expect(manifest.sidebar_action.default_panel).toContain('sidebar/')
    expect(manifest.side_panel).toBeUndefined()
    // Firefox MV2 must use background.scripts, not service_worker
    expect(manifest.background?.scripts).toBeDefined()
    expect(manifest.background?.service_worker).toBeUndefined()
  })

  test('Edge build uses MV3 matching Chrome', () => {
    test.skip(
      !fs.existsSync(path.join(edgeDist, 'manifest.json')),
      'Edge build not available'
    )
    const manifest = JSON.parse(
      fs.readFileSync(path.join(edgeDist, 'manifest.json'), 'utf8')
    )
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.side_panel).toBeDefined()
    expect(manifest.background?.service_worker).toBeTruthy()
  })

  test('Firefox sidebar HTML includes CSS and JS', () => {
    test.skip(
      !fs.existsSync(path.join(firefoxDist, 'sidebar', 'index.html')),
      'Firefox sidebar HTML not available'
    )
    const html = fs.readFileSync(
      path.join(firefoxDist, 'sidebar', 'index.html'),
      'utf8'
    )
    expect(html).toMatch(/\.css/)
    expect(html).toMatch(/<script/)
  })
})

// ---------------------------------------------------------------------------
// Runtime tests (require Chromium with extension loaded)
// ---------------------------------------------------------------------------

runtimeTest(
  'monorepo content script renders visible UI',
  async ({page, extensionId}) => {
    await page.goto('https://example.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })
    const el = await waitForShadowElement(
      page,
      '[data-extension-root="true"]',
      '.monorepo_badge, h1, h2',
      15000
    )
    runtimeTest.expect(el).not.toBeNull()
  }
)

runtimeTest(
  'monorepo content script badge text matches expected label',
  async ({page}) => {
    await page.goto('https://example.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })
    const badge = await waitForShadowElement(
      page,
      '[data-extension-root="true"]',
      '.monorepo_badge',
      15000
    )
    runtimeTest.expect(badge).not.toBeNull()
    const text = await badge!.evaluate((el) => el.textContent)
    runtimeTest.expect(text).toContain('Turbopack Monorepo')
  }
)

runtimeTest(
  'monorepo content script shadow DOM has CSS applied',
  async ({page}) => {
    await page.goto('https://example.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })
    const host = page.locator('[data-extension-root="true"]')
    await runtimeTest.expect(host).toBeAttached({timeout: 15000})

    // Verify shadow root has style content (CSS was fetched and injected)
    const hasStyles = await host.evaluate((el: HTMLElement) => {
      const sr = el.shadowRoot
      if (!sr) return false
      const styles = sr.querySelectorAll('style')
      return Array.from(styles).some(
        (s) => (s.textContent || '').trim().length > 0
      )
    })
    runtimeTest
      .expect(hasStyles, 'shadow DOM should have injected CSS styles')
      .toBe(true)
  }
)

runtimeTest(
  'monorepo sidebar renders visible heading',
  async ({page, extensionId}) => {
    await page.goto(getSidebarPath(extensionId), {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })
    const heading = page.locator('h1, h2').first()
    await heading.waitFor({state: 'visible', timeout: 10000})
    await runtimeTest.expect(heading).toBeVisible()
    const text = await heading.textContent()
    runtimeTest.expect(text).toContain('Monorepo Sidebar')
  }
)

runtimeTest(
  'monorepo sidebar page has CSS applied (non-default background)',
  async ({page, extensionId}) => {
    await page.goto(getSidebarPath(extensionId), {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })
    await page
      .locator('h1, h2')
      .first()
      .waitFor({state: 'visible', timeout: 10000})
    // The sidebar CSS sets background: #0a0c10, verify it's applied
    const bg = await page.evaluate(() =>
      window
        .getComputedStyle(document.body)
        .getPropertyValue('background-color')
    )
    // Should NOT be default white (rgb(255, 255, 255)) — CSS must be loaded
    runtimeTest.expect(bg).not.toBe('rgb(255, 255, 255)')
  }
)
