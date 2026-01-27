#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..'
)

const examplesDir = path.join(repoRoot, 'examples')

// Some environments (sandboxed CI runners, editors, etc.) may not allow writing
// to the user's home directory. The Extension.js CLI writes telemetry under
// $XDG_CONFIG_HOME (or ~/.config), so we default it to a repo-local folder to
// keep builds reliable.
const XDG_CONFIG_HOME =
  process.env.XDG_CONFIG_HOME || path.join(repoRoot, '.xdg-config')
try {
  fs.mkdirSync(XDG_CONFIG_HOME, {recursive: true})
} catch {
  // Do nothing (we still pass it through; if it fails, the underlying tool will error)
}

// Parallel execution limit (reduced to prevent race conditions in extension CLI)
// The extension CLI has path resolution issues when too many builds run in parallel
const MAX_CONCURRENT = process.env.CI ? 2 : 4

function run(command, args, workingDirectory) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workingDirectory,
      stdio: 'inherit',
      env: {...process.env, XDG_CONFIG_HOME},
      shell: false
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (exitCode) => {
      resolve(exitCode === 0)
    })
  })
}

function listExamples(filter = null) {
  const allExamples = fs
    .readdirSync(examplesDir, {withFileTypes: true})
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort()

  if (!filter) {
    return allExamples
  }

  // Filter can be:
  // 1. A comma-separated list of example names: "content,sidebar,action"
  // 2. A regex pattern string: "^content|^sidebar"
  // 3. An array of example names (when called programmatically)
  if (Array.isArray(filter)) {
    return allExamples.filter((example) => filter.includes(example))
  }

  if (typeof filter === 'string') {
    // Check if it's a comma-separated list
    if (filter.includes(',')) {
      const filterList = filter.split(',').map((s) => s.trim())
      return allExamples.filter((example) => filterList.includes(example))
    }
    // Otherwise treat as regex pattern
    const regex = new RegExp(filter)
    return allExamples.filter((example) => regex.test(example))
  }

  return allExamples
}

async function buildExample(slug, browser) {
  const exampleDirectory = path.resolve(path.join(examplesDir, slug))
  console.log(`►►► \n=== Building ${slug} [${browser}] ===`)

  // Guardrail: example builds must never create a temporary root manifest.json.
  // Extension.js resolves src/manifest.json recursively.
  const rootManifestPath = path.join(exampleDirectory, 'manifest.json')
  const hadRootManifestBefore = fs.existsSync(rootManifestPath)

  // Verify the example directory exists
  if (!fs.existsSync(exampleDirectory)) {
    console.error(
      `►►► Error: Example directory does not exist: ${exampleDirectory}`
    )
    return {slug, browser, ok: false, error: 'Directory not found'}
  }

  try {
    // Use absolute path for the script to avoid resolution issues
    const scriptPath = path.resolve(
      path.join(repoRoot, 'ci-scripts', 'build-with-manifest.mjs')
    )

    const runBuildOnce = () =>
      new Promise((resolve) => {
        const child = spawn(
          'node',
          [scriptPath, 'build', `--browser=${browser}`],
          {
            cwd: exampleDirectory,
            stdio: ['inherit', 'pipe', 'pipe'],
            env: {...process.env, XDG_CONFIG_HOME},
            shell: false
          }
        )

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

        child.on('close', (exitCode) => {
          const hasRootManifestAfter = fs.existsSync(rootManifestPath)
          if (!hadRootManifestBefore && hasRootManifestAfter) {
            console.error(
              `►►► \nError: Unexpected root manifest.json created during build: ${rootManifestPath}`
            )
            process.exit(1)
          }

          if (exitCode !== 0) {
            console.error(`►►► \nError: Build failed for ${slug} [${browser}]`)
            console.error(`►►► Exit code: ${exitCode}`)
            if (stderr) {
              console.error(`►►► \n--- Stderr output ---`)
              stderr.split('\n').forEach((line) => {
                if (line.trim()) {
                  console.error(`►►► ${line}`)
                }
              })
            }
            if (
              stdout &&
              (stdout.includes('Error') || stdout.includes('error'))
            ) {
              console.error(`►►► \n--- Relevant stdout output ---`)
              // Only show lines with errors
              const errorLines = stdout
                .split('\n')
                .filter(
                  (line) =>
                    line.toLowerCase().includes('error') ||
                    line.toLowerCase().includes('failed') ||
                    line.toLowerCase().includes('exception')
                )
              if (errorLines.length > 0) {
                errorLines.forEach((line) => {
                  console.error(`►►► ${line}`)
                })
              }
            }
          }

          resolve({
            ok: exitCode === 0,
            stdout,
            stderr
          })
        })

        child.on('error', (error) => {
          console.error(
            `►►► \nError: Failed to start build for ${slug} [${browser}]:`,
            error.message
          )
          resolve({ok: false, stdout: '', stderr: error.message})
        })
      })

    // Run build until outputs exist or retries exhausted.
    const maxAttempts = process.env.CI ? 3 : 2
    let result = {ok: false, stdout: '', stderr: ''}
    let hasOutputs = false

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        console.log(
          `►►► Retrying build for ${slug} [${browser}] (attempt ${attempt}/${maxAttempts})...`
        )
      }

      result = await runBuildOnce()
      hasOutputs = hasBuiltManifest(exampleDirectory, browser)

      if (hasOutputs) break

      if (!result.stdout.includes('Run the command again to proceed')) {
        // Avoid tight loop; give filesystem a moment to settle.
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }

    if (!hasOutputs) {
      console.error(
        `►►► \nError: Build did not produce a manifest for ${slug} [${browser}]`
      )
      return {slug, browser, ok: false, error: 'manifest missing'}
    }

    return {slug, browser, ok: result.ok}
  } catch (error) {
    console.error(`►►► Error building ${slug} [${browser}]:`, error)
    return {slug, browser, ok: false, error: error.message}
  }
}

