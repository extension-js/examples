#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import {
  SECOND_RUN_HINT,
  examplesRoot,
  getExtensionSpec,
  hasBuiltManifest,
  parseExamplesArg,
  prepTempExample,
  run as runWithEnv
} from '../lib/install-harness.mjs'

const supportedPms = new Set(['pnpm', 'npm', 'yarn', 'bun'])
const pmIndex = process.argv.indexOf('--pm')
const packageManager = pmIndex >= 0 ? process.argv[pmIndex + 1] : undefined

if (!packageManager || !supportedPms.has(packageManager)) {
  console.error(
    'Usage: node scripts/install-contracts/assert-optional-deps-canary-matrix.mjs --pm <pnpm|npm|yarn|bun>'
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

const RUN_ENV = {
  CI: 'true',
  PNPM_CONFIG_FROZEN_LOCKFILE: 'false',
  npm_config_frozen_lockfile: 'false'
}

function run(command, args, cwd) {
  return runWithEnv(command, args, cwd, RUN_ENV)
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
  return run(
    packageManager === 'bun' ? 'bunx' : 'npx',
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
  const examples = parseExamplesArg(defaultExamples)
  const extensionSpec = getExtensionSpec()
  let failures = 0

  console.log(
    `Optional deps ecosystem assertion using ${packageManager} (extension@${extensionSpec}): ${examples.join(', ')}`
  )

  // vue-loader requires webpack/lib/NormalModule at runtime; yarn v1 flat
  // hoisting does not expose webpack (a transitive dep of extension) to
  // vue-loader, so we skip vue examples when the package manager is yarn.
  const yarnSkip = new Set(['content-vue'])

  for (const slug of examples) {
    if (packageManager === 'yarn' && yarnSkip.has(slug)) {
      console.log(`⊘ ${slug} skipped on yarn (vue-loader webpack hoisting)`)
      continue
    }

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
      const askedSecondRun = output.includes(SECOND_RUN_HINT)
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
