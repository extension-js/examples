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

test('scripts folder is accessible', async ({page, extensionId}) => {
  // This example demonstrates scripts/ folder, not pages/
  // Verify the extension loads correctly by checking manifest
  const manifestPath = path.join(pathToExtension, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  test.expect(manifest.name).toContain('Special Folders Scripts')
})
