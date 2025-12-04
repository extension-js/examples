#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const CWD = process.cwd()
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname)
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')
const EXTENSION_BIN =
  process.platform === 'win32'
    ? path.join(REPO_ROOT, 'node_modules', '.bin', 'extension.cmd')
    : path.join(REPO_ROOT, 'node_modules', '.bin', 'extension')
let EXT_VERSION = 'latest'

try {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')
  )
  EXT_VERSION = packageJson?.devDependencies?.extension || EXT_VERSION
} catch {
  // Do nothing
}

function run(command, args, opts = {}) {
  const spawnResult = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...opts
  })

  if (spawnResult.error) {
    throw spawnResult.error
  }

  if (spawnResult.status !== 0) {
    process.exit(spawnResult.status)
  }
}

function prefixSrc(pathString) {
  if (typeof pathString !== 'string') {
    return pathString
  }

  if (
    pathString.startsWith('src/') ||
    pathString.startsWith('/') ||
    /^https?:\/\//.test(pathString)
  ) {
    return pathString
  }

  return `src/${pathString}`
}

function transformManifestPaths(sourceManifest) {
  const transformedManifest = {...sourceManifest}

  if (
    transformedManifest.icons &&
    typeof transformedManifest.icons === 'object'
  ) {
    const transformedIcons = {}

    for (const [iconKey, iconValue] of Object.entries(
      transformedManifest.icons
    )) {
      transformedIcons[iconKey] = prefixSrc(String(iconValue))
    }
    transformedManifest.icons = transformedIcons
  }

  if (transformedManifest.action && transformedManifest.action.default_popup) {
    transformedManifest.action.default_popup = prefixSrc(
      transformedManifest.action.default_popup
    )
  }

  if (
    transformedManifest.action &&
    transformedManifest.action.default_icon &&
    typeof transformedManifest.action.default_icon === 'object'
  ) {
    const transformedActionIcons = {}

    for (const [iconKey, iconValue] of Object.entries(
      transformedManifest.action.default_icon
    )) {
      transformedActionIcons[iconKey] = prefixSrc(String(iconValue))
    }
    transformedManifest.action.default_icon = transformedActionIcons
  }

  if (
    transformedManifest.page_action &&
    transformedManifest.page_action.default_popup
  ) {
    transformedManifest.page_action.default_popup = prefixSrc(
      transformedManifest.page_action.default_popup
    )
  }

  if (
    transformedManifest.page_action &&
    transformedManifest.page_action.default_icon &&
    typeof transformedManifest.page_action.default_icon === 'object'
  ) {
    const transformedPageActionIcons = {}

    for (const [iconKey, iconValue] of Object.entries(
      transformedManifest.page_action.default_icon
    )) {
      transformedPageActionIcons[iconKey] = prefixSrc(String(iconValue))
    }
    transformedManifest.page_action.default_icon = transformedPageActionIcons
  }

  if (
    transformedManifest.browser_action &&
    transformedManifest.browser_action.default_popup
  ) {
    transformedManifest.browser_action.default_popup = prefixSrc(
      transformedManifest.browser_action.default_popup
    )
  }

  if (
    transformedManifest.browser_action &&
    transformedManifest.browser_action.default_icon &&
    typeof transformedManifest.browser_action.default_icon === 'object'
  ) {
    const transformedBrowserActionIcons = {}

    for (const [iconKey, iconValue] of Object.entries(
      transformedManifest.browser_action.default_icon
    )) {
      transformedBrowserActionIcons[iconKey] = prefixSrc(String(iconValue))
    }

    transformedManifest.browser_action.default_icon =
      transformedBrowserActionIcons
  }

  if (transformedManifest.options_ui && transformedManifest.options_ui.page) {
    transformedManifest.options_ui.page = prefixSrc(
      transformedManifest.options_ui.page
    )
  }

  if (transformedManifest.devtools_page) {
    transformedManifest.devtools_page = prefixSrc(
      transformedManifest.devtools_page
    )
  }

  if (
    transformedManifest.background &&
    transformedManifest.background.service_worker
  ) {
    transformedManifest.background.service_worker = prefixSrc(
      transformedManifest.background.service_worker
    )
  }

  // vendor-prefixed fields
  if (
    transformedManifest['chromium:action'] &&
    transformedManifest['chromium:action'].default_popup
  ) {
    transformedManifest['chromium:action'].default_popup = prefixSrc(
      transformedManifest['chromium:action'].default_popup
    )
  }

  if (
    transformedManifest['chromium:action'] &&
    transformedManifest['chromium:action'].default_icon &&
    typeof transformedManifest['chromium:action'].default_icon === 'object'
  ) {
    const transformedChromiumActionIcons = {}

    for (const [iconKey, iconValue] of Object.entries(
      transformedManifest['chromium:action'].default_icon
    )) {
      transformedChromiumActionIcons[iconKey] = prefixSrc(String(iconValue))
    }
    transformedManifest['chromium:action'].default_icon =
      transformedChromiumActionIcons
  }

  if (
    transformedManifest['firefox:browser_action'] &&
    transformedManifest['firefox:browser_action'].default_popup
  ) {
    transformedManifest['firefox:browser_action'].default_popup = prefixSrc(
      transformedManifest['firefox:browser_action'].default_popup
    )
  }

  if (
    transformedManifest['firefox:browser_action'] &&
    transformedManifest['firefox:browser_action'].default_icon &&
    typeof transformedManifest['firefox:browser_action'].default_icon ===
      'object'
  ) {
    const transformedFirefoxBrowserActionIcons = {}

    for (const [iconKey, iconValue] of Object.entries(
      transformedManifest['firefox:browser_action'].default_icon
    )) {
      transformedFirefoxBrowserActionIcons[iconKey] = prefixSrc(
        String(iconValue)
      )
    }
    transformedManifest['firefox:browser_action'].default_icon =
      transformedFirefoxBrowserActionIcons
  }

  if (
    transformedManifest['chromium:side_panel'] &&
    transformedManifest['chromium:side_panel'].default_path
  ) {
    transformedManifest['chromium:side_panel'].default_path = prefixSrc(
      transformedManifest['chromium:side_panel'].default_path
    )
  }

  if (
    transformedManifest['firefox:sidebar_action'] &&
    transformedManifest['firefox:sidebar_action'].default_panel
  ) {
    transformedManifest['firefox:sidebar_action'].default_panel = prefixSrc(
      transformedManifest['firefox:sidebar_action'].default_panel
    )
  }

  if (
    transformedManifest.background &&
    transformedManifest.background['chromium:service_worker']
  ) {
    transformedManifest.background['chromium:service_worker'] = prefixSrc(
      transformedManifest.background['chromium:service_worker']
    )
  }

  if (
    transformedManifest.background &&
    Array.isArray(transformedManifest.background['firefox:scripts'])
  ) {
    transformedManifest.background['firefox:scripts'] =
      transformedManifest.background['firefox:scripts'].map(prefixSrc)
  }

  if (Array.isArray(transformedManifest.content_scripts)) {
    transformedManifest.content_scripts =
      transformedManifest.content_scripts.map((contentScript) => ({
        ...contentScript,
        js: Array.isArray(contentScript.js)
          ? contentScript.js.map(prefixSrc)
          : contentScript.js,
        css: Array.isArray(contentScript.css)
          ? contentScript.css.map(prefixSrc)
          : contentScript.css
      }))
  }

  if (Array.isArray(transformedManifest.web_accessible_resources)) {
    transformedManifest.web_accessible_resources =
      transformedManifest.web_accessible_resources.map(
        (webAccessibleResource) => ({
          ...webAccessibleResource,
          resources: Array.isArray(webAccessibleResource.resources)
            ? webAccessibleResource.resources.map(prefixSrc)
            : webAccessibleResource.resources
        })
      )
  }

  if (
    transformedManifest.chrome_url_overrides &&
    typeof transformedManifest.chrome_url_overrides === 'object'
  ) {
    for (const overrideKey of ['newtab', 'history', 'bookmarks']) {
      if (transformedManifest.chrome_url_overrides[overrideKey]) {
        transformedManifest.chrome_url_overrides[overrideKey] = prefixSrc(
          transformedManifest.chrome_url_overrides[overrideKey]
        )
      }
    }
  }

  if (
    transformedManifest.side_panel &&
    transformedManifest.side_panel.default_path
  ) {
    transformedManifest.side_panel.default_path = prefixSrc(
      transformedManifest.side_panel.default_path
    )
  }

  // sandbox pages
  if (
    transformedManifest.sandbox &&
    Array.isArray(transformedManifest.sandbox.pages)
  ) {
    transformedManifest.sandbox.pages =
      transformedManifest.sandbox.pages.map(prefixSrc)
  }

  if (
    transformedManifest.sandbox &&
    typeof transformedManifest.sandbox.page === 'string'
  ) {
    transformedManifest.sandbox.page = prefixSrc(
      transformedManifest.sandbox.page
    )
  }

  return transformedManifest
}