async function runParallel(tasks, limit) {
  const allTaskResults = []
  const executingTasks = []

  for (const task of tasks) {
    const taskPromise = task().then((taskResult) => {
      executingTasks.splice(executingTasks.indexOf(taskPromise), 1)
      return taskResult
    })

    allTaskResults.push(taskPromise)
    executingTasks.push(taskPromise)

    if (executingTasks.length >= limit) {
      await Promise.race(executingTasks)
    }
  }

  return Promise.all(allTaskResults)
}

const browsers = ['chrome', 'edge', 'firefox']

const OUTPUT_ROOTS = ['dist', 'build', '.extension']
const CHANNELS_BY_BROWSER = {
  chrome: ['chrome', 'chromium', 'chrome-mv3'],
  edge: ['edge'],
  firefox: ['firefox']
}

function hasBuiltManifest(exampleDirectory, browser) {
  const baseDirs = [exampleDirectory]
  const monorepoExtensionDir = path.join(
    exampleDirectory,
    'packages',
    'extension'
  )
  if (fs.existsSync(monorepoExtensionDir)) {
    baseDirs.push(monorepoExtensionDir)
  }
  const channels = CHANNELS_BY_BROWSER[browser] || [browser]

  for (const baseDir of baseDirs) {
    for (const root of OUTPUT_ROOTS) {
      for (const channel of channels) {
        const manifestPath = path.join(baseDir, root, channel, 'manifest.json')
        if (fs.existsSync(manifestPath)) return true
      }
    }
  }
  return false
}

// Parse command-line arguments for filtering
// Usage: node build-all.mjs [--filter="content,sidebar"] or [--filter="^content|^sidebar"]
const filterArg = process.argv.find((arg) => arg.startsWith('--filter='))
const filter = filterArg ? filterArg.split('=')[1] : null

const slugs = listExamples(filter)

if (slugs.length === 0) {
  console.log('►►► No examples found to build.')
  process.exit(0)
}

console.log(
  `►►► Building ${slugs.length} examples × ${browsers.length} browsers = ${slugs.length * browsers.length} builds`
)
console.log(`►►► Using ${MAX_CONCURRENT} parallel workers\n`)

// Install workspace dependencies at root level first to prevent lockfile conflicts
// This ensures the lockfile is stable before parallel example builds
// Skip if node_modules already exists (e.g., in CI where dependencies are cached)
const nodeModulesPath = path.join(repoRoot, 'node_modules')
if (!fs.existsSync(nodeModulesPath)) {
  console.log('►►► Installing workspace dependencies at root level...')
  try {
    const rootInstallSuccess = await run(
      'pnpm',
      ['install', '--frozen-lockfile', '--prod=false'],
      repoRoot
    )
    if (!rootInstallSuccess) {
      console.error(
        '►►► \nError: Failed to install workspace dependencies. Retrying without --frozen-lockfile...'
      )
      const retrySuccess = await run('pnpm', ['install', '--prod=false'], repoRoot)
      if (!retrySuccess) {
        console.error(
          '►►► \nError: Failed to install workspace dependencies after retry. Aborting builds.'
        )
        process.exit(1)
      }
    }
    console.log('►►► [SUCCESS] Workspace dependencies installed successfully\n')
  } catch (error) {
    console.error(
      '►►► \nError: Failed to install workspace dependencies:',
      error.message
    )
    console.error('►►►    Aborting builds to prevent cascading failures.')
    process.exit(1)
  }
} else {
  console.log(
    '►►► Workspace dependencies already installed, skipping root install...\n'
  )
}

