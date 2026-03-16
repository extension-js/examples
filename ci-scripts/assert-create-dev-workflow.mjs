#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const secondRunHint = 'Run the command again to proceed'
const missingOptionalDepsHint =
  'Optional dependency install reported success but packages are missing'
const readyHint = 'compiled successfully'
const duplicateSpecializedDepsHint =
  /Found \d+ specialized integration(s)? needing installation/i
const failureHints = [
  missingOptionalDepsHint,
  'compiled with errors',
  'Unhandled rejection'
]

function commandFor(tool) {
  if (process.platform !== 'win32') return tool
  if (tool === 'npm') return 'npm.cmd'
  if (tool === 'npx') return 'npx.cmd'
  return tool
}

function run(command, args, cwd, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(commandFor(command), args, {
      cwd,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        COREPACK_ENABLE_AUTO_PIN: '0',
        PNPM_CONFIG_FROZEN_LOCKFILE: 'false',
        npm_config_frozen_lockfile: 'false',
        npm_config_yes: 'true',
        ...extraEnv
      }
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(chunk)
    })

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(chunk)
    })

    child.on('close', (code) =>
      resolve({code: code ?? 1, stdout, stderr, error: null})
    )
    child.on('error', (error) =>
      resolve({code: 1, stdout, stderr, error: String(error?.message || error)})
    )
  })
}

function parseExamplesArg() {
  const arg = process.argv.find((value) => value.startsWith('--examples='))
  if (!arg) return undefined

  return arg
    .slice('--examples='.length)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function listTemplateSlugs() {
  const examplesRoot = path.join(repoRoot, 'examples')

  return fs
    .readdirSync(examplesRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) =>
      fs.existsSync(path.join(examplesRoot, name, 'package.json'))
    )
    .sort()
}

function getTemplateSlugs() {
  const requested = parseExamplesArg()
  if (requested && requested.length > 0) return requested
  return listTemplateSlugs()
}

function runDevUntilReady(
  command,
  args,
  cwd,
  extraEnv = {},
  timeoutMs = 120000
) {
  return new Promise((resolve) => {
    const child = spawn(commandFor(command), args, {
      cwd,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        COREPACK_ENABLE_AUTO_PIN: '0',
        PNPM_CONFIG_FROZEN_LOCKFILE: 'false',
        npm_config_frozen_lockfile: 'false',
        npm_config_yes: 'true',
        ...extraEnv
      }
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const maybeFinishFromOutput = () => {
      const output = `${stdout}\n${stderr}`

      if (failureHints.some((hint) => output.includes(hint))) {
        child.kill('SIGTERM')
        finish({
          code: 1,
          stdout,
          stderr,
          error: 'dev output matched failure hint'
        })
        return
      }

      if (output.includes(readyHint)) {
        child.kill('SIGTERM')
        finish({code: 0, stdout, stderr, error: null})
      }
    }

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(chunk)
      maybeFinishFromOutput()
    })

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(chunk)
      maybeFinishFromOutput()
    })

    child.on('close', (code) =>
      finish({code: code ?? 1, stdout, stderr, error: null})
    )

    child.on('error', (error) => {
      finish({code: 1, stdout, stderr, error: String(error?.message || error)})
    })

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      finish({
        code: 1,
        stdout,
        stderr,
        error: `timed out after ${timeoutMs} ms`
      })
    }, timeoutMs)
  })
}

function getConfiguredExtensionSpec() {
  const override = process.env.EXTENSION_SPEC?.trim()
  if (override) return override

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

function resolveCreateCommand(extensionSpec, templateSlug, projectName) {
  const localCliPath = process.env.EXTENSION_LOCAL_CLI_PATH?.trim()

  if (localCliPath) {
    return {
      command: 'node',
      args: [localCliPath, 'create', projectName, '--template', templateSlug],
      label: `local CLI (${localCliPath})`
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
    ],
    label: `extension@${extensionSpec}`
  }
}

function getJourneyLabel(createCommand, extensionSpec) {
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

  try {
    console.log(
      `\n=== ${templateSlug}: create+dev using ${getJourneyLabel(createCommand, extensionSpec)} ===`
    )

    const createResult = await run(
      createCommand.command,
      createCommand.args,
      tempRoot,
      {
        EXTENSION_JS_CACHE_DIR: cacheDir
      }
    )

    if (createResult.code !== 0 || !fs.existsSync(projectDir)) {
      throw new Error(
        `Create command failed.\n${createResult.stdout}\n${createResult.stderr}\n${
          createResult.error || ''
        }`
      )
    }

    const devResult = await runDevUntilReady(
      'npm',
      ['run', 'dev', '--', '--no-browser', '--no-telemetry'],
      projectDir,
      {
        EXTENSION_JS_CACHE_DIR: cacheDir
      },
      120000
    )

    const output = `${devResult.stdout}\n${devResult.stderr}\n${
      devResult.error || ''
    }`

    if (devResult.code !== 0) {
      throw new Error(`Dev command failed.\n${output}`)
    }

    if (output.includes(secondRunHint)) {
      throw new Error(`Dev requested a second run.\n${output}`)
    }

    if (output.includes(missingOptionalDepsHint)) {
      throw new Error(`Optional dependency verification failed.\n${output}`)
    }

    if (/compiled with errors/i.test(output)) {
      throw new Error(`Dev compilation reported errors.\n${output}`)
    }

    if (duplicateSpecializedDepsHint.test(output)) {
      throw new Error(
        `Dev re-installed specialized integrations (create should have done it). Regression: duplicate optional deps install.\n${output}`
      )
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
  const extensionSpec = getConfiguredExtensionSpec()
  const templateSlugs = getTemplateSlugs()
  let failures = 0

  console.log(
    `Create+dev workflow smoke check using ${getJourneyLabel(resolveCreateCommand(extensionSpec, 'template', 'project'), extensionSpec)}`
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
