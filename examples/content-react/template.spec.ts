import path from 'path'
import {
  extensionFixtures,
  waitForShadowElement,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('should exist an element with the id extension-root', async ({page}) => {
  await page.goto('https://example.com/')
  const shadowRootHandle = await page
    .locator('#extension-root, [data-extension-root="true"]')
    .evaluateHandle((host: HTMLElement) => host.shadowRoot)

  // Check that the Shadow DOM exists
  test.expect(shadowRootHandle).not.toBeNull()

  // Verify if the Shadow DOM contains children
  const shadowChildrenCount = await shadowRootHandle.evaluate(
    (shadowRoot: ShadowRoot) => shadowRoot.children.length
  )
  test.expect(shadowChildrenCount).toBeGreaterThan(0)
})

test('should exist an h2 element with specified content', async ({page}) => {
  await page.goto('https://example.com/')
  // Wait for content script to inject - waitForShadowElement handles waiting internally
  const h2 = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'h2'
  )
  if (!h2) {
    throw new Error('h2 element not found in Shadow DOM')
  }

  const textContent = await h2.evaluate((node) => node.textContent)
  test.expect(textContent).toContain('This is a content script')
})

test('should render Tailwind-compiled styles (h2 text-white applies)', async ({
  page
}) => {
  await page.goto('https://example.com/')
  const h2 = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'h2'
  )
  if (!h2) {
    throw new Error('h2 element not found in Shadow DOM')
  }

  // The h2 has `text-white` from Tailwind. If Tailwind classes were compiled
  // into the stylesheet, color resolves to white; if the raw CSS with
  // `@import "tailwindcss"` shipped unprocessed, it falls back to black.
  const color = await h2.evaluate((node) =>
    window.getComputedStyle(node as HTMLElement).getPropertyValue('color')
  )
  test.expect(color).toEqual('rgb(255, 255, 255)')
})

test('shadow container renders within the viewport', async ({page}) => {
  await page.goto('https://example.com/')
  // Ensure the shadow-host content is sized/positioned on-screen.
  // Regression guard: when Tailwind isn't compiled, the wrapper collapses
  // to `position:fixed; bottom:640px; right:640px;` with intrinsic content
  // size, producing a ~2880x5013 block off-screen (negative x/y).
  const host = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'div'
  )
  if (!host) {
    throw new Error('content container not found in Shadow DOM')
  }
  const rect = await host.evaluate((node) => {
    const r = (node as HTMLElement).getBoundingClientRect()
    return {x: r.x, y: r.y, w: r.width, h: r.height}
  })
  const vp = page.viewportSize() || {width: 1280, height: 720}
  test
    .expect(
      rect.x + rect.w > 0 && rect.y + rect.h > 0,
      `content container rendered off-screen: ${JSON.stringify(rect)}`
    )
    .toBe(true)
  test
    .expect(
      rect.x < vp.width && rect.y < vp.height,
      `content container rendered past viewport: ${JSON.stringify(rect)} vs viewport ${vp.width}x${vp.height}`
    )
    .toBe(true)
})

test('should load all images successfully', async ({page}) => {
  await page.goto('https://example.com/')
  const shadowRoot = await page
    .locator('#extension-root, [data-extension-root="true"]')
    .evaluateHandle((host: HTMLElement) => host.shadowRoot)

  const imagesHandle = await shadowRoot.evaluateHandle((shadow: ShadowRoot) =>
    Array.from(shadow.querySelectorAll('img'))
  )

  const imageHandles = await imagesHandle.getProperties()
  const results: boolean[] = []

  for (const [, imageHandle] of imageHandles) {
    const naturalWidth = await imageHandle.evaluate(
      (img) => (img as HTMLImageElement).naturalWidth
    )
    const naturalHeight = await imageHandle.evaluate(
      (img) => (img as HTMLImageElement).naturalHeight
    )
    const loadedSuccessfully = naturalWidth > 0 && naturalHeight > 0
    results.push(loadedSuccessfully)
  }

  test.expect(results.every((result) => result)).toBeTruthy()
})

test('injected UI offers the Open options button', async ({page}) => {
  await page.goto('https://example.com/')
  const button = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'button'
  )
  if (!button) {
    throw new Error('button not found in Shadow DOM')
  }

  const shadowRootHandle = await page
    .locator('#extension-root, [data-extension-root="true"]')
    .evaluateHandle((host: HTMLElement) => host.shadowRoot)
  const labels = await shadowRootHandle.evaluate((shadowRoot: ShadowRoot) =>
    Array.from(shadowRoot.querySelectorAll('button')).map(
      (node) => node.textContent || ''
    )
  )
  test
    .expect(labels.some((label) => label.includes('Open options')))
    .toBe(true)

  // The docs recorder finds page controls by accessible name, so the label
  // is part of the contract and not only a courtesy to screen readers.
  const accessibleNames = await shadowRootHandle.evaluate(
    (shadowRoot: ShadowRoot) =>
      Array.from(shadowRoot.querySelectorAll('button')).map((node) =>
        node.getAttribute('aria-label')
      )
  )
  test.expect(accessibleNames).toContain('Open options')
})

test('options page renders', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const h1 = page.locator('h1').first()
  await test.expect(h1).toBeVisible({timeout: 60000})
  const textContent = await h1.textContent()
  test.expect(textContent).toContain('React Content Options')
})

test('options page shows the setting checkbox', async ({page, extensionId}) => {
  await page.goto(`chrome-extension://${extensionId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  const checkbox = page.locator('#show-badge')
  await test.expect(checkbox).toBeVisible({timeout: 60000})
  await test.expect(checkbox).toHaveAttribute('type', 'checkbox')
  const statusLine = page.locator('#status')
  await test.expect(statusLine).toContainText('chrome.storage.sync', {
    timeout: 60000
  })
})