// Create build tasks grouped by example to prevent cross-contamination
// Build all browsers for the same example sequentially, but different examples in parallel
const tasks = []
for (const slug of slugs) {
  // Create a task that builds all browsers for this example sequentially
  tasks.push(async () => {
    const exampleDirectory = path.resolve(path.join(examplesDir, slug))
    const packageJsonPath = path.join(exampleDirectory, 'package.json')
    let installSuccess = true // Default to true if no package.json exists

    // Install example-specific dependencies (workspace deps already installed)
    if (fs.existsSync(packageJsonPath)) {
      const maxRetries = 3
      installSuccess = false

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (attempt > 1) {
          console.log(
            `►►► \nRetrying dependency installation for ${slug} (attempt ${attempt}/${maxRetries})...`
          )
          // Wait a bit before retry to avoid immediate conflicts
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        } else {
          console.log(`►►► \nInstalling dependencies for ${slug}...`)
        }

        try {
          // Install from example directory - workspace deps already installed at root
          // Use --frozen-lockfile to prevent lockfile updates (workspace install already handled it)
            installSuccess = await run(
              'pnpm',
              ['install', '--frozen-lockfile', '--prod=false'],
              exampleDirectory
            )

          if (installSuccess) {
            break
          } else if (attempt === maxRetries) {
            // Last attempt: try without --frozen-lockfile as fallback
            // Workspace deps are already installed, so this should be safe
            console.log(
              `►►► \n[WARNING] Retrying ${slug} without --frozen-lockfile as final attempt...`
            )
            installSuccess = await run(
              'pnpm',
              ['install', '--prod=false'],
              exampleDirectory
            )
            if (!installSuccess) {
              console.error(
                `►►► \nError: Failed to install dependencies for ${slug} after ${maxRetries} attempts + fallback`
              )
              console.error(
                `►►►    This is a fatal error - build cannot proceed without dependencies`
              )
            }
          }
        } catch {
          if (attempt === maxRetries) {
            // Last attempt: try without --frozen-lockfile as fallback
            try {
              console.log(
                `\n[WARNING] Retrying ${slug} without --frozen-lockfile as final attempt...`
              )
              installSuccess = await run(
                'pnpm',
                ['install', '--prod=false'],
                exampleDirectory
              )
            } catch (fallbackError) {
              console.error(
                `►►► \nError: Failed to install dependencies for ${slug} after ${maxRetries} attempts + fallback:`,
                fallbackError.message
              )
            }
          }
        }
      }
    }

    // If dependency installation failed, mark all browsers as failed
    if (!installSuccess) {
      console.error(
        `►►► \nError: Skipping builds for ${slug} due to dependency installation failure`
      )
      return browsers.map((browser) => ({
        slug,
        browser,
        ok: false,
        error: 'Dependency installation failed'
      }))
    }

    const browserResults = []
    for (const browser of browsers) {
      const browserResult = await buildExample(slug, browser)
      browserResults.push(browserResult)
    }
    return browserResults
  })
}

// Run example builds in parallel (each example builds all browsers sequentially)
const exampleResults = await runParallel(tasks, MAX_CONCURRENT)

// Flatten results
const allBuildResults = exampleResults.flat()

console.log('►►► \nBuild summary:')

let chromeBuildFailures = 0
let nonChromeBuildFailures = 0

for (const buildResult of allBuildResults) {
  const statusMark = buildResult.ok ? '[OK]' : '[FAIL]'

  if (!buildResult.ok) {
    // Chrome builds are critical (used for tests), Edge/Firefox are optional
    if (buildResult.browser === 'chrome') {
      chromeBuildFailures++
    } else {
      nonChromeBuildFailures++
    }
  }

  console.log(`►►► ${statusMark} ${buildResult.slug} [${buildResult.browser}]`)
}

// Only fail CI if Chrome builds fail (Chrome is used for tests)
// Edge/Firefox builds are optional and failures are non-blocking
if (chromeBuildFailures > 0) {
  console.log(
    `►►► \nError: ${chromeBuildFailures} Chrome build(s) failed (critical - used for tests)`
  )
  process.exit(1)
}

if (nonChromeBuildFailures > 0) {
  console.log(
    `►►► \n[WARNING] ${nonChromeBuildFailures} Edge/Firefox build(s) failed (non-blocking - not used for tests)`
  )
  console.log(
    `►►►    Check the error output above for details. These builds are optional since tests only run on Chrome.`
  )
}
