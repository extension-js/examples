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
const extensionPackageDir = path.join(__dirname, 'packages', 'extension')
// Ensure build exists; if not, build using the repo's ci-scripts from example root
const buildScript = path.join(
  __dirname,
  '..',
  '..',
  'ci-scripts',
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
const test = extensionFixtures(pathToExtension)

test('monorepo content script renders visible UI', async ({
  page,
  extensionId
}) => {
  await page.goto('https://example.com/')
  const el = await waitForShadowElement(
    page,
    '[data-extension-root="true"]',
    '.monorepo_badge, h1, h2'
  )
  test.expect(el).not.toBeNull()
})

test('monorepo sidebar renders visible heading', async ({
  page,
  extensionId
}) => {
  await page.goto(getSidebarPath(extensionId))
  const heading = page.locator('h1, h2').first()
  await heading.waitFor({state: 'visible', timeout: 15000})
  await test.expect(heading).toBeVisible()
})
