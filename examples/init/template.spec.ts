import path from 'path'
import {execSync} from 'child_process'
import fs from 'fs'
import {extensionFixtures, getDirname} from '../extension-fixtures'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/init'
const pathToExtension = path.join(__dirname, `dist/chrome`)
const test = extensionFixtures(pathToExtension, true)

test.beforeAll(async () => {
  execSync(`pnpm extension build ${exampleDir}`, {
    cwd: path.join(__dirname, '..')
  })
})

test('build outputs a manifest with javascript icons', async () => {
  const manifestPath = path.join(pathToExtension, 'manifest.json')
  const json = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  test.expect(json?.icons?.['16']).toBe('images/javascript.png')
})
