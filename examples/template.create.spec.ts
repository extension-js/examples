// Template create + first-run test
//
// For each built-in template, verifies:
//   1. Scaffolding produces a valid project (manifest.json + package.json)
//   2. Dependencies install without errors
//   3. Production build succeeds and emits manifest.json
//
// Uses the LOCAL examples as the template source (no network).
// Runs in a temporary directory so tests are fully isolated.

import {test, expect} from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {execSync} from 'child_process'
import {getDirname} from './dirname.js'
import {ALL_TEMPLATES, SUPPORTED_BROWSERS} from './data.js'

const __dirname = getDirname(import.meta.url)
const repoRoot = path.resolve(__dirname, '..', '..', '..')
const localCliCjs = path.resolve(repoRoot, 'programs', 'cli', 'dist', 'cli.cjs')

function hasLocalCli(): boolean {
  return fs.existsSync(localCliCjs)
}

function copyTemplate(templateName: string, dest: string) {
  const src = path.join(__dirname, templateName)
  if (!fs.existsSync(src)) throw new Error(`Template dir not found: ${src}`)
  fs.cpSync(src, dest, {recursive: true})
}

function readJSON(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

const OUTPUT_ROOTS = ['dist', 'build', '.extension']
const OUTPUT_CHANNELS = ['chrome', 'chromium', 'chrome-mv3', 'firefox', 'edge']

function findOutputManifest(projectDir: string): string | null {
  for (const root of OUTPUT_ROOTS) {
    for (const channel of OUTPUT_CHANNELS) {
      const candidate = path.join(projectDir, root, channel, 'manifest.json')
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}

// Pick a representative subset: one per UI context + one CSS variant + one framework
const TEMPLATES_TO_TEST = ALL_TEMPLATES.filter((t) =>
  [
    'content',
    'action',
    'new',
    'sidebar',
    'javascript',
    'react',
    'typescript',
    'content-css-modules',
    'content-sass'
  ].includes(t.name)
)

test.describe('template: create and first build', () => {
  test.describe.configure({mode: 'serial', timeout: 180000})

  for (const template of TEMPLATES_TO_TEST) {
    const templateName = template.name

    test.describe(templateName, () => {
      let tmpDir: string

      test.beforeAll(() => {
        tmpDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `extjs-create-${templateName}-`)
        )
      })

      test.afterAll(() => {
        try {
          fs.rmSync(tmpDir, {recursive: true, force: true})
        } catch {
          // best-effort
        }
      })

      test('scaffold produces manifest.json and package.json', () => {
        const projectDir = path.join(tmpDir, templateName)
        copyTemplate(templateName, projectDir)

        expect(
          fs.existsSync(path.join(projectDir, 'package.json')),
          `${templateName}: missing package.json after scaffold`
        ).toBe(true)

        // manifest.json can be at root or in src/
        const manifestPaths = [
          path.join(projectDir, 'manifest.json'),
          path.join(projectDir, 'src', 'manifest.json')
        ]
        const hasManifest = manifestPaths.some((p) => fs.existsSync(p))
        expect(
          hasManifest,
          `${templateName}: missing manifest.json (checked root and src/)`
        ).toBe(true)
      })

      test('dependencies install', () => {
        const projectDir = path.join(tmpDir, templateName)
        if (!fs.existsSync(path.join(projectDir, 'package.json'))) {
          test.skip()
          return
        }

        try {
          execSync('pnpm install --no-frozen-lockfile', {
            cwd: projectDir,
            stdio: 'pipe',
            timeout: 120000,
            env: {
              ...process.env,
              // Prevent interactive prompts
              CI: '1'
            }
          })
        } catch (error) {
          throw new Error(
            `${templateName}: pnpm install failed: ${(error as Error).message}`
          )
        }

        expect(
          fs.existsSync(path.join(projectDir, 'node_modules')),
          `${templateName}: node_modules missing after install`
        ).toBe(true)
      })

      test('production build succeeds', () => {
        test.skip(!hasLocalCli(), 'local CLI not compiled')

        const projectDir = path.join(tmpDir, templateName)
        if (!fs.existsSync(path.join(projectDir, 'node_modules'))) {
          test.skip()
          return
        }

        // Framework templates have monorepo-linked deps that don't resolve
        // in isolated tmpdirs. Their builds are covered by multi-browser suite.
        const frameworkTemplates = ['react', 'preact', 'vue', 'svelte']
        if (frameworkTemplates.some((f) => templateName.includes(f))) {
          test.skip()
          return
        }

        try {
          execSync(`node ${localCliCjs} build ${projectDir} --browser=chrome`, {
            cwd: projectDir,
            stdio: 'pipe',
            timeout: 120000,
            env: {
              ...process.env,
              EXTENSION_ENV: 'test',
              EXTENSION_DEVELOP_ROOT: path.resolve(
                repoRoot,
                'programs',
                'develop'
              )
            }
          })
        } catch (error) {
          throw new Error(
            `${templateName}: build failed: ${(error as Error).message}`
          )
        }

        const outputManifest = findOutputManifest(projectDir)
        expect(
          outputManifest,
          `${templateName}: no manifest.json in build output`
        ).not.toBeNull()

        const manifest = readJSON(outputManifest!)
        expect(manifest.manifest_version).toBeDefined()
      })
    })
  }
})
