#!/usr/bin/env node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  SECOND_RUN_HINT,
  examplesRoot,
  getExtensionSpec,
  hasBuiltManifest,
  removeBuildOutputs,
  run
} from '../lib/install-harness.mjs'

const javascriptExample = path.join(examplesRoot, 'javascript')
const postCssResolutionError =
  '[PostCSS] postcss-loader could not be resolved after optional dependency installation.'
const attempts = Number(process.env.EXTENSION_POSTCSS_REPRO_ATTEMPTS || '5')
const PNPM_VERSION = '10.4.1'

function prepTempProject() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'extjs-js-postcss-'))
  const targetDir = path.join(tempRoot, 'javascript')

  fs.cpSync(javascriptExample, targetDir, {recursive: true})
  fs.rmSync(path.join(targetDir, 'node_modules'), {
    recursive: true,
    force: true
  })

  removeBuildOutputs(targetDir)

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

async function runAttempt(index, stableVersion) {
  const {tempRoot, targetDir} = prepTempProject()
  const env = {
    COREPACK_ENABLE_AUTO_PIN: '0',
    CI: 'true',
    XDG_CONFIG_HOME: path.join(tempRoot, '.xdg-config')
  }

  console.log(
    `\n=== attempt ${index}/${attempts} (stable ${stableVersion}) ===`
  )

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

  if (output.includes(SECOND_RUN_HINT)) {
    return {ok: false, reason: 'second-run hint detected'}
  }

  if (output.includes(postCssResolutionError)) {
    return {ok: false, reason: 'postcss resolution error detected'}
  }

  if (!hasBuiltManifest(targetDir)) {
    return {ok: false, reason: 'manifest missing'}
  }

  return {ok: true}
}

async function main() {
  const extensionSpec = getExtensionSpec()
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
    console.error(
      `\n✖ PostCSS stable pnpm repro failed (${failures}/${attempts})`
    )

    process.exit(1)
  }

  console.log('\n✔ PostCSS stable pnpm repro passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
