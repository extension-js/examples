import path from 'path'
import {execSync} from 'child_process'
import {extensionFixtures} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const pathToExtension = path.join(__dirname, `dist/chrome`)
const test = extensionFixtures(pathToExtension, true)

test.beforeAll(async () => {
  execSync(`node ../../ci-scripts/build-with-manifest.mjs build`, {
    cwd: __dirname,
    stdio: 'inherit'
  })
})

test('mounts content script Shadow DOM', async ({page}) => {
  await page.goto('https://extension.js.org/')
  const shadowRootHandle = await page
    .locator('#extension-root')
    .evaluateHandle((host: HTMLElement) => host.shadowRoot)
  test.expect(shadowRootHandle).not.toBeNull()
})
