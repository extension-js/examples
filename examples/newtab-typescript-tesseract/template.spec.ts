import path from 'node:path'
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)
const sampleImage = path.join(__dirname, 'fixtures', 'hello.png')

const newTabUrl = (extensionId: string) =>
  `chrome-extension://${extensionId}/chrome_url_overrides/newtab.html`

test('should render the OCR header', async ({page, extensionId}) => {
  await page.goto(newTabUrl(extensionId), {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })

  const h1 = await page.waitForSelector('h1', {
    state: 'visible',
    timeout: 60000
  })
  const textContent = await h1.textContent()
  test.expect(textContent).toMatch(/Tesseract OCR Extension/i)
})

test('should show idle status by default', async ({page, extensionId}) => {
  await page.goto(newTabUrl(extensionId), {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })

  const status = await page.waitForSelector('#statusText', {
    state: 'visible',
    timeout: 60000
  })
  const textContent = await status.textContent()
  test.expect(textContent).toMatch(/Idle/i)
})

test('should read text from an image with the bundled model', async ({
  page,
  extensionId
}) => {
  test.setTimeout(120000)
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

  await page.waitForSelector('#statusText', {
    state: 'visible',
    timeout: 60000
  })

  test.expect(remote).toEqual([])

  await page.setInputFiles('#fileInput', sampleImage)
  await page.click('#runButton')

  await test.expect(page.locator('#ocrOutput')).toContainText(/hello\s+ocr/i, {
    timeout: 60000
  })

  await test.expect(page.locator('#statusText')).toHaveText('Complete')
  test.expect(remote).toEqual([])
})
