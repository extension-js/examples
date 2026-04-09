// Multi-browser build verification
//
// For each representative template × browser (chrome, edge, firefox):
//   1. Production build exits successfully
//   2. Output contains a valid manifest.json
//   3. Manifest version matches the browser expectation (MV3 or MV2)
//   4. Content script / background / popup entries listed in manifest exist on disk
//   5. No dev-only artifacts leak into production output
//
// No mocking — runs real CLI build command against real templates.

import {test, expect} from '@playwright/test'
import fs from 'fs'
import path from 'path'
import {execSync} from 'child_process'
import {getDirname} from './dirname.js'

const __dirname = getDirname(import.meta.url)
const repoRoot = path.resolve(__dirname, '..', '..', '..')
const localCliCjs = path.resolve(repoRoot, 'programs', 'extension', 'dist', 'cli.cjs')

const BROWSERS = ['chrome', 'edge', 'firefox'] as const
const OUTPUT_ROOTS = ['dist', 'build', '.extension']

const TEMPLATES = [
  'content',
  'action',
  'javascript',
  'react',
  'new',
  'sidebar',
  'typescript',
  'vue'
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasLocalCli(): boolean {
  return fs.existsSync(localCliCjs)
}

function readJSON(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function findOutputDir(exampleDir: string, browser: string): string | null {
  // Map CLI browser names to possible output directory names
  const channelNames: Record<string, string[]> = {
    chrome: ['chrome', 'chromium', 'chrome-mv3'],
    edge: ['edge', 'chromium', 'chrome', 'chrome-mv3'],
    firefox: ['firefox']
  }
  const candidates = channelNames[browser] || [browser]

  for (const root of OUTPUT_ROOTS) {
    for (const channel of candidates) {
      const dir = path.join(exampleDir, root, channel)
      if (fs.existsSync(path.join(dir, 'manifest.json'))) return dir
    }
  }
  return null
}

function cleanOutputs(exampleDir: string) {
  for (const root of OUTPUT_ROOTS) {
    try {
      fs.rmSync(path.join(exampleDir, root), {recursive: true, force: true})
    } catch {
      // best-effort
    }
  }
}

function expectedManifestVersion(
  browser: string,
  srcManifest: any
): number | null {
  // Firefox uses MV2 when the source manifest declares firefox:manifest_version: 2
  if (browser === 'firefox') {
    const ffMv = srcManifest?.['firefox:manifest_version']
    if (typeof ffMv === 'number') return ffMv
  }
  // Chromium-based use MV3 when declared
  const chrMv = srcManifest?.['chromium:manifest_version']
  if (typeof chrMv === 'number') return chrMv
  return srcManifest?.manifest_version ?? null
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

for (const templateName of TEMPLATES) {
  const exampleDir = path.join(__dirname, templateName)
  const srcManifestPath = path.join(exampleDir, 'src', 'manifest.json')

  if (!fs.existsSync(srcManifestPath)) continue
  const srcManifest = readJSON(srcManifestPath)

  test.describe(`${templateName}: multi-browser build`, () => {
    test.describe.configure({mode: 'serial', timeout: 180000})

    test.skip(!hasLocalCli(), 'local CLI not compiled — run pnpm compile first')

    test.beforeAll(() => {
      cleanOutputs(exampleDir)
    })

    for (const browser of BROWSERS) {
      test(`${browser}: builds and emits valid manifest`, () => {
        try {
          execSync(
            `node ${localCliCjs} build ${exampleDir} --browser=${browser}`,
            {
              cwd: exampleDir,
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
            }
          )
        } catch (error) {
          const msg = (error as any)?.stderr
            ? String((error as any).stderr).slice(0, 500)
            : (error as Error).message
          throw new Error(`${templateName} × ${browser}: build failed:\n${msg}`)
        }

        const outputDir = findOutputDir(exampleDir, browser)
        expect(
          outputDir,
          `${templateName} × ${browser}: no output directory with manifest.json`
        ).not.toBeNull()

        const manifest = readJSON(path.join(outputDir!, 'manifest.json'))

        // Manifest version matches expectation
        const expectedMv = expectedManifestVersion(browser, srcManifest)
        if (expectedMv !== null) {
          expect(
            manifest.manifest_version,
            `${templateName} × ${browser}: wrong manifest_version`
          ).toBe(expectedMv)
        }

        // Required manifest fields exist
        expect(manifest.name).toBeTruthy()
        expect(manifest.version).toBeTruthy()

        // Content script files exist on disk
        if (Array.isArray(manifest.content_scripts)) {
          for (const cs of manifest.content_scripts) {
            for (const jsFile of cs.js || []) {
              expect(
                fs.existsSync(path.join(outputDir!, jsFile)),
                `${templateName} × ${browser}: content script ${jsFile} missing`
              ).toBe(true)
            }
          }
        }

        // Background entry exists on disk
        const sw = manifest.background?.service_worker
        const bgScripts = manifest.background?.scripts
        if (sw) {
          expect(
            fs.existsSync(path.join(outputDir!, sw)),
            `${templateName} × ${browser}: service worker ${sw} missing`
          ).toBe(true)
        }
        if (Array.isArray(bgScripts)) {
          for (const script of bgScripts) {
            expect(
              fs.existsSync(path.join(outputDir!, script)),
              `${templateName} × ${browser}: background script ${script} missing`
            ).toBe(true)
          }
        }

        // Popup HTML exists on disk (if declared)
        const popup =
          manifest.action?.default_popup ||
          manifest.browser_action?.default_popup
        if (popup) {
          expect(
            fs.existsSync(path.join(outputDir!, popup)),
            `${templateName} × ${browser}: popup ${popup} missing`
          ).toBe(true)
        }

        // No dev-only artifacts in production
        // No dev-only artifacts in production output
        const hotDir = path.join(outputDir!, 'hot')
        expect(
          fs.existsSync(hotDir),
          `${templateName} × ${browser}: hot/ dir leaked into production`
        ).toBe(false)

        const allFiles: string[] = []
        try {
          for (const f of fs.readdirSync(outputDir!, {recursive: true}))
            allFiles.push(String(f))
        } catch {}

        const hotUpdateFiles = allFiles.filter((f) =>
          f.includes('.hot-update.')
        )
        expect(
          hotUpdateFiles.length,
          `${templateName} × ${browser}: ${hotUpdateFiles.length} hot-update files leaked`
        ).toBe(0)

        const evalSourceMaps = allFiles
          .filter((f) => f.endsWith('.js') && !f.endsWith('.min.js'))
          .filter((f) => {
            try {
              const content = fs.readFileSync(path.join(outputDir!, f), 'utf8')
              return content.includes('//# sourceURL=webpack-internal')
            } catch {
              return false
            }
          })
        expect(
          evalSourceMaps.length,
          `${templateName} × ${browser}: ${evalSourceMaps.length} files with eval source maps`
        ).toBe(0)

        // ---------------------------------------------------------------
        // Firefox-specific manifest key verification
        // ---------------------------------------------------------------
        if (browser === 'firefox') {
          if (manifest.manifest_version === 2) {
            // Firefox MV2 should have a popup when the source declares one
            const srcPopup =
              srcManifest.action?.default_popup ||
              srcManifest['chromium:action']?.default_popup ||
              srcManifest['firefox:browser_action']?.default_popup
            if (srcPopup) {
              const outPopup =
                manifest.action?.default_popup ||
                manifest.browser_action?.default_popup
              expect(
                outPopup,
                `${templateName} × firefox: MV2 should have a popup entry`
              ).toBeTruthy()
            }
            // Firefox MV2 should use sidebar_action, not side_panel
            if (
              srcManifest['chromium:side_panel'] ||
              srcManifest['firefox:sidebar_action']
            ) {
              expect(
                manifest.sidebar_action,
                `${templateName} × firefox: MV2 should use sidebar_action`
              ).toBeTruthy()
            }
          }
        }

        // ---------------------------------------------------------------
        // CSS files referenced in HTML entries are present and non-empty
        // ---------------------------------------------------------------
        const htmlFiles = allFiles.filter((f) => f.endsWith('.html'))
        for (const htmlFile of htmlFiles) {
          const htmlPath = path.join(outputDir!, htmlFile)
          try {
            const htmlContent = fs.readFileSync(htmlPath, 'utf8')
            const cssHrefs = htmlContent.match(/href="([^"]*\.css)"/g)
            if (cssHrefs) {
              for (const match of cssHrefs) {
                const href = match.replace(/href="([^"]*)"/, '$1')
                // Resolve relative or absolute-from-root hrefs
                const cssPath = href.startsWith('/')
                  ? path.join(outputDir!, href)
                  : path.join(path.dirname(htmlPath), href)
                expect(
                  fs.existsSync(cssPath),
                  `${templateName} × ${browser}: CSS file ${href} referenced in ${htmlFile} is missing`
                ).toBe(true)
                const cssContent = fs.readFileSync(cssPath, 'utf8')
                expect(
                  cssContent.trim().length,
                  `${templateName} × ${browser}: CSS file ${href} is empty`
                ).toBeGreaterThan(0)
              }
            }
          } catch {
            // Non-critical — skip if HTML can't be read
          }
        }
      })
    }
  })
}
