import path from 'path'
import fs from 'fs'
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from '../extension-fixtures.js'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const pathToExtension = resolveBuiltExtensionPath(__dirname)
const test = extensionFixtures(pathToExtension)

test('build outputs a manifest with javascript icons', async () => {
  const manifestPath = path.join(pathToExtension, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Manifest not found at ${manifestPath}. Extension may not be built.`
    )
  }
  const json = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  test
    .expect(['icon.png', 'public/icon.png', 'icons/javascript.png'])
    .toContain(json?.icons?.['16'])
})
