import {type Template, type UIContext, type ConfigFiles} from './types'
import fs from 'fs'
import path from 'path'
import {getDirname} from './dirname'

const __dirname = getDirname(import.meta.url)

function fileExists(...segments: string[]): boolean {
  try {
    return fs.existsSync(path.join(...segments))
  } catch {
    return false
  }
}

function detectUIContexts(manifest: any): UIContext[] | undefined {
  const contexts: UIContext[] = []
  if (manifest?.chrome_url_overrides?.newtab) contexts.push('newTab')
  if (
    Array.isArray(manifest?.content_scripts) &&
    manifest.content_scripts.length
  )
    contexts.push('content')
  if (
    manifest?.action ||
    manifest?.browser_action ||
    manifest?.['chromium:action'] ||
    manifest?.['firefox:browser_action']
  )
    contexts.push('action')
  if (manifest?.['chromium:side_panel'] || manifest?.['firefox:sidebar_action'])
    contexts.push('sidebar')
  return contexts.length ? contexts : undefined
}

function detectConfigFiles(exampleDir: string): ConfigFiles[] | undefined {
  const possible: ConfigFiles[] = [
    'postcss.config.js',
    'tailwind.config.js',
    'tsconfig.json',
    '.stylelintrc.json',
    'extension.config.js',
    'babel.config.json',
    '.prettierrc',
    'eslint.config.mjs'
  ]
  const present = possible.filter((f) => fileExists(exampleDir, f))
  return present.length ? present : undefined
}

function isExampleDir(dirName: string): boolean {
  // Consider a directory an example if it contains a src/manifest.json
  return fileExists(__dirname, dirName, 'src', 'manifest.json')
}

function readJSON(filePath: string): any | undefined {
  try {
    const text = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const exampleDirs = fs
  .readdirSync(__dirname)
  .filter((name) => fs.statSync(path.join(__dirname, name)).isDirectory())
  .filter(isExampleDir)

const ALL_TEMPLATES: Template[] = exampleDirs.map((name) => {
  const examplePath = path.join(__dirname, name)
  const manifestPath = path.join(examplePath, 'src', 'manifest.json')
  const manifest = readJSON(manifestPath) ?? {}
  return {
    name,
    uiContext: detectUIContexts(manifest),
    uiFramework: undefined,
    css: 'css',
    hasBackground: !!manifest?.background,
    hasEnv: false,
    configFiles: detectConfigFiles(examplePath)
  }
})

const SUPPORTED_BROWSERS: string[] = ['chrome', 'edge', 'firefox']

export {SUPPORTED_BROWSERS, ALL_TEMPLATES}
