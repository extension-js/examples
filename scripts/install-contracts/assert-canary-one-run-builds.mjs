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
  repoRoot,
  run
} from '../lib/install-harness.mjs'

const XDG_CONFIG_HOME =
  process.env.XDG_CONFIG_HOME || path.join(repoRoot, '.xdg-config')

const RUN_ENV = {
  XDG_CONFIG_HOME,
  PNPM_CONFIG_FROZEN_LOCKFILE: 'false',
  npm_config_frozen_lockfile: 'false'
}

const defaultExamples = [
  'content-sass',
  'content-less',
  'content-svelte',
  'content-vue',
  'react',
  'typescript'
]

async function main() {
  fs.mkdirSync(XDG_CONFIG_HOME, {recursive: true})

  const browser = 'chrome'
  const examples = parseExamplesArg(defaultExamples)
  const extensionSpec = getExtensionSpec()
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
        exampleDir,
        RUN_ENV
      )

      const output = `${result.stdout}\n${result.stderr}`
      const askedSecondRun = output.includes(SECOND_RUN_HINT)
      const hasManifest = hasBuiltManifest(exampleDir)

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