function copyRecursive(sourcePath, destinationPath) {
  const sourceStat = fs.statSync(sourcePath)

  if (sourceStat.isDirectory()) {
    fs.mkdirSync(destinationPath, {recursive: true})

    for (const directoryItem of fs.readdirSync(sourcePath)) {
      copyRecursive(
        path.join(sourcePath, directoryItem),
        path.join(destinationPath, directoryItem)
      )
    }
  } else {
    fs.copyFileSync(sourcePath, destinationPath)
  }
}

function removeRecursive(directory) {
  if (!fs.existsSync(directory)) {
    return
  }
  const directoryStat = fs.statSync(directory)

  if (directoryStat.isDirectory()) {
    for (const directoryItem of fs.readdirSync(directory)) {
      removeRecursive(path.join(directory, directoryItem))
    }
    fs.rmdirSync(directory)
  } else {
    fs.unlinkSync(directory)
  }
}

function findMonorepoManifest(rootDir) {
  // Check for monorepo structure: packages/*/src/manifest.json
  const packagesDir = path.join(rootDir, 'packages')
  if (!fs.existsSync(packagesDir)) {
    return null
  }

  try {
    const packageEntries = fs.readdirSync(packagesDir, {withFileTypes: true})
    for (const packageEntry of packageEntries) {
      if (packageEntry.isDirectory()) {
        const packageManifestPath = path.join(
          packagesDir,
          packageEntry.name,
          'src',
          'manifest.json'
        )
        if (fs.existsSync(packageManifestPath)) {
          return {
            manifestPath: packageManifestPath,
            packageDir: path.join(packagesDir, packageEntry.name)
          }
        }
      }
    }
  } catch {
    // Do nothing
  }

  return null
}

