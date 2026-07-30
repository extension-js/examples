import {execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {projectRoot, extensionPath} from './fixtures.js'

export default function buildExtension() {
  execFileSync(
    'npx',
    ['--no-install', 'extension', 'build', '--browser', 'chrome'],
    {cwd: projectRoot, stdio: 'inherit'}
  )

  if (!existsSync(extensionPath)) {
    throw new Error(`The build produced no extension at ${extensionPath}.`)
  }
}
