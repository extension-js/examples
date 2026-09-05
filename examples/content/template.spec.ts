import {
  extensionFixtures,
  waitForShadowElement,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('should exist an element with the class name content_script', async ({
  page
}) => {
  await page.goto('https://example.com/')
  const div = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script'
  )
  if (!div) {
    throw new Error('div with class content_script not found in Shadow DOM')
  }
  test.expect(div).not.toBeNull()
})

test('should exist an h1 element with specified content', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  // Wait for content script to inject - waitForShadowElement handles waiting internally
  const h1 = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script > h1',
    60000
  )
  if (!h1) {
    throw new Error('h1 element not found in Shadow DOM')
  }
  const textContent = await h1.evaluate((node) => node.textContent)
  test.expect(textContent).toContain('Content Template')
})

test('should exist a default color value', async ({page}) => {
  await page.goto('https://example.com/')
  const h1 = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script > h1'
  )
  if (!h1) {
    throw new Error('h1 element not found in Shadow DOM')
  }
  const color = await h1.evaluate((node) =>
    window.getComputedStyle(node as HTMLElement).getPropertyValue('color')
  )
  test.expect(color).toEqual('rgb(201, 201, 201)')
})

test('content script injects the options button', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const button = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script > button.content_button',
    60000
  )
  if (!button) {
    throw new Error('options button not found in Shadow DOM')
  }
  const label = await button.evaluate((node) => node.getAttribute('aria-label'))
  test.expect(label).toEqual('Open options')
})

test('options page renders', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const h1 = page.locator('h1').first()
  await test.expect(h1).toBeVisible({timeout: 60000})
  const textContent = await h1.textContent()
  test.expect(textContent).toContain('Options')
})

test('options page shows the setting checkbox', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const checkbox = page.locator('#badge-left')
  await test.expect(checkbox).toBeVisible({timeout: 60000})
  await test.expect(checkbox).not.toBeChecked({timeout: 60000})
  const statusLine = page.locator('#status')
  await test.expect(statusLine).toContainText('chrome.storage.sync', {
    timeout: 60000
  })
})

// The options page advertises that the setting moves the injected UI from one
// edge to the other, so this asserts the geometry the user sees and not the
// stored value. An earlier hide/show shipped as a plain `style.display` write
// the CSSOM dropped over the host's own `all: initial !important`: the value
// round-tripped through storage, the badge never budged, and every assertion
// in this file still passed.
test('the setting moves the badge from right to left', async ({
  page,
  context,
  extensionId
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const host = page
    .locator('#extension-root, [data-extension-root="true"]')
    .first()
  await test.expect(host).toBeAttached({timeout: 30000})
  // The UI lives in a shadow root, so reach through the host for the button
  // the page itself never has.
  const injectedUi = host.locator('css=[aria-label="Open options"]')
  await test.expect(injectedUi).toBeVisible({timeout: 30000})

  const middle = (page.viewportSize()?.width ?? 1280) / 2
  // Geometry is the only honest witness here: a style string or a class name
  // can change while the badge stays exactly where it was.
  const badgeCenterX = async () => {
    const box = await injectedUi.boundingBox()
    if (!box) throw new Error('the injected UI paints no box')
    return box.x + box.width / 2
  }
  test.expect(await badgeCenterX()).toBeGreaterThan(middle)

  const optionsPage = await context.newPage()
  await optionsPage.goto(
    `chrome-extension://${extensionId}/options/index.html`,
    {waitUntil: 'domcontentloaded', timeout: 60000}
  )
  const status = optionsPage.locator('#status')
  // The checkbox is filled in from storage after the page loads, so wait for
  // that read before toggling or the load can undo the click.
  await test.expect(status).toContainText('chrome.storage.sync', {
    timeout: 60000
  })
  const checkbox = optionsPage.locator('#badge-left')
  await test.expect(checkbox).not.toBeChecked({timeout: 60000})
  await checkbox.check()
  await test.expect(status).toContainText('Saved', {timeout: 60000})
  await page.bringToFront()

  await test.expect
    .poll(badgeCenterX, {
      timeout: 20000,
      message: 'the badge never reached the left half of the viewport'
    })
    .toBeLessThan(middle)
  await test.expect(injectedUi).toBeVisible({timeout: 20000})

  await optionsPage.bringToFront()
  await checkbox.uncheck()
  await test.expect(status).toContainText('Saved', {timeout: 60000})
  await page.bringToFront()
  await test.expect
    .poll(badgeCenterX, {
      timeout: 20000,
      message: 'the badge never came back to the right half of the viewport'
    })
    .toBeGreaterThan(middle)
  await optionsPage.close()
})

// The greeting comes through a dynamic import(), so the production build has
// to emit that module as a chunk of its own and the content script has to
// fetch it from the extension at runtime. Issue #507 was this path breaking
// in build while dev stayed green, so both halves are pinned against the
// built output here.
const LAZY_GREETING = 'Hello from a lazy-loaded chunk'

function listBuiltScripts(root: string, dir = root): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listBuiltScripts(root, abs))
    else if (entry.name.endsWith('.js')) {
      out.push(path.relative(root, abs).split(path.sep).join('/'))
    }
  }
  return out
}

// MV3 lists objects with a resources array, MV2 lists plain strings. A
// resource pattern is a glob where * matches anything, slashes included.
function isWebAccessible(manifest: any, file: string): boolean {
  const entries: unknown[] = manifest.web_accessible_resources ?? []
  const patterns = entries.flatMap((entry) =>
    typeof entry === 'string' ? [entry] : ((entry as any).resources ?? [])
  )
  return patterns.some((pattern: string) => {
    const source = pattern
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')
    return new RegExp(`^${source}$`).test(file)
  })
}

test('the lazy greeting ships as its own web accessible chunk', async () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(pathToExtension, 'manifest.json'), 'utf8')
  )
  const entries: string[] = (manifest.content_scripts ?? []).flatMap(
    (script: {js?: string[]}) => script.js ?? []
  )
  const carriers = listBuiltScripts(pathToExtension).filter((file) =>
    fs
      .readFileSync(path.join(pathToExtension, file), 'utf8')
      .includes(LAZY_GREETING)
  )
  // Exactly one file carries the greeting and it is not the entry the
  // manifest injects, otherwise the import was inlined and nothing here
  // exercises chunk loading.
  test.expect(carriers).toHaveLength(1)
  test.expect(entries).not.toContain(carriers[0])
  test
    .expect(
      isWebAccessible(manifest, carriers[0]),
      `${carriers[0]} is not covered by web_accessible_resources, so the ` +
        'content script cannot fetch it from a web page'
    )
    .toBe(true)
})

test('the content script runs the module it imports on demand', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const greeting = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div.content_script > p.content_greeting',
    60000
  )
  if (!greeting) {
    throw new Error('greeting paragraph not found in Shadow DOM')
  }
  // The paragraph is in the DOM before the chunk arrives, so poll its text
  // rather than reading it once.
  await test.expect
    .poll(() => greeting.evaluate((node) => node.textContent), {
      timeout: 20000,
      message: 'the lazily imported module never wrote its greeting'
    })
    .toContain(LAZY_GREETING)
})
