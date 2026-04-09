import path from 'path'
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('mounts content script Shadow DOM', async ({page}) => {
  await page.goto('https://example.com/')
  const shadowRootHandle = await page
    .locator('#extension-root, [data-extension-root="true"]')
    .evaluateHandle((host: HTMLElement) => host.shadowRoot)
  test.expect(shadowRootHandle).not.toBeNull()
})

test('CSS module class names produce matching computed styles', async ({
  page
}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  const host = page.locator('#extension-root, [data-extension-root="true"]')
  await test.expect(host.first()).toBeAttached({timeout: 15000})

  // Poll until styles are applied — CSS modules inject asynchronously
  await test.expect
    .poll(
      async () => {
        return host.first().evaluate((el: HTMLElement) => {
          const sr = el.shadowRoot
          if (!sr) return null
          const div = sr.querySelector('div')
          if (!div) return null
          const cs = window.getComputedStyle(div)
          return cs.position !== 'static' ? true : null
        })
      },
      {
        timeout: 15000,
        message: 'CSS module styles never applied to shadow DOM container'
      }
    )
    .toBeTruthy()

  // content-sass-modules uses dark theme: bg #0a0c10, color #c9c9c9
  const result = await host.first().evaluate((el: HTMLElement) => {
    const sr = el.shadowRoot!
    const div = sr.querySelector('div')!
    const cs = window.getComputedStyle(div)
    return {
      position: cs.position,
      backgroundColor: cs.backgroundColor,
      color: cs.color
    }
  })
  test
    .expect(result.position, 'container should be position:fixed')
    .toBe('fixed')
  test
    .expect(
      result.backgroundColor,
      'container should have dark background (#0a0c10)'
    )
    .toBe('rgb(10, 12, 16)')
  test
    .expect(result.color, 'text should be light (#c9c9c9)')
    .toBe('rgb(201, 201, 201)')
})

test('h1 title has correct font-weight from CSS module', async ({page}) => {
  await page.goto('https://example.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  const host = page.locator('#extension-root, [data-extension-root="true"]')
  await test.expect(host.first()).toBeAttached({timeout: 15000})

  await test.expect
    .poll(
      async () => {
        return host.first().evaluate((el: HTMLElement) => {
          const h1 = el.shadowRoot?.querySelector('h1')
          if (!h1) return null
          return window.getComputedStyle(h1).fontWeight
        })
      },
      {timeout: 10000, message: 'h1 font-weight never resolved'}
    )
    .toBeTruthy()

  const fw = await host.first().evaluate((el: HTMLElement) => {
    return window.getComputedStyle(el.shadowRoot!.querySelector('h1')!)
      .fontWeight
  })
  test.expect(fw, 'title should be bold (700)').toBe('700')
})
