import {test, expect, pagePath} from './fixtures.js'

test('the sidebar page renders its title', async ({context, extensionId}) => {
  const page = await context.newPage()
  await page.goto(pagePath(extensionId, 'sidebar/index.html'))

  await expect(page.locator('h1.sidebar_title')).toHaveText('Sidebar Panel')
})

test('the background service worker runs', async ({context, extensionId}) => {
  const [worker] = context.serviceWorkers()

  expect(worker.url()).toContain(extensionId)
})
