#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const javascriptExample = path.join(repoRoot, 'examples', 'javascript')
const secondRunHint = 'Run the command again to proceed'
const postCssResolutionError =
  '[PostCSS] postcss-loader could not be resolved after optional dependency installation.'
const attempts = Number(process.env.EXTENSION_POSTCSS_REPRO_ATTEMPTS || '5')
const PNPM_VERSION = '10.4.1'

function commandFor(tool) {
  if (process.platform !== 'win32') return tool
  if (tool === 'corepack') return 'corepack.cmd'
  if (tool === 'npm') return 'npm.cmd'
  return tool
}

function run(command, args, cwd, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(commandFor(command), args, {
      cwd,
      shell: process.platform === 'win32',
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {...process.env, ...env}
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => {
      const text = d.toString()
      stdout += text
      process.stdout.write(d)
    })
    child.stderr?.on('data', (d) => {
      const text = d.toString()
      stderr += text
      process.stderr.write(d)
    })
    child.on('close', (code) => resolve({code: code ?? 1, stdout, stderr}))
    child.on('error', (error) =>
      resolve({code: 1, stdout, stderr: String(error?.message || error)})
    )
  })
}

function hasManifest(exampleDir) {
  const roots = ['dist', 'build', '.extension']
  const channels = ['chrome', 'chromium', 'chrome-mv3']
  for (const root of roots) {
    for (const channel of channels) {
      const manifestPath = path.join(exampleDir, root, channel, 'manifest.json')
      if (fs.existsSync(manifestPath)) return true
    }
  }
  return false
}

function prepTempProject() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'extjs-js-postcss-'))
  const targetDir = path.join(tempRoot, 'javascript')
  fs.cpSync(javascriptExample, targetDir, {recursive: true})
  fs.rmSync(path.join(targetDir, 'node_modules'), {recursive: true, force: true})
  fs.rmSync(path.join(targetDir, 'dist'), {recursive: true, force: true})
  fs.rmSync(path.join(targetDir, 'build'), {recursive: true, force: true})
  fs.rmSync(path.join(targetDir, '.extension'), {recursive: true, force: true})
  fs.writeFileSync(
    path.join(targetDir, 'postcss.config.js'),
    'module.exports = {plugins: {}};\n',
    'utf8'
  )

  const packageJsonPath = path.join(targetDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  pkg.packageManager = `pnpm@${PNPM_VERSION}`
  pkg.scripts = {
    ...(pkg.scripts || {}),
    'remove-key':
      "jq 'del(.key)' src/manifest.json > src/manifest.json.tmp && mv src/manifest.json.tmp src/manifest.json",
    build: 'extension build',
    'build:production': 'pnpm remove-key && extension build'
  }
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  return {tempRoot, targetDir}
}

function getConfiguredExtensionSpec() {
  const packageJsonPath = path.join(repoRoot, 'package.json')
  const rootPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const spec =
    rootPackage?.devDependencies?.extension ||
    rootPackage?.dependencies?.extension

  if (!spec || typeof spec !== 'string') {
    throw new Error(
      'Could not resolve extension version spec from examples package.json'
    )
  }

  return spec.trim()
}

async function runAttempt(index, stableVersion) {
  const {tempRoot, targetDir} = prepTempProject()
  const env = {
    COREPACK_ENABLE_AUTO_PIN: '0',
    CI: 'true',
    XDG_CONFIG_HOME: path.join(tempRoot, '.xdg-config')
  }

  console.log(`\n=== attempt ${index}/${attempts} (stable ${stableVersion}) ===`)

  let result = await run(
    'corepack',
    [`pnpm@${PNPM_VERSION}`, 'add', '-D', `extension@${stableVersion}`],
    targetDir,
    env
  )
  if (result.code !== 0) {
    return {ok: false, reason: 'install failed'}
  }

  result = await run(
    'corepack',
    [`pnpm@${PNPM_VERSION}`, 'install', '--frozen-lockfile'],
    targetDir,
    env
  )
  if (result.code !== 0) {
    return {ok: false, reason: 'frozen install failed'}
  }

  result = await run(
    'corepack',
    [`pnpm@${PNPM_VERSION}`, 'build:production'],
    targetDir,
    env
  )

  const output = `${result.stdout}\n${result.stderr}`
  if (result.code !== 0) return {ok: false, reason: 'build failed'}
  if (output.includes(secondRunHint)) {
    return {ok: false, reason: 'second-run hint detected'}
  }
  if (output.includes(postCssResolutionError)) {
    return {ok: false, reason: 'postcss resolution error detected'}
  }
  if (!hasManifest(targetDir)) {
    return {ok: false, reason: 'manifest missing'}
  }
  return {ok: true}
}

async function main() {
  const extensionSpec = getConfiguredExtensionSpec()
  console.log(`Extension spec under test: ${extensionSpec}`)
  let failures = 0
  for (let i = 1; i <= attempts; i++) {
    const runResult = await runAttempt(i, extensionSpec)
    if (!runResult.ok) {
      failures += 1
      console.error(`✖ attempt ${i} failed: ${runResult.reason}`)
    } else {
      console.log(`✔ attempt ${i} passed`)
    }
  }

  if (failures > 0) {
    console.error(`\n✖ PostCSS stable pnpm repro failed (${failures}/${attempts})`)
    process.exit(1)
  }

  console.log('\n✔ PostCSS stable pnpm repro passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
