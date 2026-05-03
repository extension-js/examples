// Local canary publisher for reload-matrix remote-mode validation.
//
// What this script does, in order:
//   1. Computes a canary version string in the same shape as the CI workflow
//      (`<base>-canary.local-<short-sha>`) so the published version is
//      regex-compatible with publish-release.yml's validator.
//   2. Snapshots the four package.json files we are about to mutate.
//   3. Bumps every package's `version` to the canary version.
//   4. Rewrites `programs/extension/package.json`'s three `workspace:*`
//      cross-deps (`extension-create`, `extension-develop`, `extension-install`)
//      to the canary version so the published artifact resolves siblings via
//      npm rather than via pnpm workspace protocol.
//   5. Builds each package and mirrors built-in companion extensions into
//      `programs/develop/dist/` via `scripts/build-extensions.cjs`.
//   6. Writes a temporary `.npmrc` with `NPM_TOKEN` (read from the monorepo
//      root `.env`) and publishes the four packages with `--tag canary` in
//      dependency order so dependents see siblings on the registry.
//   7. Verifies via `npm view <pkg>@canary version`.
//   8. Restores the original package.json files no matter how step 5–7 exit.
//
// The temp `.npmrc` and the version mutations are reverted in a finally block.
// The published canary version stays on npm permanently (npm allows
// `unpublish` for 72 h but leaves a tombstone), which is the explicit reason
// the script logs the version it's about to publish before any side effects.

import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  existsSync
} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execSync, spawnSync} from 'node:child_process'

const HARNESS_DIR = dirname(fileURLToPath(import.meta.url))
const MONOREPO_ROOT = resolve(HARNESS_DIR, '..', '..', '..', '..')
const ENV_PATH = join(MONOREPO_ROOT, '.env')

const PACKAGES = [
  // Order matters: dependents publish AFTER dependencies so consumers can
  // resolve them while we publish the umbrella `extension` package last.
  {
    dir: join(MONOREPO_ROOT, 'programs/create'),
    name: 'extension-create'
  },
  {
    dir: join(MONOREPO_ROOT, 'programs/develop'),
    name: 'extension-develop'
  },
  {
    dir: join(MONOREPO_ROOT, 'programs/install'),
    name: 'extension-install'
  },
  {
    dir: join(MONOREPO_ROOT, 'programs/extension'),
    name: 'extension'
  }
]

const CROSS_DEPS = [
  'extension-create',
  'extension-develop',
  'extension-install'
]

