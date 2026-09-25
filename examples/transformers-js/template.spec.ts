import {
  extensionFixtures,
  getSidebarPath,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('sidebar page renders', async ({page, extensionId}) => {
  await page.goto(getSidebarPath(extensionId))
  const h1 = await page.locator('h1').first()
  await test.expect(h1).toHaveText('Transformers.js')
  await test
    .expect(page.locator('h2').first())
    .toContainText('Run 🤗 Transformers in a Browser Extension!')
})

// The panel keeps the same input and output block as the Transformers.js
// popup sample, so a reader of either example finds the same demo.
test('sidebar page has the text input and output block', async ({
  page,
  extensionId
}) => {
  await page.goto(getSidebarPath(extensionId))
  await test
    .expect(page.locator('input#text'))
    .toHaveAttribute('placeholder', 'Enter text here')

  await test.expect(page.locator('pre#output')).toBeAttached()
  await test.expect(page.locator('#use-page')).toBeVisible()
  await test.expect(page.locator('#use-selection')).toBeVisible()
})

// A word fragment must not be classified: the model would answer with a
// confident label for "Debu", so the panel waits for a pause and a sentence.
test('typing a fragment shows a pending mark, not a label', async ({
  page,
  extensionId
}) => {
  await page.goto(getSidebarPath(extensionId))
  await page.locator('input#text').pressSequentially('Debu', {delay: 30})
  await test.expect(page.locator('pre#output')).toHaveText('…')

  await page.locator('input#text').fill('')
  await test.expect(page.locator('pre#output')).toHaveText('')
})
