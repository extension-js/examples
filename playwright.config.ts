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

  // Retries for reliability - increased for CI to handle transient failures
  retries: process.env.CI ? 2 : 2,

  // Balance between speed and stability - reduced workers for CI to prevent resource contention
  // Using 2 workers in CI to avoid OOM issues with headed browsers
  workers: process.env.CI ? 2 : 2,

  // Enhanced reporting for better debugging
  reporter: [
    ['html', {outputFolder: 'e2e-report'}],
    ['list'],
    ['json', {outputFile: 'test-results.json'}]
  ],

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
    }
  ]

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
})
