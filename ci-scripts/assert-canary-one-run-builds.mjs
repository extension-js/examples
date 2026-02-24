#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const examplesRoot = path.join(repoRoot, 'examples')
const XDG_CONFIG_HOME =
  process.env.XDG_CONFIG_HOME || path.join(repoRoot, '.xdg-config')

const OUTPUT_ROOTS = ['dist', 'build', '.extension']
const CHANNELS_BY_BROWSER = {
  chrome: ['chrome', 'chromium', 'chrome-mv3']
}

const defaultExamples = [
  'content-sass',
  'content-less',
  'content-svelte',
  'content-vue',
  'react',
  'typescript'
]

function parseExamplesArg() {
  const arg = process.argv.find((v) => v.startsWith('--examples='))
  if (!arg) return defaultExamples
  return arg
    .slice('--examples='.length)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function commandFor(tool) {
  if (process.platform !== 'win32') return tool
  if (tool === 'pnpm') return 'pnpm.cmd'
  return tool
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

function cleanOutputs(exampleDir) {
  for (const root of OUTPUT_ROOTS) {
    const target = path.join(exampleDir, root)
    if (fs.existsSync(target)) fs.rmSync(target, {recursive: true, force: true})
  }
}

function prepTempExample(slug) {
  const src = path.join(examplesRoot, slug)
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `extjs-${slug}-`))
  const exampleDir = path.join(tempRoot, slug)
  fs.cpSync(src, exampleDir, {recursive: true})
  fs.rmSync(path.join(exampleDir, 'node_modules'), {recursive: true, force: true})
  cleanOutputs(exampleDir)
  return {tempRoot, exampleDir}
}

function hasBuiltManifest(exampleDir, browser) {
  const channels = CHANNELS_BY_BROWSER[browser] || [browser]
  for (const root of OUTPUT_ROOTS) {
    for (const channel of channels) {
      const manifestPath = path.join(exampleDir, root, channel, 'manifest.json')
      if (fs.existsSync(manifestPath)) return true
    }
  }
  return false
}

function run(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(commandFor(command), args, {
      cwd,
      shell: process.platform === 'win32',
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        XDG_CONFIG_HOME
      }
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (data) => {
      const text = data.toString()
      stdout += text
      process.stdout.write(data)
    })
    child.stderr?.on('data', (data) => {
      const text = data.toString()
      stderr += text
      process.stderr.write(data)
    })
    child.on('close', (code) => resolve({code: code ?? 1, stdout, stderr}))
    child.on('error', (error) =>
      resolve({code: 1, stdout, stderr: String(error?.message || error)})
    )
  })
}

async function main() {
  fs.mkdirSync(XDG_CONFIG_HOME, {recursive: true})
  const browser = 'chrome'
  const examples = parseExamplesArg()
  const extensionSpec = getConfiguredExtensionSpec()
  let failures = 0

  console.log(`Extension spec under test: ${extensionSpec}`)

  for (const slug of examples) {
    const sourceExampleDir = path.join(examplesRoot, slug)
    if (!fs.existsSync(sourceExampleDir)) {
      console.error(`✖ Missing example: ${slug}`)
      failures += 1
      continue
    }

    const {tempRoot, exampleDir} = prepTempExample(slug)
    try {
      console.log(`\n►►► One-run check: ${slug} [${browser}]`)

      const result = await run(
        'pnpm',
        [
          'dlx',
          `extension@${extensionSpec}`,
          'build',
          '--browser=chrome',
          '--silent',
          'true',
          '--no-telemetry'
        ],
        exampleDir
      )

      const output = `${result.stdout}\n${result.stderr}`
      const askedSecondRun = output.includes('Run the command again to proceed')
      const hasManifest = hasBuiltManifest(exampleDir, browser)

      if (result.code !== 0 || askedSecondRun || !hasManifest) {
        failures += 1
        console.error(`✖ Failed one-run assertion for ${slug}`)
        if (askedSecondRun) {
          console.error('  Reason: build asked for a second run')
        } else if (!hasManifest) {
          console.error('  Reason: no build manifest produced on first run')
        } else {
          console.error(`  Reason: build exited with code ${result.code}`)
        }
      } else {
        console.log(`✔ One-run build passed for ${slug}`)
      }
    } finally {
      fs.rmSync(tempRoot, {recursive: true, force: true})
    }
  }

  if (failures > 0) {
    console.error(`\n✖ One-run checks failed: ${failures}`)
    process.exit(1)
  }

  console.log('\n✔ All one-run checks passed')
}

main()
