#!/usr/bin/env node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  SECOND_RUN_HINT,
  examplesRoot,
  getExtensionSpec,
  parseExamplesArg,
  run as runWithEnv,
  runDevUntilReady
} from '../lib/install-harness.mjs'

const failureHints = [
  'Module parse failed',
  'JavaScript parse error',
  'compiled with errors',
  'Unhandled rejection'
]

const BASE_ENV = {
  CI: 'true',
  COREPACK_ENABLE_AUTO_PIN: '0',
  npm_config_yes: 'true',
  // Ensure create/dev flows run the npm lane consistently even when this
  // smoke script is launched through pnpm in CI.
  npm_config_user_agent: `npm/11.0.0 node/${process.versions.node} ${process.platform} ${process.arch}`,
  npm_execpath: '',
  NPM_EXEC_PATH: ''
}

function run(command, args, cwd, extraEnv = {}) {
  return runWithEnv(
    command,
    args,
    cwd,
    {...BASE_ENV, ...extraEnv},
    {stdin: 'ignore', detached: true}
  )
}

function listTemplateSlugs() {
  return fs
    .readdirSync(examplesRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) =>
      fs.existsSync(path.join(examplesRoot, name, 'package.json'))
    )
    .sort()
}

function resolveCreateCommand(extensionSpec, templateSlug, projectName) {
  const localCliPath = process.env.EXTENSION_LOCAL_CLI_PATH?.trim()

  if (localCliPath) {
    return {
      command: 'node',
      args: [localCliPath, 'create', projectName, '--template', templateSlug]
    }
  }

  return {
    command: 'npx',
    args: [
      `extension@${extensionSpec}`,
      'create',
      projectName,
      '--template',
      templateSlug
    ]
  }
}

function getJourneyLabel(extensionSpec) {
  if (process.env.EXTENSION_LOCAL_CLI_PATH) {
    return `local CLI (${process.env.EXTENSION_LOCAL_CLI_PATH})`
  }

  return `published extension@${extensionSpec}`
}

async function runTemplate(templateSlug, extensionSpec) {
  const projectName = `${templateSlug}-dev-smoke`
  const createCommand = resolveCreateCommand(
    extensionSpec,
    templateSlug,
    projectName
  )
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'extjs-create-dev-'))
  const cacheDir = path.join(tempRoot, '.cache')
  const projectDir = path.join(tempRoot, projectName)
  const env = {EXTENSION_JS_CACHE_DIR: cacheDir}

  try {
    console.log(
      `\n=== ${templateSlug}: create+dev using ${getJourneyLabel(extensionSpec)} ===`
    )

    const createResult = await run(
      createCommand.command,
      createCommand.args,
      tempRoot,
      env
    )

    if (createResult.code !== 0 || !fs.existsSync(projectDir)) {
      throw new Error(
        `Create command failed.\n${createResult.stdout}\n${createResult.stderr}`
      )
    }

    const installResult = await run(
      'npm',
      ['install', '--no-audit', '--no-fund'],
      projectDir,
      env
    )

    if (installResult.code !== 0) {
      throw new Error(
        `npm install failed.\n${installResult.stdout}\n${installResult.stderr}`
      )
    }

    const devResult = await runDevUntilReady(
      'npm',
      ['run', 'dev', '--', '--no-browser', '--no-telemetry'],
      projectDir,
      {env: {...BASE_ENV, ...env}, failureHints, timeoutMs: 120000}
    )

    const output = `${devResult.stdout}\n${devResult.stderr}\n${
      devResult.error || ''
    }`

    if (devResult.code !== 0) {
      throw new Error(`Dev command failed.\n${output}`)
    }

    if (output.includes(SECOND_RUN_HINT)) {
      throw new Error(`Dev requested a second run.\n${output}`)
    }

    if (/compiled with errors/i.test(output)) {
      throw new Error(`Dev compilation reported errors.\n${output}`)
    }

    console.log(`✔ ${templateSlug} create+dev passed`)

    return true
  } finally {
    try {
      fs.rmSync(tempRoot, {recursive: true, force: true})
    } catch {
      // Dev smoke may still be releasing temp artifacts when cleanup starts.
    }
  }
}

async function main() {
  const extensionSpec = getExtensionSpec()
  const templateSlugs = parseExamplesArg(listTemplateSlugs())
  let failures = 0

  console.log(
    `Create+dev workflow smoke check using ${getJourneyLabel(extensionSpec)}`
  )

  console.log(`Templates under test: ${templateSlugs.join(', ')}`)

  for (const templateSlug of templateSlugs) {
    try {
      await runTemplate(templateSlug, extensionSpec)
    } catch (error) {
      failures += 1
      console.error(`✖ ${templateSlug} create+dev failed`)
      console.error(error)
    }
  }

  if (failures > 0) {
    throw new Error(`Create+dev workflow smoke checks failed: ${failures}`)
  }

  console.log('\n✔ All create+dev workflow smoke checks passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
