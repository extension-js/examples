import {
  extensionFixtures,
  getSidebarPath,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

// Regression coverage for https://github.com/extension-js/extension.js/issues/445
// Ensures antd / @ant-design/x render without the
// "_interopRequireDefault is not a function" runtime error caused by the
// bundler resolving CJS requires through the ESM exports condition.
test('antd sidebar renders without interop runtime errors', async ({
  page,
  extensionId
}) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto(getSidebarPath(extensionId))

  const root = page.getByTestId('antd-root')
  await test.expect(root).toBeVisible()
  await test
    .expect(page.getByRole('button', {name: 'antd button'}))
    .toBeVisible()
  test.expect(errors.join('\n')).not.toMatch(/_interopRequireDefault/)
  test.expect(errors).toEqual([])
})
