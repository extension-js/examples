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
const secondRunHint = 'Run the command again to proceed'

const supportedPms = new Set(['pnpm', 'npm', 'yarn', 'bun'])
const pmIndex = process.argv.indexOf('--pm')
const packageManager = pmIndex >= 0 ? process.argv[pmIndex + 1] : undefined

if (!packageManager || !supportedPms.has(packageManager)) {
  console.error(
    'Usage: node ci-scripts/assert-optional-deps-canary-matrix.mjs --pm <pnpm|npm|yarn|bun>'
  )
  process.exit(1)
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

function commandFor(tool) {
  if (process.platform !== 'win32') return tool
  if (tool === 'pnpm') return 'pnpm.cmd'
  if (tool === 'npm') return 'npm.cmd'
  if (tool === 'npx') return 'npx.cmd'
  if (tool === 'yarn') return 'yarn.cmd'
  if (tool === 'bun') return 'bun.exe'
  if (tool === 'bunx') return 'bunx.exe'
  return tool
}

function run(command, args, cwd) {
  return new Promise((resolve) => {
    const resolvedCommand = commandFor(command)
    const child = spawn(resolvedCommand, args, {
      cwd,
      shell: process.platform === 'win32',
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        PNPM_CONFIG_FROZEN_LOCKFILE: 'false',
        npm_config_frozen_lockfile: 'false'
      }
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

function hasBuiltManifest(exampleDir) {
  const outputRoots = ['dist', 'build', '.extension']
  const channels = ['chrome', 'chromium', 'chrome-mv3']
  for (const root of outputRoots) {
    for (const channel of channels) {
      const manifestPath = path.join(exampleDir, root, channel, 'manifest.json')
      if (fs.existsSync(manifestPath)) return true
    }
  }
  return false
}

function prepTempExample(slug) {
  const src = path.join(examplesRoot, slug)
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `extjs-${slug}-`))
  const dst = path.join(tempRoot, slug)
  fs.cpSync(src, dst, {recursive: true})
  fs.rmSync(path.join(dst, 'node_modules'), {recursive: true, force: true})
  fs.rmSync(path.join(dst, 'dist'), {recursive: true, force: true})
  fs.rmSync(path.join(dst, 'build'), {recursive: true, force: true})
  fs.rmSync(path.join(dst, '.extension'), {recursive: true, force: true})
  return {tempRoot, exampleDir: dst}
}

async function installDeps(exampleDir) {
  if (packageManager === 'pnpm') {
    let result = await run('pnpm', ['install', '--frozen-lockfile'], exampleDir)
    if (result.code !== 0) {
      result = await run(
        'pnpm',
        ['install', '--no-frozen-lockfile'],
        exampleDir
      )
    }
    return result.code
  }

  if (packageManager === 'npm') {
    const result = await run(
      'npm',
      ['install', '--no-audit', '--no-fund'],
      exampleDir
    )
    return result.code
  }

  if (packageManager === 'yarn') {
    let result = await run('yarn', ['install', '--immutable'], exampleDir)
    if (result.code !== 0) {
      result = await run('yarn', ['install'], exampleDir)
    }
    return result.code
  }

  let result = await run('bun', ['install', '--frozen-lockfile'], exampleDir)
  if (result.code !== 0) {
    result = await run('bun', ['install'], exampleDir)
  }
  return result.code
}

async function runVersionedBuild(exampleDir, extensionSpec) {
  if (packageManager === 'bun') {
    return run(
      'bunx',
      [
        `extension@${extensionSpec}`,
        'build',
        '--browser=chrome',
        '--silent',
        'true',
        '--no-telemetry'
      ],
      exampleDir
    )
  }

  return run(
    'npx',
    [
      `extension@${extensionSpec}`,
      'build',
      '--browser=chrome',
      '--silent',
      'true',
      '--no-telemetry'
    ],
    exampleDir
  )
}

async function main() {
  const examples = parseExamplesArg()
  const extensionSpec = getConfiguredExtensionSpec()
  let failures = 0

  console.log(
    `Optional deps ecosystem assertion using ${packageManager} (extension@${extensionSpec}): ${examples.join(', ')}`
  )

  for (const slug of examples) {
    const sourceExampleDir = path.join(examplesRoot, slug)
    if (!fs.existsSync(sourceExampleDir)) {
      console.error(`✖ Missing example: ${slug}`)
      failures += 1
      continue
    }

    console.log(`\n►►► Ecosystem check: ${slug} [${packageManager}]`)
    const {tempRoot, exampleDir} = prepTempExample(slug)
    try {
      const installCode = await installDeps(exampleDir)
      if (installCode !== 0) {
        console.error(`✖ Dependency install failed for ${slug}`)
        failures += 1
        continue
      }

      const result = await runVersionedBuild(exampleDir, extensionSpec)
      const output = `${result.stdout}\n${result.stderr}`
      const askedSecondRun = output.includes(secondRunHint)
      const hasManifest = hasBuiltManifest(exampleDir)

      if (result.code !== 0 || askedSecondRun || !hasManifest) {
        failures += 1
        console.error(`✖ Ecosystem assertion failed for ${slug}`)
        if (askedSecondRun) {
          console.error('  Reason: build asked for a second run')
        } else if (!hasManifest) {
          console.error('  Reason: no build manifest produced on first run')
        } else {
          console.error(`  Reason: build exited with code ${result.code}`)
        }
      } else {
        console.log(`✔ Ecosystem assertion passed for ${slug}`)
      }
    } finally {
      fs.rmSync(tempRoot, {recursive: true, force: true})
    }
  }

  if (failures > 0) {
    console.error(`\n✖ Optional deps ecosystem checks failed: ${failures}`)
    process.exit(1)
  }

  console.log('\n✔ Optional deps ecosystem checks passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
