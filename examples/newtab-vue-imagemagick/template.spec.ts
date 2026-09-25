import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

const newTabUrl = (extensionId: string) =>
  `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`

const canvasFingerprint = (page: {
  locator(selector: string): {
    evaluate(fn: (canvas: HTMLCanvasElement) => string): Promise<string>
  }
}) =>
  page.locator('canvas').evaluate((canvas) => {
    const context = canvas.getContext('2d', {willReadFrequently: true})
    if (!context) return ''

    const {data} = context.getImageData(0, 0, canvas.width, canvas.height)
    let hash = 2166136261

    for (let i = 0; i < data.length; i += 16) {
      hash ^= data[i]
      hash = Math.imul(hash, 16777619)
    }

    return `${canvas.width}x${canvas.height}:${hash >>> 0}`
  })

test('should exist an element with the ImageMagick title text', async ({
  page,
  extensionId
}) => {
  await page.goto(newTabUrl(extensionId), {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })

  const h1 = await page.waitForSelector('h1', {
    state: 'visible',
    timeout: 60000
  })
  const textContent = await h1.textContent()
  test.expect(textContent).toMatch(/ImageMagick WebAssembly/i)
})

test('should exist a default color value', async ({page, extensionId}) => {
  await page.goto(newTabUrl(extensionId), {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })

  await page.waitForSelector('h1', {state: 'visible', timeout: 60000})
  const h1 = page.locator('h1')
  const color = await page.evaluate(
    (locator) => {
      return window.getComputedStyle(locator!).getPropertyValue('color')
    },
    await h1.elementHandle()
  )
  test.expect(color).toEqual('rgb(201, 201, 201)')
})

test('should edit the bundled sample without leaving the extension', async ({
  page,
  extensionId
}) => {
  const remote: string[] = []
  page.on('request', (request) => {
    const url = request.url()

    if (url.startsWith('http://') || url.startsWith('https://'))
      {remote.push(url)}
  })

  await page.goto(newTabUrl(extensionId), {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })

  await page.waitForSelector('h1', {state: 'visible', timeout: 60000})

  await page.getByRole('link', {name: 'Magick', exact: true}).click()
  await test.expect(
    page.getByRole('heading', {name: 'Magick', exact: true})
  ).toBeVisible()

  await page.getByRole('link', {name: 'MagickImage'}).click()
  await test.expect(
    page.getByRole('heading', {name: 'MagickImage'})
  ).toBeVisible()

  for (const tool of ['blur', 'charcoal', 'rotate']) {
    await page.getByRole('link', {name: tool, exact: true}).click()
    await test.expect(
      page.getByRole('button', {name: 'Show example'})
    ).toBeVisible()
  }

  await page.getByRole('button', {name: 'Load logo'}).click()
  const canvas = page.locator('canvas')
  await test.expect(canvas).toBeVisible()
  const before = await canvasFingerprint(page)
  test.expect(before).not.toEqual('')

  await page.getByRole('button', {name: 'Show example'}).click()
  await test.expect
    .poll(async () => canvasFingerprint(page), {timeout: 15000})
    .not.toBe(before)

  await page.getByRole('link', {name: 'Home'}).click()
  await test.expect(page.getByRole('img', {name: 'ImageMagick logo'})).toBeVisible()
  test.expect(remote).toEqual([])
})
