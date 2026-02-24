#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const examplesRoot = path.join(repoRoot, 'examples')
const OUTPUT_ROOTS = ['dist', 'build', '.extension']
const CHANNELS = ['chrome', 'chromium', 'chrome-mv3']
const supportedPms = new Set(['npm', 'pnpm', 'yarn', 'bun'])

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

function commandFor(tool) {
  if (process.platform !== 'win32') return tool
  if (tool === 'pnpm') return 'pnpm.cmd'
  if (tool === 'npm') return 'npm.cmd'
  if (tool === 'yarn') return 'yarn.cmd'
  if (tool === 'bun') return 'bun.exe'
  if (tool === 'bunx') return 'bunx.exe'
  if (tool === 'npx') return 'npx.cmd'
  return tool
}

function parseExamples() {
  const arg = process.argv.find((v) => v.startsWith('--examples='))
  if (!arg) return defaultExamples
  return arg
    .slice('--examples='.length)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function parsePackageManagers() {
  const pmIndex = process.argv.indexOf('--pm')
  const pmValue =
    pmIndex >= 0 && process.argv[pmIndex + 1] ? process.argv[pmIndex + 1] : ''

  if (!pmValue || pmValue === 'all') {
    return ['npm', 'pnpm', 'yarn', 'bun']
  }

  const requested = pmValue
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

  if (requested.length === 0) {
    return ['npm', 'pnpm', 'yarn', 'bun']
  }

  const invalid = requested.filter((pm) => !supportedPms.has(pm))
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported package manager(s): ${invalid.join(', ')}. Supported values: npm,pnpm,yarn,bun`
    )
  }

  return requested
}

function run(command, args, cwd, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(commandFor(command), args, {
      cwd,
      shell: process.platform === 'win32',
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        COREPACK_ENABLE_AUTO_PIN: '0',
        ...env
      }
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
  fs.rmSync(path.join(dst, 'node_modules'), {recursive: true, force: true})
  fs.rmSync(path.join(dst, 'dist'), {recursive: true, force: true})
  fs.rmSync(path.join(dst, 'build'), {recursive: true, force: true})
  fs.rmSync(path.join(dst, '.extension'), {recursive: true, force: true})
  return dst
}

async function installDependencies(pm, exampleDir) {
  if (pm === 'npm') {
    const result = await run(
      'npm',
      ['install', '--no-audit', '--no-fund'],
      exampleDir
    )
    return result.code === 0
  }

  if (pm === 'pnpm') {
    let result = await run('pnpm', ['install', '--frozen-lockfile'], exampleDir)
    if (result.code !== 0) {
      result = await run('pnpm', ['install', '--no-frozen-lockfile'], exampleDir)
    }
    return result.code === 0
  }

  if (pm === 'yarn') {
    let result = await run('yarn', ['install', '--immutable'], exampleDir)
    if (result.code !== 0) {
      result = await run('yarn', ['install'], exampleDir)
    }
    return result.code === 0
  }

  let result = await run('bun', ['install', '--frozen-lockfile'], exampleDir)
  if (result.code !== 0) {
    result = await run('bun', ['install'], exampleDir)
  }
  return result.code === 0
}

async function installExtension(pm, exampleDir, extensionSpec) {
  if (pm === 'npm') {
    const result = await run(
      'npm',
      [
        'install',
        '--save-dev',
        '--save-exact',
        `extension@${extensionSpec}`,
        '--no-audit',
        '--no-fund'
      ],
      exampleDir
    )
    return result.code === 0
  }

  if (pm === 'pnpm') {
    const result = await run(
      'pnpm',
      ['add', '-D', `extension@${extensionSpec}`],
      exampleDir
    )
    return result.code === 0
  }

  if (pm === 'yarn') {
    const result = await run(
      'yarn',
      ['add', '-D', `extension@${extensionSpec}`],
      exampleDir
    )
    return result.code === 0
  }

  const result = await run('bun', ['add', '-d', `extension@${extensionSpec}`], exampleDir)
  return result.code === 0
}

function localExtensionBinary(exampleDir) {
  if (process.platform === 'win32') {
    return path.join(exampleDir, 'node_modules', '.bin', 'extension.cmd')
  }
  return path.join(exampleDir, 'node_modules', '.bin', 'extension')
}

async function runInstalledBuild(pm, exampleDir) {
  if (pm === 'pnpm') {
    return run(
      'pnpm',
      ['exec', 'extension', 'build', '--browser=chrome', '--silent', 'true', '--no-telemetry'],
      exampleDir
    )
  }

  if (pm === 'bun') {
    return run(
      'bun',
      ['x', 'extension', 'build', '--browser=chrome', '--silent', 'true', '--no-telemetry'],
      exampleDir
    )
  }

  // npm/yarn/bun all install local bin in node_modules/.bin. Executing the
  // local binary directly avoids PM-specific behavior differences.
  return run(localExtensionBinary(exampleDir), ['build', '--browser=chrome', '--silent', 'true', '--no-telemetry'], exampleDir)
}

async function runExecBuild(pm, exampleDir, extensionSpec) {
  if (pm === 'pnpm') {
    return run(
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
      exampleDir
    )
  }

  if (pm === 'yarn') {
    // Yarn v1 does not support `yarn dlx`; use npx for exec-mode parity.
    return run(
      'npx',
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

  if (pm === 'bun') {
    return run(
      'bunx',
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

  return run(
    'npx',
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

async function assertLocalInstallMode(slug, pm, extensionSpec) {
  const exampleDir = prepTempExample(slug)
  console.log(`\n=== ${slug}: ${pm} install + local extension (${extensionSpec}) ===`)

  const didInstallDeps = await installDependencies(pm, exampleDir)
  if (!didInstallDeps) return {ok: false, reason: `${pm} dependency install failed`}

  const didInstallExtension = await installExtension(pm, exampleDir, extensionSpec)
  if (!didInstallExtension) {
    return {ok: false, reason: `${pm} extension install failed`}
  }

  const r = await runInstalledBuild(pm, exampleDir)
  if (r.code !== 0) return {ok: false, reason: 'build failed'}
  if (`${r.stdout}\n${r.stderr}`.includes(secondRunHint)) {
    return {ok: false, reason: 'second-run hint detected'}
  }
  if (!hasManifest(exampleDir)) return {ok: false, reason: 'manifest missing'}
  return {ok: true}
}

async function assertExecMode(slug, pm, extensionSpec) {
  const exampleDir = prepTempExample(slug)
  console.log(`\n=== ${slug}: ${pm} install + exec extension@${extensionSpec} ===`)

  const didInstallDeps = await installDependencies(pm, exampleDir)
  if (!didInstallDeps) return {ok: false, reason: `${pm} dependency install failed`}

  const r = await runExecBuild(pm, exampleDir, extensionSpec)
  if (r.code !== 0) return {ok: false, reason: `${pm} exec build failed`}
  if (`${r.stdout}\n${r.stderr}`.includes(secondRunHint)) {
    return {ok: false, reason: 'second-run hint detected'}
  }
  if (!hasManifest(exampleDir)) return {ok: false, reason: 'manifest missing'}
  return {ok: true}
}

function getConfiguredExtensionSpec() {
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

async function main() {
  const examples = parseExamples()
  const packageManagers = parsePackageManagers()
  const extensionSpec = getConfiguredExtensionSpec()
  let failures = 0

  console.log(`Extension spec under test: ${extensionSpec}`)
  console.log(`Package managers: ${packageManagers.join(', ')}`)
  console.log(`Examples: ${examples.join(', ')}`)

  for (const pm of packageManagers) {
    for (const slug of examples) {
      const local = await assertLocalInstallMode(slug, pm, extensionSpec)
      if (!local.ok) {
        failures += 1
        console.error(`✖ ${slug} local-install mode failed (${pm}): ${local.reason}`)
      } else {
        console.log(`✔ ${slug} local-install mode passed (${pm})`)
      }

      const exec = await assertExecMode(slug, pm, extensionSpec)
      if (!exec.ok) {
        failures += 1
        console.error(`✖ ${slug} exec mode failed (${pm}): ${exec.reason}`)
      } else {
        console.log(`✔ ${slug} exec mode passed (${pm})`)
      }
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
