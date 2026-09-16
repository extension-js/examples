#!/usr/bin/env node

import path from 'node:path'
import {
  SECOND_RUN_HINT,
  getExtensionSpec,
  hasBuiltManifest,
  parseExamplesArg,
  prepTempExample,
  run as runWithEnv
} from '../lib/install-harness.mjs'

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

const BUILD_ARGS = [
  'build',
  '--browser=chrome',
  '--silent',
  'true',
  '--no-telemetry'
]

const RUN_ENV = {
  CI: 'true',
  COREPACK_ENABLE_AUTO_PIN: '0',
  PNPM_CONFIG_FROZEN_LOCKFILE: 'false',
  npm_config_frozen_lockfile: 'false',
  // pnpm 11.0.7+ promoted "ignored build scripts" from a warning to a
  // fatal `ERR_PNPM_IGNORED_BUILDS`. Temp fixtures created here pull in
  // `@parcel/watcher` (transitive of `@rspack/dev-server@^2`) which has
  // an unapproved build script, so a fresh pnpm install in the fixture
  // dies before the canary even runs. Restore the pnpm 10 behaviour
  // (warn-only) so this guard exercises canary install paths, not
  // pnpm's policy-of-the-week.
  PNPM_CONFIG_STRICT_DEP_BUILDS: 'false'
}

function run(command, args, cwd) {
  return runWithEnv(command, args, cwd, RUN_ENV)
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
      result = await run(
        'pnpm',
        ['install', '--no-frozen-lockfile'],
        exampleDir
      )
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
  const pkg = `extension@${extensionSpec}`
  const argsByPm = {
    npm: [
      'install',
      '--save-dev',
      '--save-exact',
      pkg,
      '--no-audit',
      '--no-fund'
    ],
    pnpm: ['add', '-D', pkg],
    yarn: ['add', '-D', pkg],
    bun: ['add', '-d', pkg]
  }

  const result = await run(pm, argsByPm[pm], exampleDir)

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
    return run('pnpm', ['exec', 'extension', ...BUILD_ARGS], exampleDir)
  }

  if (pm === 'bun') {
    return run('bun', ['x', 'extension', ...BUILD_ARGS], exampleDir)
  }

  // npm/yarn install the local bin in node_modules/.bin. Executing the local
  // binary directly avoids PM-specific behavior differences.
  return run(localExtensionBinary(exampleDir), BUILD_ARGS, exampleDir)
}

async function runExecBuild(pm, exampleDir, extensionSpec) {
  const pkg = `extension@${extensionSpec}`

  if (pm === 'pnpm') {
    return run('pnpm', ['dlx', pkg, ...BUILD_ARGS], exampleDir)
  }

  if (pm === 'bun') {
    return run('bunx', [pkg, ...BUILD_ARGS], exampleDir)
  }

  // npm, and yarn: Yarn v1 does not support `yarn dlx`; use npx for exec-mode
  // parity.
  return run('npx', [pkg, ...BUILD_ARGS], exampleDir)
}

function assertBuildResult(r, exampleDir, failedReason) {
  if (r.code !== 0) return {ok: false, reason: failedReason}

  if (`${r.stdout}\n${r.stderr}`.includes(SECOND_RUN_HINT)) {
    return {ok: false, reason: 'second-run hint detected'}
  }

  if (!hasBuiltManifest(exampleDir)) {
    return {ok: false, reason: 'manifest missing'}
  }

  return {ok: true}
}

async function assertLocalInstallMode(slug, pm, extensionSpec) {
  const {exampleDir} = prepTempExample(slug)
  console.log(
    `\n=== ${slug}: ${pm} install + local extension (${extensionSpec}) ===`
  )

  const didInstallDeps = await installDependencies(pm, exampleDir)

  if (!didInstallDeps) {
    return {ok: false, reason: `${pm} dependency install failed`}
  }

  const didInstallExtension = await installExtension(
    pm,
    exampleDir,
    extensionSpec
  )

  if (!didInstallExtension) {
    return {ok: false, reason: `${pm} extension install failed`}
  }

  const r = await runInstalledBuild(pm, exampleDir)

  return assertBuildResult(r, exampleDir, 'build failed')
}

async function assertExecMode(slug, pm, extensionSpec) {
  const {exampleDir} = prepTempExample(slug)
  console.log(
    `\n=== ${slug}: ${pm} install + exec extension@${extensionSpec} ===`
  )

  const didInstallDeps = await installDependencies(pm, exampleDir)

  if (!didInstallDeps) {
    return {ok: false, reason: `${pm} dependency install failed`}
  }

  const r = await runExecBuild(pm, exampleDir, extensionSpec)

  return assertBuildResult(r, exampleDir, `${pm} exec build failed`)
}

async function main() {
  const examples = parseExamplesArg(defaultExamples)
  const packageManagers = parsePackageManagers()
  const extensionSpec = getExtensionSpec()
  let failures = 0

  console.log(`Extension spec under test: ${extensionSpec}`)
  console.log(`Package managers: ${packageManagers.join(', ')}`)
  console.log(`Examples: ${examples.join(', ')}`)

  // vue-loader requires webpack/lib/NormalModule at runtime; yarn v1 flat
  // hoisting does not expose webpack (a transitive dep of extension) to
  // vue-loader, so we skip vue examples when the package manager is yarn.
  const yarnSkip = new Set(['content-vue'])

  for (const pm of packageManagers) {
    for (const slug of examples) {
      if (pm === 'yarn' && yarnSkip.has(slug)) {
        console.log(`⊘ ${slug} skipped on yarn (vue-loader webpack hoisting)`)
        continue
      }

      const local = await assertLocalInstallMode(slug, pm, extensionSpec)

      if (!local.ok) {
        failures += 1
        console.error(
          `✖ ${slug} local-install mode failed (${pm}): ${local.reason}`
        )
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
