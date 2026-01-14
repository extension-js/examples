import {type Template, type UIContext, type ConfigFiles} from './types.js'
import fs from 'fs'
import path from 'path'
import {getDirname} from './dirname.js'

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

function detectUIFramework(exampleDir: string): string | undefined {
  const pkgPath = path.join(exampleDir, 'package.json')
  const pkg = readJSON(pkgPath) ?? {}
  const deps = {...(pkg.dependencies || {}), ...(pkg.devDependencies || {})}
  if (deps.react) return 'react'
  if (deps.preact) return 'preact'
  if (deps.vue) return 'vue'
  if (deps.svelte) return 'svelte'
  return undefined
}

function detectCssTech(exampleName: string, exampleDir: string): string {
  // Name-based heuristics first
  if (exampleName.includes('sass-modules')) return 'sass-modules'
  if (exampleName.includes('less-modules')) return 'less-modules'
  if (exampleName.includes('css-modules')) return 'css-modules'
  if (exampleName.includes('sass')) return 'sass'
  if (exampleName.includes('less')) return 'less'
  // Fallback to deps
  const pkgPath = path.join(exampleDir, 'package.json')
  const pkg = readJSON(pkgPath) ?? {}
  const deps = {...(pkg.dependencies || {}), ...(pkg.devDependencies || {})}
  if (deps.sass) return 'sass'
  if (deps.less) return 'less'
  return 'css'
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

function detectHasEnv(exampleDir: string): boolean {
  const envFiles = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    'extension-env.d.ts'
  ]
  return envFiles.some((f) => fileExists(exampleDir, f))
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
    uiFramework: detectUIFramework(examplePath),
    css: detectCssTech(name, examplePath),
    hasBackground: !!manifest?.background,
    hasEnv: detectHasEnv(examplePath),
    configFiles: detectConfigFiles(examplePath)
  }
})

const SUPPORTED_BROWSERS: string[] = ['chrome', 'edge', 'firefox']

export {SUPPORTED_BROWSERS, ALL_TEMPLATES}
