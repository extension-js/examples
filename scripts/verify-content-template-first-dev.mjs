#!/usr/bin/env node

import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)

function parseArg(name, fallback) {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith('--')) return fallback
  return value
}

function hasFlag(name) {
  return args.includes(name)
}

const cliPackage = parseArg('--package', 'extension@latest')
const browser = parseArg('--browser', 'chromium')
const timeoutMs = Number(parseArg('--timeout-ms', '180000'))
const templateArg = parseArg(
  '--templates',
  'content-react,content-vue,content-svelte'
)
const keepTemp = hasFlag('--keep-temp')

const templates = templateArg
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const createFailurePatterns = [
  /installing specialized dependencies .* failed/i,
  /installing dependencies failed/i,
  /npm error/i,
  /ERR!/i
]

const devFailurePatterns = [
  /compiled with errors/i,
  /Module parse failed/i,
  /Toolchain packages are missing or incompatible/i,
  /Missing or invalid packages/i,
  /Unhandled rejection/i,
  /could not be resolved/i,
  /JavaScript parse error/i
]

const compileSuccessPattern = /compiled successfully|compiled with warnings/i
const readyPattern = /Extension ready for development/i
const POST_READY_STABILIZATION_MS = 2500

function commandFor(tool) {
  if (process.platform !== 'win32') return tool
  if (tool === 'npm') return 'npm.cmd'
  if (tool === 'npx') return 'npx.cmd'
  return tool
}

function pathDelimiter() {
  return process.platform === 'win32' ? ';' : ':'
}

function createBaseEnv(extraEnv = {}) {
  const nodeBinDir = path.dirname(process.execPath)
  return {
    ...process.env,
    CI: 'true',
    HUSKY: '0',
    PATH: `${nodeBinDir}${pathDelimiter()}${process.env.PATH || process.env.Path || ''}`,
    ...extraEnv
  }
}

function renderCommand(command, commandArgs) {
  return [commandFor(command), ...commandArgs].join(' ')
}

function createProjectName(template) {
  return `extjs-regression-${template.replace(/[^a-z0-9]+/gi, '-')}`
}

function assertNoFailure(output, patterns, phase, template) {
  for (const pattern of patterns) {
    if (pattern.test(output)) {
      throw new Error(
        `[${template}] ${phase} matched failure pattern ${String(pattern)}\n\n${output}`
      )
    }
  }
}

async function runCollect({
  command,
  commandArgs,
  cwd,
  env,
  template,
  phase,
  failurePatterns
}) {
  const resolvedCommand = commandFor(command)

  return new Promise((resolve, reject) => {
    const child = spawn(resolvedCommand, commandArgs, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let output = ''

    const onChunk = (chunk) => {
      output += chunk.toString()
    }

    child.stdout?.on('data', onChunk)
    child.stderr?.on('data', onChunk)
    child.on('error', reject)
    child.on('close', (code) => {
      try {
        if ((code || 0) !== 0) {
          reject(
            new Error(
              `[${template}] ${phase} failed with code ${code}: ${renderCommand(
                command,
                commandArgs
              )}\n\n${output}`
            )
          )
          return
        }

        assertNoFailure(output, failurePatterns, phase, template)
        resolve(output)
      } catch (error) {
        reject(error)
      }
    })
  })
}

function terminateChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let settled = false
    const finalize = () => {
      if (settled) return
      settled = true
      clearTimeout(forceKillTimer)
      child.off?.('close', finalize)
      child.off?.('exit', finalize)
      resolve()
    }

    const forceKillTimer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // Ignore cleanup failures.
      }
      finalize()
    }, 1500)

    child.once('close', finalize)
    child.once('exit', finalize)

    try {
      child.kill('SIGTERM')
    } catch {
      finalize()
    }
  })
}

async function runDevAndValidate({projectDir, env, template}) {
  const command = commandFor('npm')

  return new Promise((resolve, reject) => {
    const child = spawn(
      command,
      [
        'run',
        'dev',
        '--',
        `--browser=${browser}`,
        '--no-browser',
        '--port',
        '0'
      ],
      {
        cwd: projectDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )

    let output = ''
    let compiled = false
    let ready = false
    let settled = false

    const finish = async (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      await terminateChild(child)

      if (error) {
        reject(error)
      } else {
        resolve(output)
      }
    }

    const maybeSucceed = () => {
      if (!compiled || !ready) return
      setTimeout(() => {
        void finish()
      }, POST_READY_STABILIZATION_MS)
    }

    const timeout = setTimeout(() => {
      void finish(
        new Error(
          `[${template}] dev timed out after ${timeoutMs} ms.\n\n${output}`
        )
      )
    }, timeoutMs)

    const onChunk = (chunk) => {
      const text = chunk.toString()
      output += text

      try {
        assertNoFailure(text, devFailurePatterns, 'dev', template)
      } catch (error) {
        void finish(error)
        return
      }

      if (!compiled && compileSuccessPattern.test(text)) {
        compiled = true
      }

      if (!ready && readyPattern.test(text)) {
        ready = true
      }

      maybeSucceed()
    }

    child.stdout?.on('data', onChunk)
    child.stderr?.on('data', onChunk)
    child.on('error', (error) => {
      void finish(error)
    })
    child.on('close', (code) => {
      if (settled) return
      void finish(
        new Error(
          `[${template}] dev exited early with code ${code}\n\n${output}`
        )
      )
    })
  })
}

async function runTemplate(template) {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `extjs-future-${template}-`)
  )
  const cacheDir = path.join(tempRoot, 'cache')
  const projectName = createProjectName(template)
  const env = createBaseEnv({
    EXTENSION_JS_CACHE_DIR: cacheDir
  })

  console.log(`\n[${template}] temp root: ${tempRoot}`)
  console.log(`[${template}] creating project with ${cliPackage}`)

  try {
    await runCollect({
      command: 'npx',
      commandArgs: [
        '-y',
        cliPackage,
        'create',
        projectName,
        `--template=${template}`
      ],
      cwd: tempRoot,
      env,
      template,
      phase: 'create',
      failurePatterns: createFailurePatterns
    })

    const projectDir = path.join(tempRoot, projectName)
    console.log(`[${template}] running first dev`)
    const output = await runDevAndValidate({
      projectDir,
      env,
      template
    })

    console.log(`[${template}] PASS`)
    return {template, tempRoot, output}
  } catch (error) {
    console.error(`[${template}] FAIL`)
    console.error(error instanceof Error ? error.message : String(error))
    console.error(`[${template}] temp root preserved: ${tempRoot}`)
    throw error
  } finally {
    if (!keepTemp) {
      try {
        await fs.rm(tempRoot, {recursive: true, force: true})
      } catch {
        // Best-effort cleanup.
      }
    }
  }
}

async function main() {
  if (templates.length === 0) {
    throw new Error('Provide at least one template via --templates.')
  }

  const failures = []

  for (const template of templates) {
    try {
      await runTemplate(template)
    } catch (error) {
      failures.push({
        template,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  if (failures.length > 0) {
    console.error('\nRegression failures detected:')
    for (const failure of failures) {
      console.error(`- ${failure.template}: ${failure.error}`)
    }
    process.exit(1)
  }

  console.log('\nAll content template first-dev regressions passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
})
