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

test('should render the Zstandard header', async ({page, extensionId}) => {
  await page.goto(newTabUrl(extensionId), {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })

  const h1 = await page.waitForSelector('h1', {
    state: 'visible',
    timeout: 60000
  })
  const textContent = await h1.textContent()
  test.expect(textContent).toMatch(/Zstandard Compression/i)
})

test('should compress and decompress text with the bundled runtime', async ({
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

  await page.waitForFunction(
    () => document.querySelector('#statusText')?.textContent === 'Ready',
    undefined,
    {timeout: 60000}
  )

  test.expect(remote).toEqual([])

  await page.fill('#inputText', 'Hello zstd!!')
  await page.click('#compressButton')

  const output = page.locator('#outputText')
  await test.expect(output).not.toHaveValue('')
  const encoded = await output.inputValue()
  test.expect(encoded).toMatch(/^[A-Za-z0-9+/]+=*$/)
  await test.expect(page.locator('#statusText')).toHaveText('Compressed')
  await test.expect(page.locator('#inputBytes')).not.toHaveText('0')
  await test.expect(page.locator('#outputBytes')).not.toHaveText('0')

  await page.fill('#inputText', '')
  await page.click('#decompressButton')

  await test.expect(page.locator('#inputText')).toHaveValue('Hello zstd!!')
  await test.expect(page.locator('#statusText')).toHaveText('Decompressed')
  test.expect(remote).toEqual([])
})
