import http from 'node:http'
import type {AddressInfo} from 'node:net'
import {
  extensionFixtures,
  getSidebarPath,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

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

test('content script renders visible UI', async ({page, extensionId}) => {
  await page.goto('https://example.com/')
  const host = await getContentHost(page)
  const heading = await queryInShadow(page, host, 'h1, h2')
  test.expect(heading).not.toBeNull()
})

test('sidebar renders a visible heading', async ({page, extensionId}) => {
  await page.goto(getSidebarPath(extensionId))
  const heading = page.locator('h1, h2').first()
  await heading.waitFor({state: 'visible', timeout: 15000})
  await test.expect(heading).toBeVisible()
})

let server: http.Server
let origin = ''

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    const name = request.url === '/second' ? 'Second page' : 'First page'
    response.setHeader('content-type', 'text/html')
    response.end(`<!doctype html><title>${name}</title><h1>${name}</h1>`)
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

test('sidebar shows the title of the page it is opened on and follows navigation', async ({
  context,
  page,
  extensionId
}) => {
  await page.goto(`${origin}/first`)
  await getContentHost(page)
  const panel = await context.newPage()
  await panel.goto(getSidebarPath(extensionId))
  const pageTitle = panel.locator('.sidebar_page_title')
  await test.expect(pageTitle).toHaveText('First page', {timeout: 15000})
  await page.goto(`${origin}/second`)
  await getContentHost(page)
  await test.expect(pageTitle).toHaveText('Second page', {timeout: 15000})
})
