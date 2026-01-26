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
import {getDirname} from './dirname.js'

export const extensionFixtures = (
  pathToExtension: string,
  headless?: boolean
) => {
  // Default to HEADED mode (not headless) for better extension compatibility.
  // Only enable headless if explicitly requested via HEADLESS=true or parameter.
  const isHeadless =
    headless !== undefined ? headless : process.env.HEADLESS === 'true'

  // Map to store userDataDir per context instance (for parallel test safety)
  const userDataDirMap = new WeakMap<BrowserContext, string>()

  return base.extend<{
    context: BrowserContext
    page: Page
    extensionId: string
  }>({
    context: async ({}, use) => {
      const os = await import('os')
      const tmpRoot = os.tmpdir()
      const userDataDir = fs.mkdtempSync(path.join(tmpRoot, 'pw-ext-'))
      let context: BrowserContext | null = null
      try {
        context = await chromium.launchPersistentContext(userDataDir, {
          headless: isHeadless,
          args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
            '--no-first-run', // Disable Chrome's native first run experience.
            // Ensure extensions are loaded before page navigation
            '--disable-extensions-file-access-check', // Allow extension file access
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
            '--disable-features=MediaRoute', // Avoid the startup dialog for `Do you want the application "Chromium.app" to accept incoming network connections?`.  Also disables the Chrome Media Router which creates background networking activity to discover cast targets. A superset of disabling DialMediaRouteProvider.
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
        // Store userDataDir for this context instance
        userDataDirMap.set(context, userDataDir)

        // Wait for extension to load by checking for service worker registration
        // Use event-based waiting instead of hardcoded delays
        let hasServiceWorker = false
        try {
          // Check if service worker already exists
          if (context.serviceWorkers().length === 0) {
            // Wait for service worker to register (if extension has background script)
            // Use 3-second timeout - if no service worker appears, extension may not have one
            await context
              .waitForEvent('serviceworker', {timeout: 3000})
              .catch(() => {
                // Extension may not have background script (e.g., action popups)
              })
          }
          hasServiceWorker = context.serviceWorkers().length > 0
        } catch {
          // Extension may not have background script, continue anyway
        }

        // For extensions without service workers (like action popups), give Chrome
        // more time to write the Preferences file before tests try to read it
        // Chrome writes Preferences asynchronously, so we need to wait
        if (!hasServiceWorker) {
          await new Promise((resolve) => setTimeout(resolve, 2500))
        }

        await use(context)
      } finally {
        // Ensure context is closed even if test fails or times out
        if (context) {
          try {
            await context.close()
          } catch (error) {
            // Ignore errors during close (context may already be closed)
          }
        }
        // Clean up temp directory
        try {
          if (userDataDir && fs.existsSync(userDataDir)) {
            fs.rmSync(userDataDir, {recursive: true, force: true})
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    },
    page: async ({context}, use) => {
      // Get the first page from the persistent context, or create a new one
      const pages = context.pages()
      const page = pages.length > 0 ? pages[0] : await context.newPage()

      // Extension should already be loaded from context fixture
      // No need for additional delays - tests should wait for actual conditions
      await use(page)
    },
    extensionId: async ({context}, use) => {
      // Validate extension directory exists before proceeding
      if (
        !fs.existsSync(pathToExtension) ||
        !fs.existsSync(path.join(pathToExtension, 'manifest.json'))
      ) {
        throw new Error(
          `Extension not built or invalid: ${pathToExtension}. ` +
            `Directory exists: ${fs.existsSync(pathToExtension)}, ` +
            `Manifest exists: ${fs.existsSync(path.join(pathToExtension, 'manifest.json'))}`
        )
      }

      let extensionId: string | undefined

      // Helper function to read extension ID from Preferences
      const readExtensionIdFromPreferences = (
        userDataDir: string
      ): string | undefined => {
        try {
          const prefsPath = path.join(userDataDir, 'Default', 'Preferences')
          if (!fs.existsSync(prefsPath)) {
            return undefined
          }

          // Check file size - if it's very small, it might not have extension data yet
          const stats = fs.statSync(prefsPath)
          if (stats.size < 100) {
            return undefined
          }

          const prefsText = fs.readFileSync(prefsPath, 'utf-8')
          if (!prefsText || prefsText.trim().length === 0) {
            return undefined
          }

          const prefs = JSON.parse(prefsText)
          const settings = prefs?.extensions?.settings || {}

          // Check if we have any extension settings at all
          const extensionEntries = Object.entries<any>(settings).filter(
            ([_, info]) => info?.path
          )
          if (extensionEntries.length === 0) {
            return undefined
          }

          // Normalize the target path for comparison
          const normalizedTargetPath = path.resolve(pathToExtension)
          const targetBasename = path.basename(normalizedTargetPath)

          // Since we use --disable-extensions-except, there should only be one extension
          // If there's exactly one extension, use it (faster and more reliable)
          if (extensionEntries.length === 1) {
            return extensionEntries[0][0]
          }

          // Otherwise, try to match by path
          for (const [id, info] of extensionEntries) {
            if (info?.path) {
              try {
                // Normalize both paths for comparison
                const normalizedInfoPath = path.resolve(String(info.path))
                // Check exact match first
                if (normalizedInfoPath === normalizedTargetPath) {
                  return id
                }
                // Check if resolved paths point to the same location (handles symlinks)
                if (
                  fs.realpathSync(normalizedInfoPath) ===
                  fs.realpathSync(normalizedTargetPath)
                ) {
                  return id
                }
                // Fallback: check if basenames match (for cases where Chrome stores relative paths)
                if (path.basename(normalizedInfoPath) === targetBasename) {
                  // Additional check: verify parent directory matches
                  const targetParent = path.dirname(normalizedTargetPath)
                  const infoParent = path.dirname(normalizedInfoPath)
                  if (
                    path.basename(targetParent) === path.basename(infoParent)
                  ) {
                    return id
                  }
                }
              } catch {
                // Skip this entry if path resolution fails
                continue
              }
            }
          }
        } catch (error) {
          // Ignore errors during Preferences read (file might not exist yet, etc.)
        }
        return undefined
      }

      // Get userDataDir from WeakMap (thread-safe, per-context instance)
      const userDataDir: string | undefined = userDataDirMap.get(context)

      // Try CDP first (fastest and most reliable method for extensions with background scripts)
      try {
        const testPage = context.pages()[0] || (await context.newPage())
        const cdpSession = await context.newCDPSession(testPage)
        try {
          const targets = await cdpSession.send('Target.getTargets')
          const extensionTargets = targets.targetInfos.filter(
            (target: any) =>
              target.type === 'service_worker' ||
              target.url?.startsWith('chrome-extension://')
          )

          if (extensionTargets.length > 0) {
            const extensionUrl = extensionTargets[0].url
            const match = extensionUrl.match(/chrome-extension:\/\/([a-z]{32})/)
            if (match && match[1]) {
              extensionId = match[1]
            }
          }
        } finally {
          await cdpSession.detach()
        }
      } catch (cdpError) {
        // CDP failed, continue to fallback methods
      }

      // Fallback 1: Try service worker (for MV3 extensions with background scripts)
      if (!extensionId) {
        let [background] = context.serviceWorkers()
        if (!background) {
          try {
            background = await context.waitForEvent('serviceworker', {
              timeout: 5000
            })
          } catch {
            // No service worker - extension may not have background script
          }
        }
        if (background) {
          extensionId = background.url().split('/')[2]
        }
      }

      // Fallback 2: Read from Preferences file (for extensions without background scripts)
      // Action popups and other extensions without service workers rely on Preferences file
      if (!extensionId && userDataDir) {
        // Give Preferences file time to be written (Chrome writes it asynchronously)
        // Start with a small initial wait, then poll with retries
        await new Promise((resolve) => setTimeout(resolve, 500))

        const maxRetries = 20
        const retryDelay = 300 // Fixed delay, no exponential backoff

        for (let i = 0; i < maxRetries; i++) {
          extensionId = readExtensionIdFromPreferences(userDataDir)
          if (extensionId) {
            break
          }
          if (i < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay))
          }
        }
      }

      if (!extensionId) {
        // Provide more detailed error message for debugging
        const errorDetails = userDataDir
          ? `Preferences file exists: ${fs.existsSync(path.join(userDataDir, 'Default', 'Preferences'))}`
          : 'UserDataDir not found'
        throw new Error(
          `Could not determine extension ID for ${pathToExtension}. ${errorDetails}. ` +
            `Service workers: ${context.serviceWorkers().length}`
        )
      }
      await use(extensionId)
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
  innerSelector: string,
  timeoutMs: number = 30000
): Promise<ElementHandle<HTMLElement> | null> {
  // Use longer timeout in CI/headless mode for content script injection
  const isCI = !!process.env.CI
  const effectiveTimeout = timeoutMs === 30000 && isCI ? 60000 : timeoutMs

  // Wait for shadow host to be present (not necessarily visible)
  await page.waitForSelector(shadowHostSelector, {
    state: 'attached',
    timeout: effectiveTimeout
  })

  // Get the shadow host element
  const shadowHost = page.locator(shadowHostSelector)
  const shadowRootHandle = await shadowHost.evaluateHandle(
    (host: HTMLElement) => host.shadowRoot
  )

  // Wait for shadow root to be ready and element to exist
  const startTime = Date.now()
  while (Date.now() - startTime < effectiveTimeout) {
    const element = await shadowRootHandle.evaluateHandle(
      (shadowRoot: ShadowRoot, selector: string) =>
        shadowRoot?.querySelector(selector) ?? null,
      innerSelector
    )
    const elementHandle =
      element.asElement() as ElementHandle<HTMLElement> | null
    if (elementHandle) {
      return elementHandle
    }
    await page.waitForTimeout(250)
  }

  return null
}

export async function waitForShadowElement(
  page: Page,
  shadowHostSelector: string,
  innerSelector: string,
  timeoutMs = 30000
): Promise<ElementHandle<HTMLElement> | null> {
  // Use longer timeout in CI/headless mode for content script injection
  const isCI = !!process.env.CI
  const effectiveTimeout = timeoutMs === 30000 && isCI ? 60000 : timeoutMs

  const start = Date.now()
  while (Date.now() - start < effectiveTimeout) {
    try {
      const el = await getShadowRootElement(
        page,
        shadowHostSelector,
        innerSelector,
        timeoutMs
      )
      if (el) return el
    } catch {
      /* noop */
    }
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
  } catch {
    /* noop */
  }
  return chromeDist
}

export async function getExtensionId(pathToExtension: string): Promise<string> {
  const os = await import('os')
  const tmpRoot = os.tmpdir()
  const userDataDir = fs.mkdtempSync(path.join(tmpRoot, 'pw-ext-'))
  const isHeadless = process.env.HEADLESS === 'true'
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: isHeadless,
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
    } catch {
      /* noop */
    }
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
  } catch {
    /* noop */
  }
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
    } catch {
      /* noop */
    }
  }
  // Last resort: return default expected path (will fail loudly in Playwright if missing)
  return path.join(exampleDirAbsolute, 'dist', 'chrome')
}
