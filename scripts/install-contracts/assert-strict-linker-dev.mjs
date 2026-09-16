#!/usr/bin/env node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  examplesRoot,
  getExtensionSpec,
  run,
  runDevUntilReady
} from '../lib/install-harness.mjs'

const baseFailureHints = [
  'compiled with errors',
  'Module parse failed',
  'JavaScript parse error',
  'Unhandled rejection',
  "Can't resolve '@rspack/dev-server",
  "Can't resolve 'webpack/hot/dev-server"
]

const COREPACK_ENV = {
  COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
  COREPACK_ENABLE_AUTO_PIN: '0'
}

const LINKERS = {
  'yarn-pnp': {
    title: 'Yarn PnP dev regression check (issue #486)',
    example: 'typescript',
    failureHints: [
      ...baseFailureHints,
      'Module not found',
      "Can't resolve '@rspack/core",
      "Can't resolve 'Extension.js/hot/dev-server"
    ],
    env: COREPACK_ENV,
    prepare(workDir, extensionSpec) {
      for (const junk of ['node_modules', 'dist', '.extension', '.yarn']) {
        fs.rmSync(path.join(workDir, junk), {recursive: true, force: true})
      }

      for (const lock of [
        'pnpm-lock.yaml',
        'package-lock.json',
        'yarn.lock',
        '.pnp.cjs',
        '.pnp.loader.mjs'
      ]) {
        fs.rmSync(path.join(workDir, lock), {force: true})
      }

      const pkgPath = path.join(workDir, 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

      pkg.packageManager = process.env.YARN_VERSION
        ? `yarn@${process.env.YARN_VERSION}`
        : 'yarn@4.17.1'

      pkg.devDependencies = pkg.devDependencies || {}
      pkg.devDependencies.extension = extensionSpec

      const developTarball = process.env.EXTENSION_DEVELOP_TARBALL?.trim()

      if (developTarball) {
        const abs = path.resolve(developTarball)

        if (!fs.existsSync(abs)) {
          throw new Error(`EXTENSION_DEVELOP_TARBALL not found: ${abs}`)
        }

        pkg.resolutions = {
          ...(pkg.resolutions || {}),
          'extension-develop': `file:${abs}`
        }

        console.log(`Overriding extension-develop -> ${abs}`)
      }

      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

      fs.writeFileSync(
        path.join(workDir, '.yarnrc.yml'),
        [
          'nodeLinker: pnp',
          'enableGlobalCache: true',
          'npmMinimalAgeGate: 0',
          ''
        ].join('\n')
      )
    },
    install: {command: 'yarn', args: ['install'], label: 'yarn install (PnP)'},
    dev: {
      command: 'yarn',
      args: ['exec', 'extension', 'dev', '.', '--no-browser', '--no-telemetry'],
      label: 'yarn exec extension dev . --no-browser'
    }
  },
  'pnpm-monorepo': {
    title: 'pnpm monorepo dev regression check',
    example: 'sidebar-monorepo-turborepo',
    failureHints: baseFailureHints,
    env: {
      PNPM_CONFIG_FROZEN_LOCKFILE: 'false',
      npm_config_frozen_lockfile: 'false'
    },
    prepare(workDir, extensionSpec) {
      fs.rmSync(path.join(workDir, 'node_modules'), {
        recursive: true,
        force: true
      })

      // Remove stale lockfiles so pnpm resolves fresh
      for (const lock of ['pnpm-lock.yaml', 'package-lock.json']) {
        fs.rmSync(path.join(workDir, lock), {force: true})
      }

      // Inject `extension` as a root devDependency
      const pkgPath = path.join(workDir, 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

      pkg.devDependencies = pkg.devDependencies || {}
      pkg.devDependencies.extension = extensionSpec

      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    },
    install: {
      command: 'pnpm',
      args: ['install', '--no-frozen-lockfile'],
      label: 'pnpm install'
    },
    dev: {
      command: 'pnpm',
      args: [
        'exec',
        'extension',
        'dev',
        'packages/extension',
        '--no-browser',
        '--no-telemetry'
      ],
      label: 'extension dev packages/extension --no-browser'
    }
  }
}

function parseLinker() {
  const arg = process.argv.find((value) => value.startsWith('--linker='))
  const name = arg?.slice('--linker='.length)

  if (!name || !LINKERS[name]) {
    console.error(
      `Usage: node scripts/install-contracts/assert-strict-linker-dev.mjs --linker=<${Object.keys(LINKERS).join('|')}>`
    )

    process.exit(1)
  }

  return LINKERS[name]
}

async function main(linker) {
  const exampleSource = path.join(examplesRoot, linker.example)

  if (!fs.existsSync(exampleSource)) {
    throw new Error(`Example not found: ${exampleSource}`)
  }

  const extensionSpec = getExtensionSpec()
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'extjs-linker-'))
  const workDir = path.join(tempRoot, linker.example)

  try {
    console.log(`\n══ ${linker.title} ══`)
    console.log(`Extension spec: ${extensionSpec}`)
    console.log(`Temp workspace: ${workDir}\n`)

    fs.cpSync(exampleSource, workDir, {recursive: true})
    linker.prepare(workDir, extensionSpec)

    console.log(`► ${linker.install.label}`)
    const install = await run(
      linker.install.command,
      linker.install.args,
      workDir,
      linker.env,
      {stdin: 'ignore'}
    )

    if (install.code !== 0) {
      throw new Error(`${linker.install.label} failed (code ${install.code})`)
    }

    console.log(`\n► ${linker.dev.label}`)
    const dev = await runDevUntilReady(
      linker.dev.command,
      linker.dev.args,
      workDir,
      {env: linker.env, failureHints: linker.failureHints}
    )

    if (dev.code !== 0) {
      throw new Error(`Dev failed (code ${dev.code}).\n${dev.error || ''}`)
    }

    console.log(`\n✔ ${linker.title} passed`)
  } finally {
    try {
      fs.rmSync(tempRoot, {recursive: true, force: true})
    } catch {
      /* ignore */
    }
  }
}

const linker = parseLinker()
main(linker).catch((err) => {
  console.error(`\n✖ ${linker.title} failed`)
  console.error(err)
  process.exit(1)
})
