import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/build-extension.ts',
  // Artifacts go under dist/ because dist/ is already ignored by git.
  outputDir: './dist/.playwright',
  timeout: process.env.CI ? 60_000 : 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
})
