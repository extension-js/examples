#!/usr/bin/env node

import {spawn} from 'node:child_process'
import process from 'node:process'

const reloadTemplates = [
  'content',
  'content-react',
  'content-vue',
  'content-svelte',
  'content-preact',
  'content-typescript',
  'content-env',
  'content-css-modules',
  'content-less',
  'content-less-modules',
  'content-sass',
  'content-sass-modules',
  'content-custom-font',
  'content-multi-one-entry',
  'content-multi-three-entries',
  'javascript',
  'react',
  'staging-content-main-world'
].join(',')

function runCommand(label, command, args, cwd) {
  const env = {...process.env}
  return new Promise((resolve, reject) => {
    console.log(`\n[dev-reload-suite] ${label}`)
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit'
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${label} failed with exit code ${code}`))
    })
  })
}

async function main() {
  const cwd = process.cwd()

  await runCommand(
    'targeted content reload on Chromium',
    process.execPath,
    [
      'scripts/verify-content-live.mjs',
      '--browser=chromium',
      `--templates=${reloadTemplates}`
    ],
    cwd
  )
  await runCommand(
    'targeted content reload on Firefox',
    process.execPath,
    [
      'scripts/verify-content-live.mjs',
      '--browser=firefox',
      `--templates=${reloadTemplates}`
    ],
    cwd
  )
  await runCommand(
    'full extension reload on Chromium',
    process.execPath,
    ['scripts/verify-full-extension-reload.mjs', '--browser=chromium'],
    cwd
  )
  await runCommand(
    'full extension reload on Firefox',
    process.execPath,
    ['scripts/verify-full-extension-reload.mjs', '--browser=firefox'],
    cwd
  )
  await runCommand(
    'Chromium dev-live regression project',
    'pnpm',
    ['playwright', 'test', '--workers=1', '--project=dev-live'],
    cwd
  )
  await runCommand(
    'HTML context regression projects',
    'pnpm',
    [
      'playwright',
      'test',
      '--workers=1',
      '--project=sidebar',
      '--project=action',
      '--project=newtab',
      '--project=special-folders'
    ],
    cwd
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
})
