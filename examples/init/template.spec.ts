import path from 'path'
import {execSync} from 'child_process'
import fs from 'fs'
import {extensionFixtures} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/init'
const pathToExtension = path.join(__dirname, `dist/chrome`)
const test = extensionFixtures(pathToExtension, true)

test.beforeAll(async () => {
  execSync(`node ../../ci-scripts/build-with-manifest.mjs build`, {
    cwd: __dirname,
    stdio: 'inherit'
  })
})

test('build outputs a manifest with javascript icons', async () => {
  const manifestPath = path.join(pathToExtension, 'manifest.json')
  const json = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  test.expect(json?.icons?.['16']).toBe('images/javascript.png')
})
