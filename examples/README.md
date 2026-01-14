## E2E template specs (copy/paste)

These minimal Playwright specs assert that UI is visibly present for each context. They are resilient and framework-agnostic. Place one file per example as `examples/<example-name>/template.spec.ts`. If an example exposes multiple contexts, include multiple tests in the same file.

### New Tab

```ts
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('newtab renders a visible heading', async ({page}) => {
  await page.goto('chrome://newtab/')
  const heading = page.locator('h1, h2').first()
  await heading.waitFor({state: 'visible', timeout: 15000})
  await test.expect(heading).toBeVisible()
})
```

### Content Script

```ts
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

async function getContentHost(page: any) {
  return await page.waitForSelector(
    '#extension-root, [data-extension-root="true"]',
    {
      state: 'attached',
      timeout: 15000
    }
  )
}

async function queryInShadow(page: any, hostLocator: any, selector: string) {
  const shadow = await hostLocator.evaluateHandle(
    (host: HTMLElement) => host.shadowRoot
  )
  return await shadow.evaluateHandle(
    (root: ShadowRoot, sel: string) => root?.querySelector(sel) ?? null,
    selector
  )
}

test('content script renders visible UI', async ({page}) => {
  await page.goto('https://example.com/')
  const host = await getContentHost(page)
  const heading = await queryInShadow(page, host, 'h1, h2')
  test.expect(heading).not.toBeNull()
})
```

### Sidebar

```ts
import {
  extensionFixtures,
  getExtensionId,
  getSidebarPath,
  resolveBuiltExtensionPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('sidebar renders a visible heading', async ({page}) => {
  const extensionId = await getExtensionId(pathToExtension)
  await page.goto(getSidebarPath(extensionId))
  const heading = page.locator('h1, h2').first()
  await heading.waitFor({state: 'visible', timeout: 15000})
  await test.expect(heading).toBeVisible()
})
```

Notes:

- Prefer generic visible checks over brittle text assertions.
- For content scripts, always query inside the Shadow DOM host.
- Tests auto-build/find bundles with `resolveBuiltExtensionPath(__dirname)`.
