import path from 'path'
import fs from 'fs'
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures'
import {getDirname} from '../dirname'

const __dirname = getDirname(import.meta.url)
const exampleDir = 'examples/init'
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('build outputs a manifest with javascript icons', async () => {
  const manifestPath = path.join(pathToExtension, 'manifest.json')
  const json = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  test.expect(json?.icons?.['16']).toBe('images/javascript.png')
})
