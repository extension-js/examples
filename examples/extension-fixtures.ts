import {
  test as base,
  chromium,
  type Page,
  type BrowserContext,
  type ElementHandle
} from '@playwright/test'
import path from 'path'
import {execSync} from 'child_process'
import fs from 'fs'
import {getDirname} from '../dirname'

export const extensionFixtures = (
  pathToExtension: string,
  headless: boolean = false
) => {
  return base.extend<{
    context: BrowserContext
    extensionId: string
  }>({
    context: async ({}, use) => {
      const os = await import('os')
      const tmpRoot = os.tmpdir()
      const userDataDir = fs.mkdtempSync(path.join(tmpRoot, 'pw-ext-'))
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: headless,
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
          '--no-first-run', // Disable Chrome's native first run experience.
          '--disable-client-side-phishing-detection', // Disables client-side phishing detection
          '--disable-component-extensions-with-background-pages', // Disable some built-in extensions that aren't affected by '--disable-extensions'
          '--disable-default-apps', // Disable installation of default apps
          '--disable-features=InterestFeedContentSuggestions', // Disables the Discover feed on NTP
          '--disable-features=Translate', // Disables Chrome translation, both the manual option and the popup prompt when a page with differing language is detected.
          '--hide-scrollbars', // Hide scrollbars from screenshots.
          '--mute-audio', // Mute any audio
          '--no-default-browser-check', // Disable the default browser check, do not prompt to set it as such
          '--no-first-run', // Skip first run wizards
          '--ash-no-nudges', // Avoids blue bubble "user education" nudges (eg., "... give your browser a new look", Memory Saver)
          '--disable-search-engine-choice-screen', // Disable the 2023+ search engine choice screen
          '--disable-features=MediaRoute', // Avoid the startup dialog for `Do you want the application “Chromium.app” to accept incoming network connections?`.  Also disables the Chrome Media Router which creates background networking activity to discover cast targets. A superset of disabling DialMediaRouteProvider.
          '--use-mock-keychain', // Use mock keychain on Mac to prevent the blocking permissions dialog about "Chrome wants to use your confidential information stored in your keychain"
          '--disable-background-networking', // Disable various background network services, including extension updating, safe browsing service, upgrade detector, translate, UMA
          '--disable-breakpad', // Disable crashdump collection (reporting is already disabled in Chromium)
          '--disable-component-update', // Don't update the browser 'components' listed at chrome://components/
          '--disable-domain-reliability', // Disables Domain Reliability Monitoring, which tracks whether the browser has difficulty contacting Google-owned sites and uploads reports to Google.
          '--disable-features=AutofillServerCommunicatio', // Disables autofill server communication. This feature isn't disabled via other 'parent' flags.
          '--disable-features=CertificateTransparencyComponentUpdate',
          '--disable-sync', // Disable syncing to a Google account
          '--disable-features=OptimizationHints', // Used for turning on Breakpad crash reporting in a debug environment where crash reporting is typically compiled but disabled. Disable the Chrome Optimization Guide and networking with its service API
          '--disable-features=DialMediaRouteProvider', // A weaker form of disabling the MediaRouter feature. See that flag's details.
          '--no-pings', // Don't send hyperlink auditing pings
          '--enable-features=SidePanelUpdates' // Ensure the side panel is visible. This is used for testing the side panel feature.
        ].filter((arg) => !!arg)
      })
      await use(context)
      await context.close()
    },
    extensionId: async ({context}, use) => {
      // Try Preferences-based discovery first (works even without background/service worker).
      let extensionId: string | undefined
      try {
        // derive userDataDir from context
        // @ts-ignore internal property accessible via as any
        const browserContext: any = context
        const userDataDir: string | undefined =
          browserContext?._browser?._options?.userDataDir ||
          browserContext?._options?.userDataDir
        if (userDataDir) {
          const prefsPath = path.join(userDataDir, 'Default', 'Preferences')
          const prefsText = fs.readFileSync(prefsPath, 'utf-8')
          const prefs = JSON.parse(prefsText)
          const settings = prefs?.extensions?.settings || {}
          for (const [id, info] of Object.entries<any>(settings)) {
            if (
              info?.path &&
              path.resolve(String(info.path)) === path.resolve(pathToExtension)
            ) {
              extensionId = id
              break
            }
          }
        }
      } catch {}
      if (!extensionId) {
        // Fallback for MV3 with background service worker.
        let [background] = context.serviceWorkers()
        if (!background)
          background = await context.waitForEvent('serviceworker')
        extensionId = background.url().split('/')[2]
      }
      await use(extensionId!)
    }
  })
}

// Screenshot function
export async function takeScreenshot(page: any, screenshotPath: string) {
  await page.screenshot({path: screenshotPath})
}

