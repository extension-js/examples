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

test('should exist a default color value', async ({page}) => {
  await page.goto('https://example.com/')
  const h2 = await waitForShadowElement(
    page,
    '#extension-root, [data-extension-root="true"]',
    'h2'
  )
  if (!h2) {
    throw new Error('h2 element not found in Shadow DOM')
  }

  const color = await h2.evaluate((node) =>
    window.getComputedStyle(node as HTMLElement).getPropertyValue('color')
  )
  test.expect(color).toEqual('rgb(255, 255, 255)')
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