function readEnvFile(path) {
  if (!existsSync(path)) {
    throw new Error(
      `Expected NPM_TOKEN in ${path} but the file does not exist. ` +
        `Reload-matrix canary publish needs that token.`
    )
  }
  const out = {}
  for (const rawLine of readFileSync(path, 'utf-8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    out[key] = value
  }
  return out
}

function shortSha() {
  return execSync('git rev-parse --short=10 HEAD', {
    cwd: MONOREPO_ROOT,
    encoding: 'utf-8'
  }).trim()
}

function readPackageJson(pkgDir) {
  return JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf-8'))
}

function writePackageJson(pkgDir, json) {
  writeFileSync(
    join(pkgDir, 'package.json'),
    JSON.stringify(json, null, 2) + '\n'
  )
}

function bumpVersionsAndDeps(version) {
  const restorers = []
  for (const pkg of PACKAGES) {
    const original = readFileSync(join(pkg.dir, 'package.json'), 'utf-8')
    restorers.push(() => writeFileSync(join(pkg.dir, 'package.json'), original))
    const json = JSON.parse(original)
    json.version = version
    if (pkg.name === 'extension' && json.dependencies) {
      for (const depName of CROSS_DEPS) {
        if (
          json.dependencies[depName] &&
          /^workspace:/.test(json.dependencies[depName])
        ) {
          json.dependencies[depName] = version
        }
      }
    }
    writePackageJson(pkg.dir, json)
  }
  return () => {
    for (const restore of restorers) restore()
  }
}

function compileAll() {
  // Build sequence mirrors .github/workflows/publish-release.yml so the
  // local canary contains identical artifacts to a CI canary publish.
  const order = [
    'extension-develop',
    'extension-create',
    'extension-install',
    'extension'
  ]
  for (const pkg of order) {
    console.log(`[canary] compiling ${pkg}...`)
    const result = spawnSync('pnpm', ['--filter', pkg, 'compile'], {
      cwd: MONOREPO_ROOT,
      stdio: 'inherit'
    })
    if (result.status !== 0) throw new Error(`compile failed for ${pkg}`)
  }
  console.log('[canary] mirroring companion extensions...')
  const mirror = spawnSync('node', ['scripts/build-extensions.cjs'], {
    cwd: MONOREPO_ROOT,
    stdio: 'inherit'
  })
  if (mirror.status !== 0) throw new Error('companion mirror failed')
}

function setupNpmrc(token) {
  const dir = mkdtempSync(join(tmpdir(), 'reload-matrix-npmrc-'))
  const path = join(dir, '.npmrc')
  writeFileSync(
    path,
    [
      'registry=https://registry.npmjs.org/',
      `//registry.npmjs.org/:_authToken=${token}`,
      'always-auth=true',
      ''
    ].join('\n'),
    {mode: 0o600}
  )
  return {path, cleanup: () => rmSync(dir, {recursive: true, force: true})}
}

function isAlreadyPublished(pkg, expectedVersion) {
  // Avoid double-publish errors when the script reruns after a partial
  // failure: the same canary version is idempotent if it's already on npm.
  const result = spawnSync(
    'npm',
    ['view', `${pkg.name}@${expectedVersion}`, 'version'],
    {cwd: MONOREPO_ROOT, encoding: 'utf-8'}
  )
  return (result.stdout || '').trim() === expectedVersion
}

function publishPackage(pkg, npmrcPath, expectedVersion) {
  if (isAlreadyPublished(pkg, expectedVersion)) {
    console.log(
      `[canary] ${pkg.name}@${expectedVersion} already on npm; skipping publish`
    )
    return
  }
  console.log(`[canary] publishing ${pkg.name}...`)
  const result = spawnSync(
    'npm',
    [
      'publish',
      '--access',
      'public',
      '--tag',
      'canary',
      '--no-git-checks',
      '--userconfig',
      npmrcPath
    ],
    {cwd: pkg.dir, stdio: 'inherit'}
  )
  if (result.status !== 0) throw new Error(`publish failed for ${pkg.name}`)
}

async function verifyPublished(pkg, expectedVersion) {
  // Direct `npm view <pkg>@<version> version` hits a 404 for ~30 s after a
  // fresh publish because the registry's CDN replicates the version manifest
  // separately from the dist-tag pointer. The dist-tag write is consistent
  // across regions instantly, so we poll on `dist-tags.canary` and treat the
  // tag pointing at our version as confirmation.
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const result = spawnSync('npm', ['view', pkg.name, 'dist-tags.canary'], {
      cwd: MONOREPO_ROOT,
      encoding: 'utf-8'
    })
    const output = (result.stdout || '').trim()
    if (output === expectedVersion) {
      console.log(`[canary] verified ${pkg.name}@${expectedVersion}`)
      return
    }
    await new Promise((r) => setTimeout(r, 2_000))
  }
  throw new Error(
    `verification timed out for ${pkg.name}@${expectedVersion}: ` +
      `dist-tags.canary did not become "${expectedVersion}" within 60s`
  )
}

async function main() {
  const env = readEnvFile(ENV_PATH)
  const token = env.NPM_TOKEN
  if (!token) {
    throw new Error(`NPM_TOKEN missing from ${ENV_PATH}`)
  }

  const baseVersion = readPackageJson(PACKAGES[3].dir).version.replace(
    /-.+$/,
    ''
  )
  const sha = shortSha()
  const version = `${baseVersion}-canary.local-${sha}`

  console.log(
    '================================================================'
  )
  console.log(' Local canary publish')
  console.log(
    '================================================================'
  )
  console.log(` version : ${version}`)
  console.log(` packages: ${PACKAGES.map((p) => p.name).join(', ')}`)
  console.log(` tag     : canary  (latest tag UNAFFECTED)`)
  console.log(' provenance: skipped (OIDC not available outside CI)')
  console.log(
    '================================================================'
  )
  console.log()

  const restoreVersions = bumpVersionsAndDeps(version)
  let npmrc
  let publishedAny = false
  try {
    compileAll()
    npmrc = setupNpmrc(token)
    for (const pkg of PACKAGES) {
      publishPackage(pkg, npmrc.path, version)
      publishedAny = true
      await verifyPublished(pkg, version)
    }
    console.log()
    console.log('[canary] success: all 4 packages published as @canary')
    console.log(`[canary] published version: ${version}`)
    if (process.env.RELOAD_MATRIX_OUTPUT_VERSION_FILE) {
      writeFileSync(process.env.RELOAD_MATRIX_OUTPUT_VERSION_FILE, version)
    }
  } catch (err) {
    console.error('[canary] FAILED:', err.message)
    if (publishedAny) {
      console.error(
        '[canary] WARNING: at least one package was published before the ' +
          'failure. The npm registry now has a partial canary; running this ' +
          'script again will re-publish only the missing pieces if the ' +
          'version stayed identical (it did, since the SHA did not change).'
      )
    }
    throw err
  } finally {
    if (npmrc) {
      try {
        npmrc.cleanup()
      } catch {
        // best-effort
      }
    }
    restoreVersions()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