/**
 * Utility to access elements inside the Shadow DOM.
 * @param page The Playwright Page object.
 * @param shadowHostSelector The selector for the Shadow DOM host element.
 * @param innerSelector The selector for the element inside the Shadow DOM.
 * @returns A Promise resolving to an ElementHandle for the inner element or null if not found.
 */
export async function getShadowRootElement(
  page: Page,
  shadowHostSelector: string,
  innerSelector: string
): Promise<ElementHandle<HTMLElement> | null> {
  // Wait for shadow host to be present (not necessarily visible)
  await page.waitForSelector(shadowHostSelector, {
    state: 'attached',
    timeout: 15000
  })

  // Get the shadow host element
  const shadowHost = page.locator(shadowHostSelector)
  const shadowRootHandle = await shadowHost.evaluateHandle(
    (host: HTMLElement) => host.shadowRoot
  )

  // Find element within shadow root
  const element = await shadowRootHandle.evaluateHandle(
    (shadowRoot: ShadowRoot, selector: string) =>
      shadowRoot?.querySelector(selector) ?? null,
    innerSelector
  )

  return element.asElement() as ElementHandle<HTMLElement> | null
}

export async function waitForShadowElement(
  page: Page,
  shadowHostSelector: string,
  innerSelector: string,
  timeoutMs = 10000
): Promise<ElementHandle<HTMLElement> | null> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const el = await getShadowRootElement(
        page,
        shadowHostSelector,
        innerSelector
      )
      if (el) return el
    } catch {}
    await page.waitForTimeout(250)
  }
  return null
}

export function getPathToExtension(exampleDir: string): string {
  const __dirname = getDirname(import.meta.url)
  const absoluteExampleDir = path.join(__dirname, exampleDir)
  const chromeDist = path.join(absoluteExampleDir, 'dist', 'chrome')
  try {
    const fs = require('fs') as typeof import('fs')
    if (!fs.existsSync(chromeDist)) {
      execSync(`pnpm extension build ${exampleDir}`, {
        cwd: __dirname,
        stdio: 'inherit'
      })
    }
  } catch {}
  return chromeDist
}

export async function getExtensionId(pathToExtension: string): Promise<string> {
  const os = await import('os')
  const tmpRoot = os.tmpdir()
  const userDataDir = fs.mkdtempSync(path.join(tmpRoot, 'pw-ext-'))
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-first-run'
    ]
  })
  try {
    // Try Preferences lookup
    try {
      const prefsPath = path.join(userDataDir, 'Default', 'Preferences')
      const prefsText = fs.readFileSync(prefsPath, 'utf-8')
      const prefs = JSON.parse(prefsText)
      const settings = prefs?.extensions?.settings || {}
      for (const [id, info] of Object.entries<any>(settings)) {
        if (
          info?.path &&
          path.resolve(String(info.path)) === path.resolve(pathToExtension)
        ) {
          return id
        }
      }
    } catch {}
    // Fallback to waiting for background service worker
    let [background] = context.serviceWorkers()
    if (!background) background = await context.waitForEvent('serviceworker')
    return background.url().split('/')[2]
  } finally {
    await context.close()
  }
}

export function getSidebarPath(extensionId: string): string {
  return `chrome-extension://${extensionId}/sidebar/index.html`
}

export function resolveBuiltExtensionPath(exampleDirAbsolute: string): string {
  const roots = ['dist', 'build', '.extension']
  const channels = ['chrome', 'chromium', 'chrome-mv3']
  const candidateDirs: string[] = []
  for (const root of roots) {
    for (const ch of channels) {
      candidateDirs.push(path.join(exampleDirAbsolute, root, ch))
    }
  }
  const hasManifest = (dir: string) => {
    try {
      return fs.existsSync(path.join(dir, 'manifest.json'))
    } catch {
      return false
    }
  }
  for (const dir of candidateDirs) if (hasManifest(dir)) return dir
  // Try building once if not present
  try {
    execSync(
      `node ../../ci-scripts/build-with-manifest.mjs build --browser=chrome`,
      {
        cwd: exampleDirAbsolute,
        stdio: 'inherit'
      }
    )
  } catch {}
  for (const dir of candidateDirs) if (hasManifest(dir)) return dir
  // As a last attempt, search shallowly under known roots for any manifest.json
  for (const root of roots) {
    const rootPath = path.join(exampleDirAbsolute, root)
    try {
      const entries = fs.readdirSync(rootPath, {withFileTypes: true})
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const dir = path.join(rootPath, entry.name)
        if (hasManifest(dir)) return dir
      }
    } catch {}
  }
  // Last resort: return default expected path (will fail loudly in Playwright if missing)
  return path.join(exampleDirAbsolute, 'dist', 'chrome')
}
