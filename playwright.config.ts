// ███████╗██╗  ██╗ █████╗ ███╗   ███╗██████╗ ██╗     ███████╗███████╗
// ██╔════╝╚██╗██╔╝██╔══██╗████╗ ████║██╔══██╗██║     ██╔════╝██╔════╝
// █████╗   ╚███╔╝ ███████║██╔████╔██║██████╔╝██║     █████╗  ███████╗
// ██╔══╝   ██╔██╗ ██╔══██║██║╚██╔╝██║██╔═══╝ ██║     ██╔══╝  ╚════██║
// ███████╗██╔╝ ██╗██║  ██║██║ ╚═╝ ██║██║     ███████╗███████╗███████║
// ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝     ╚══════╝╚══════╝╚══════╝

import {defineConfig, devices} from '@playwright/test'

const isHeadless = process.env.HEADLESS === 'true'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // Pre-build every template referenced by the assets suite BEFORE workers
  // start. resolveBuiltExtensionPath() shells out to the CLI at module-load
  // time when dist/ is missing, and with 4 parallel workers re-importing the
  // same spec the concurrent builds race and produce partial dist/ writes
  // (observed as "manifest missing" chrome errors). Serial prebuild is the
  // only reliable way to eliminate the race.
  globalSetup: './scripts/prebuild-assets-templates.mjs',

  // Reasonable timeout for CI environments
  timeout: process.env.CI ? 60_000 : 30_000,
  testDir: './examples',

  // Global timeout to prevent worker teardown timeouts
  globalTimeout: process.env.CI ? 1800_000 : 900_000, // 30 min CI, 15 min local

  // Expect timeout for assertions
  expect: {
    timeout: process.env.CI ? 20_000 : 10_000
  },

  // Enable parallel execution for faster test runs
  fullyParallel: true,

  // Prevent accidental test.only commits
  forbidOnly: !!process.env.CI,

  // CI: 2 retries absorb transient failures. Local: 1 retry for faster iteration.
  retries: process.env.CI ? 2 : 1,

  // CI: 2 workers to avoid OOM with headed browsers. Local: 4 for speed.
  workers: process.env.CI ? 2 : 4,

  // CI gets machine-readable JSON; locally just list + HTML report.
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', {outputFolder: 'e2e-report'}],
        ['json', {outputFile: 'test-results.json'}]
      ]
    : [['list'], ['html', {outputFolder: 'e2e-report'}]],

  use: {
    // Respect HEADLESS environment variable, default to false (headed mode) for better extension compatibility
    // Content scripts inject more reliably in headed mode
    // In CI, use headless mode unless HEADLESS=false is explicitly set (requires xvfb-run)
    // Extensions load reliably only in headed mode.
    // Use HEADLESS=true explicitly when needed.
    headless: isHeadless,

    // Collect traces only on failure for better performance
    trace: 'retain-on-failure',

    // Capture media for all test failures
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Timeouts for network operations
    actionTimeout: process.env.CI ? 30000 : 20000,
    navigationTimeout: process.env.CI ? 60000 : 30000,

    // Stable viewport
    viewport: {width: 1280, height: 720},

    // Remove slowMo for faster execution
    launchOptions: {
      // No slowMo - removed for performance
    },

    // Better error handling
    ignoreHTTPSErrors: true
  },

  // Batch-based test execution for better performance
  // Each batch runs tests for a specific extension context type
  projects: [
    // Content Scripts Batch - Tests that inject into web pages
    {
      name: 'content',
      testMatch: /examples\/(content|content-.*)\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    {
      name: 'dev-live',
      testMatch: /examples\/template\.dev\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    {
      name: 'reload',
      testMatch: /examples\/template\.reload\.spec\.ts$/,
      // Disable parallel test execution: reload tests start dev servers
      // and run builds that share the Extension.js CLI process.
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    // Content-script hot-reload regression gate. Parameterized over every
    // example with `content_scripts` in its manifest. Each test launches a
    // real `extension dev`, connects Playwright to that Chrome via CDP, and
    // asserts that a source edit propagates to an already-open tab WITHOUT
    // navigation. This is the only suite that exercises the full dev → CDP
    // → open-tab reinject chain end-to-end.
    {
      name: 'content-reload',
      testMatch: /examples\/template\.content-reload\.spec\.ts$/,
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    // Scaffold + install + first build per template
    {
      name: 'create',
      testMatch: /examples\/template\.create\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    // Per-template asset pipeline (shadow DOM, CSS, icons, frameworks, SW)
    {
      name: 'assets',
      testMatch: /examples\/template\.assets\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    // Production build × chrome/edge/firefox with manifest validation
    // Includes Firefox-specific manifest key checks and CSS presence assertions
    {
      name: 'multi-browser',
      testMatch: /examples\/template\.multi-browser\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    // Sidebar Batch - Tests for sidebar panel functionality
    {
      name: 'sidebar',
      testMatch: /examples\/(sidebar|sidebar-.*)\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    // Action Popup Batch - Tests for action/popup pages
    {
      name: 'action',
      testMatch: /examples\/(action|action-.*)\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    // New Tab Batch - Tests for new tab overrides
    {
      name: 'newtab',
      testMatch: /examples\/(new|new-.*)\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    // Special Folders Batch - Tests for special folder structures
    {
      name: 'special-folders',
      testMatch: /examples\/special-folders-.*\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    // Mixed Context Tests - Tests that cover both content and sidebar
    {
      name: 'mixed-context',
      testMatch:
        /examples\/(javascript|preact|react|svelte|typescript|vue)\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    // Other Tests - Tests that don't fit other categories (e.g., init)
    {
      name: 'other',
      testMatch: /examples\/(init)\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        headless: isHeadless
      }
    },

    // Firefox Runtime - Loads built extensions in Firefox via RDP
    {
      name: 'firefox',
      testMatch: /examples\/template\.firefox\.spec\.ts$/,
      use: {
        ...devices['Desktop Firefox'],
        headless: false // Extensions require headed Firefox
      }
    }
  ]

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
})
