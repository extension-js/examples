#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
)
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

function cleanOutputs(exampleDir) {
  for (const root of OUTPUT_ROOTS) {
    const target = path.join(exampleDir, root)
    if (fs.existsSync(target)) fs.rmSync(target, {recursive: true, force: true})
  }
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
    const child = spawn(command, args, {
      cwd,
      shell: false,
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
  let failures = 0

  for (const slug of examples) {
    const exampleDir = path.join(examplesRoot, slug)
    if (!fs.existsSync(exampleDir)) {
      console.error(`✖ Missing example: ${slug}`)
      failures += 1
      continue
    }

    cleanOutputs(exampleDir)
    console.log(`\n►►► Canary one-run check: ${slug} [${browser}]`)

    const result = await run(
      'pnpm',
      [
        'dlx',
        'extension@canary',
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
      console.error(`✖ Failed one-run canary assertion for ${slug}`)
      if (askedSecondRun) {
        console.error('  Reason: build asked for a second run')
      } else if (!hasManifest) {
        console.error('  Reason: no build manifest produced on first run')
      } else {
        console.error(`  Reason: build exited with code ${result.code}`)
      }
    } else {
      console.log(`✔ One-run canary build passed for ${slug}`)
    }
  }

  if (failures > 0) {
    console.error(`\n✖ One-run canary checks failed: ${failures}`)
    process.exit(1)
  }

  console.log('\n✔ All one-run canary checks passed')
}

main()
