import {test as base, chromium, type BrowserContext} from '@playwright/test'
import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

export const extensionPath = path.join(projectRoot, 'dist', 'chrome')

// Extensions load in the full Chromium build, not the headless shell, so the
// run stays headless by default. Set HEADED=true to watch it.
const headless = process.env.HEADED !== 'true'

export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({}, use) => {
    const userDataDir = mkdtempSync(path.join(tmpdir(), 'extension-e2e-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check'
      ]
    })

    try {
      await use(context)
    } finally {
      await context.close()
      rmSync(userDataDir, {recursive: true, force: true})
    }
  },
  extensionId: async ({context}, use) => {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'))

    await use(worker.url().split('/')[2])
  }
})

export const expect = test.expect

export function pagePath(extensionId: string, page: string): string {
  return `chrome-extension://${extensionId}/${page}`
}
