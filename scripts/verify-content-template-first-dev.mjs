#!/usr/bin/env node

import {spawn, spawnSync} from 'node:child_process'
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
const defaultTimeoutMs = process.platform === 'win32' ? '360000' : '180000'
const timeoutMs = Number(parseArg('--timeout-ms', defaultTimeoutMs))
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

const isWindows = process.platform === 'win32'

function commandFor(tool) {
  if (!isWindows) return tool
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

// Pin known-broken transitive versions so the first-dev test can run against
// the currently published `extension@latest` tree even when an upstream patch
// release ships a corrupted tarball. Each entry below is annotated with the
// upstream issue / date so we can drop it once the broken version is yanked
// or the next published `extension-develop` already encodes the same pin.
//
// BEFORE REMOVING any entry, run `npm view <pkg>@<version> .unpackedSize` —
// the broken 2.0.2 has unpackedSize ~7.5 kB (no dist/), the healthy 2.0.1 is
// significantly larger. Mirror of the same block in
// extension-js/extension.js:scripts/verify-content-template-first-dev.mjs.
const SCAFFOLD_OVERRIDES = {
  // @rspack/dev-server@2.0.2 (2026-05-28) shipped an empty tarball — only
  // LICENSE/README/package.json, no dist/. `extension-develop@3.17.0`
  // declares ^2.0.1, so a fresh npm install resolves to 2.0.2 and `node dev`
  // hits ERR_MODULE_NOT_FOUND on @rspack/dev-server/dist/index.js. Force
  // 2.0.1 until upstream republishes.
  '@rspack/dev-server': '2.0.1'
}

async function injectScaffoldOverrides(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json')
  let raw
  try {
    raw = await fs.readFile(pkgPath, 'utf8')
  } catch {
    return
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return
  }
  parsed.overrides = {...(parsed.overrides || {}), ...SCAFFOLD_OVERRIDES}
  await fs.writeFile(pkgPath, `${JSON.stringify(parsed, null, 2)}\n`)
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
  failurePatterns,
  collectTimeoutMs = timeoutMs
}) {
  const resolvedCommand = commandFor(command)

  return new Promise((resolve, reject) => {
    let settled = false
    const child = spawn(resolvedCommand, commandArgs, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...(isWindows ? {shell: true} : {detached: true})
    })

    let output = ''

    const onChunk = (chunk) => {
      output += chunk.toString()
    }

    const collectTimeout = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        if (isWindows && child.pid) {
          spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            stdio: 'ignore'
          })
        } else if (child.pid) {
          process.kill(-child.pid, 'SIGKILL')
        } else {
          child.kill()
        }
      } catch {
        // Process may have already exited.
      }
      reject(
        new Error(
          `[${template}] ${phase} timed out after ${collectTimeoutMs} ms: ${renderCommand(
            command,
            commandArgs
          )}\n\n${output.slice(-5000)}`
        )
      )
    }, collectTimeoutMs)

    child.stdout?.on('data', onChunk)
    child.stderr?.on('data', onChunk)
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(collectTimeout)
      reject(error)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(collectTimeout)
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
        if (isWindows && child.pid) {
          // taskkill /T kills the entire process tree so Chrome and
          // webpack-dev-server grandchildren don't linger as orphans.
          spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            stdio: 'ignore'
          })
        } else if (child.pid) {
          process.kill(-child.pid, 'SIGKILL')
        } else {
          child.kill('SIGKILL')
        }
      } catch {
        // Ignore cleanup failures.
      }
      finalize()
    }, 1500)

    child.once('close', finalize)
    child.once('exit', finalize)

    try {
      if (isWindows && child.pid) {
        // taskkill /T kills the entire process tree so Chrome and
        // webpack-dev-server grandchildren don't linger as orphans.
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore'
        })
      } else if (child.pid) {
        process.kill(-child.pid, 'SIGTERM')
      } else {
        child.kill('SIGTERM')
      }
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
        stdio: ['ignore', 'pipe', 'pipe'],
        ...(isWindows ? {shell: true} : {detached: true})
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

    // Inject SCAFFOLD_OVERRIDES before npm install so the resolver can't
    // pick up known-broken upstream patches that haven't been yanked yet.
    await injectScaffoldOverrides(projectDir)

    // `extension create` does not install project dependencies by default,
    // and `npm run dev` resolves the `extension` binary via
    // `node_modules/.bin`. Without an explicit install the dev script fails
    // on Windows (cmd cannot resolve `extension`) — Linux happens to find
    // a globally-installed copy on hosted runners, hiding the gap. Install
    // here so the regression check exercises the same flow on every OS.
    console.log(`[${template}] installing dependencies`)
    await runCollect({
      command: 'npm',
      commandArgs: ['install', '--no-audit', '--no-fund', '--silent'],
      cwd: projectDir,
      env,
      template,
      phase: 'install',
      failurePatterns: createFailurePatterns
    })

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
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
})
