#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
)
const examplesRoot = path.join(repoRoot, 'examples')
const OUTPUT_ROOTS = ['dist', 'build', '.extension']
const CHANNELS = ['chrome', 'chromium', 'chrome-mv3']

const defaultExamples = [
  'content-sass',
  'content-less',
  'content-react',
  'content-preact',
  'content-vue',
  'content-svelte',
  'content-typescript'
]
const secondRunHint = 'Run the command again to proceed'

function parseExamples() {
  const arg = process.argv.find((v) => v.startsWith('--examples='))
  if (!arg) return defaultExamples
  return arg
    .slice('--examples='.length)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function run(command, args, cwd, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
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
  for (const root of OUTPUT_ROOTS) {
    for (const channel of CHANNELS) {
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
  return dst
}

async function assertLocalInstallMode(slug, stableVersion) {
  const exampleDir = prepTempExample(slug)
  console.log(`\n=== ${slug}: npm install + local extension (${stableVersion}) ===`)

  let r = await run('npm', ['install', '--no-audit', '--no-fund'], exampleDir)
  if (r.code !== 0) return {ok: false, reason: 'npm install failed'}

  r = await run(
    'npm',
    ['install', '--save-dev', '--save-exact', `extension@${stableVersion}`, '--no-audit', '--no-fund'],
    exampleDir
  )
  if (r.code !== 0) return {ok: false, reason: 'npm install extension failed'}

  r = await run(
    'npx',
    ['extension', 'build', '--browser=chrome', '--silent', 'true', '--no-telemetry'],
    exampleDir
  )
  if (r.code !== 0) return {ok: false, reason: 'build failed'}
  if (`${r.stdout}\n${r.stderr}`.includes(secondRunHint)) {
    return {ok: false, reason: 'second-run hint detected'}
  }
  if (!hasManifest(exampleDir)) return {ok: false, reason: 'manifest missing'}
  return {ok: true}
}

async function assertNpxMode(slug, stableVersion) {
  const exampleDir = prepTempExample(slug)
  console.log(`\n=== ${slug}: npm install + npx extension@${stableVersion} ===`)

  let r = await run('npm', ['install', '--no-audit', '--no-fund'], exampleDir)
  if (r.code !== 0) return {ok: false, reason: 'npm install failed'}

  r = await run(
    'npx',
    [`extension@${stableVersion}`, 'build', '--browser=chrome', '--silent', 'true', '--no-telemetry'],
    exampleDir
  )
  if (r.code !== 0) return {ok: false, reason: 'npx build failed'}
  if (`${r.stdout}\n${r.stderr}`.includes(secondRunHint)) {
    return {ok: false, reason: 'second-run hint detected'}
  }
  if (!hasManifest(exampleDir)) return {ok: false, reason: 'manifest missing'}
  return {ok: true}
}

async function getStableVersion() {
  const r = await run('npm', ['view', 'extension', 'version'], repoRoot)
  const output = `${r.stdout}\n${r.stderr}`.trim().split('\n').pop()?.trim()
  if (r.code !== 0 || !output) {
    throw new Error('Unable to resolve stable extension version from npm')
  }
  return output
}

async function main() {
  const examples = parseExamples()
  const stableVersion = await getStableVersion()
  let failures = 0

  console.log(`Stable under test: ${stableVersion}`)
  console.log(`Examples: ${examples.join(', ')}`)

  for (const slug of examples) {
    const local = await assertLocalInstallMode(slug, stableVersion)
    if (!local.ok) {
      failures += 1
      console.error(`✖ ${slug} local-install mode failed: ${local.reason}`)
    } else {
      console.log(`✔ ${slug} local-install mode passed`)
    }

    const npx = await assertNpxMode(slug, stableVersion)
    if (!npx.ok) {
      failures += 1
      console.error(`✖ ${slug} npx mode failed: ${npx.reason}`)
    } else {
      console.log(`✔ ${slug} npx mode passed`)
    }
  }

  if (failures > 0) {
    console.error(`\n✖ Stable install-mode assertions failed: ${failures}`)
    process.exit(1)
  }

  console.log('\n✔ Stable install-mode assertions passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