function main() {
  const mode = process.argv[2] || 'build' // build | dev | preview
  const extraArgs = process.argv.slice(3)

  // Verify CWD is valid and exists
  if (!fs.existsSync(CWD)) {
    console.error(`►►► Error: Working directory does not exist: ${CWD}`)
    process.exit(1)
  }

  // Check for monorepo structure first
  const monorepoManifest = findMonorepoManifest(CWD)
  let actualCwd = CWD
  let srcManifest = null
  let srcDir = null

  if (monorepoManifest) {
    // Use the package directory as the working directory for monorepo examples
    actualCwd = monorepoManifest.packageDir
    srcManifest = monorepoManifest.manifestPath
    srcDir = path.dirname(srcManifest)
  } else {
    // Standard structure: check for src/manifest.json or root manifest.json
    srcDir = path.join(CWD, 'src')
    srcManifest = path.join(srcDir, 'manifest.json')
  }

  // Verify we're in an example directory (has package.json or src/manifest.json)
  const packageJsonPath = path.join(actualCwd, 'package.json')
  const rootManifest = path.join(actualCwd, 'manifest.json')

  if (
    !fs.existsSync(packageJsonPath) &&
    !fs.existsSync(srcManifest) &&
    !fs.existsSync(rootManifest)
  ) {
    console.error(
      `►►► Error: Not a valid example directory (missing package.json, src/manifest.json, or manifest.json): ${CWD}`
    )
    process.exit(1)
  }

  const srcLocales = srcDir ? path.join(srcDir, '_locales') : null
  const rootLocales = path.join(actualCwd, '_locales')
  let wroteTempManifest = false
  let copiedLocales = false

  try {
    if (srcManifest && fs.existsSync(srcManifest)) {
      const sourceManifest = JSON.parse(fs.readFileSync(srcManifest, 'utf-8'))
      const patchedManifest = transformManifestPaths(sourceManifest)
      fs.writeFileSync(
        rootManifest,
        JSON.stringify(patchedManifest, null, 2) + '\n'
      )
      wroteTempManifest = true
    }

    // Copy _locales directory from src/ to root if it exists (required for i18n)
    if (srcLocales && fs.existsSync(srcLocales)) {
      copyRecursive(srcLocales, rootLocales)
      copiedLocales = true
    }

    // Ensure manifest.json exists before running extension CLI
    // Verify it's the correct manifest (not from another build)
    if (!fs.existsSync(rootManifest)) {
      console.error(`►►► Error: manifest.json not found at ${rootManifest}`)
      process.exit(1)
    }

    // Verify the manifest is valid JSON and belongs to this example
    try {
      const manifestContent = JSON.parse(fs.readFileSync(rootManifest, 'utf-8'))
      // Basic validation - ensure it's a valid manifest
      if (!manifestContent.manifest_version && !manifestContent.version) {
        console.error(`►►► Error: Invalid manifest.json at ${rootManifest}`)
        process.exit(1)
      }
    } catch (error) {
      console.error(
        `►►► Error: Failed to parse manifest.json at ${rootManifest}:`,
        error.message
      )
      process.exit(1)
    }

    // Use absolute path for actualCwd to avoid path resolution issues
    const absoluteCwd = path.resolve(actualCwd)

    // Verify we're still in the correct directory
    const verifyManifest = path.join(absoluteCwd, 'manifest.json')
    if (!fs.existsSync(verifyManifest)) {
      console.error(
        `►►► Error: manifest.json disappeared or path changed. Expected: ${verifyManifest}, CWD: ${absoluteCwd}`
      )
      process.exit(1)
    }

    // Try to use locally installed extension CLI first, fallback to npx
    // Clear any potential module cache by using a fresh process
    if (fs.existsSync(EXTENSION_BIN)) {
      run(EXTENSION_BIN, [mode, ...extraArgs], {
        cwd: absoluteCwd,
        env: {
          ...process.env,
          EXTENSION_SKIP_INSTALL: '1',
          // Ensure PWD is set correctly for path resolution
          PWD: absoluteCwd,
          // Clear any potential cache
          NODE_OPTIONS: (process.env.NODE_OPTIONS || '') + ' --no-warnings'
        }
      })
    } else {
      // Fallback to npx using the pinned version from package.json
      run('npx', ['-y', `extension@${EXT_VERSION}`, mode, ...extraArgs], {
        cwd: absoluteCwd,
        env: {
          ...process.env,
          EXTENSION_SKIP_INSTALL: '1',
          // Ensure PWD is set correctly for path resolution
          PWD: absoluteCwd,
          // Clear any potential cache
          NODE_OPTIONS: (process.env.NODE_OPTIONS || '') + ' --no-warnings'
        }
      })
    }
  } finally {
    if (wroteTempManifest && fs.existsSync(rootManifest)) {
      try {
        fs.unlinkSync(rootManifest)
      } catch {
        // Do nothing
      }
    }

    if (copiedLocales && fs.existsSync(rootLocales)) {
      try {
        removeRecursive(rootLocales)
      } catch {
        // Do nothing
      }
    }
  }
}

main()
