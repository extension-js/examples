import {expect} from '@playwright/test'
import fs from 'fs'
import path from 'path'
import {spawn} from 'child_process'
import {getDirname} from './dirname.js'
import {
  extensionFixtures,
  waitForShadowElement,
  getSidebarPath
} from './extension-fixtures.js'

type Manifest = {
  content_scripts?: Array<{js?: string[]}>
  action?: {default_popup?: string}
  chrome_url_overrides?: {newtab?: string}
  ['chromium:action']?: {default_popup?: string}
  ['firefox:browser_action']?: {default_popup?: string}
  ['chromium:side_panel']?: {default_path?: string}
  ['firefox:sidebar_action']?: {default_panel?: string}
}

const __dirname = getDirname(import.meta.url)
const examplesDir = __dirname

const DEV_ROOTS = ['.extension', 'dist', 'build']
const DEV_CHANNELS = ['chrome', 'chromium', 'chrome-mv3']

function listExampleDirs(): string[] {
  return fs
    .readdirSync(examplesDir, {withFileTypes: true})
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => name !== 'init')
}

function readManifest(exampleDir: string): Manifest | null {
  const manifestPath = path.join(exampleDir, 'src', 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    return null
  }
}

function normalizeRelativePath(value: string): string {
  return value.replace(/^\.\//, '')
}

function getContentScriptPath(manifest: Manifest): string | null {
  const firstScript = manifest.content_scripts?.[0]?.js?.[0]
  return firstScript ? normalizeRelativePath(firstScript) : null
}

function getHtmlEntryPath(manifest: Manifest): string | null {
  return (
    manifest.action?.default_popup ||
    manifest['chromium:action']?.default_popup ||
    manifest['firefox:browser_action']?.default_popup ||
    manifest.chrome_url_overrides?.newtab ||
    manifest['chromium:side_panel']?.default_path ||
    manifest['firefox:sidebar_action']?.default_panel ||
    null
  )
}

async function waitForDevManifest(
  exampleDir: string,
  timeoutMs = 60000
): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    for (const root of DEV_ROOTS) {
      for (const channel of DEV_CHANNELS) {
        const candidate = path.join(exampleDir, root, channel)
        if (fs.existsSync(path.join(candidate, 'manifest.json'))) {
          return candidate
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Dev manifest not found for ${exampleDir}`)
}

function replaceOnce(source: string, search: string, replace: string): string {
  const idx = source.indexOf(search)
  if (idx === -1) {
    throw new Error(`Text not found for replacement: "${search}"`)
  }
  return source.slice(0, idx) + replace + source.slice(idx + search.length)
}

function startDev(exampleDir: string) {
  const proc = spawn('pnpm', ['extension', 'dev', '--no-runner'], {
    cwd: exampleDir,
    env: {...process.env},
    stdio: 'pipe'
  })
  return proc
}

async function stopDev(proc: ReturnType<typeof startDev>) {
  if (proc.killed) return
  proc.kill('SIGTERM')
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5000)
    proc.on('close', () => {
      clearTimeout(timeout)
      resolve(null)
    })
  })
}

async function expectContentText(page: any, text: string) {
  await expect
    .poll(
      async () => {
        const h1 = await waitForShadowElement(
          page,
          '#extension-root, [data-extension-root="true"]',
          'div.content_script > h1',
          60000
        )
        if (!h1) return ''
        return h1.evaluate((node) => node.textContent || '')
      },
      {timeout: 60000}
    )
    .toContain(text)
}

async function expectHtmlText(page: any, text: string) {
  const h1 = page.locator('h1').first()
  await expect(h1).toContainText(text, {timeout: 60000})
}

const examples = listExampleDirs()

for (const example of examples) {
  const exampleDir = path.join(examplesDir, example)
  const manifest = readManifest(exampleDir)
  if (!manifest) continue

  const contentScriptPath = getContentScriptPath(manifest)
  const htmlEntryPath = getHtmlEntryPath(manifest)

  if (contentScriptPath) {
    const devPath = path.join(exampleDir, '.extension', 'chrome')
    const test = extensionFixtures(devPath)

    test.describe(`${example}: dev content`, () => {
      test.describe.configure({mode: 'serial'})

      let proc: ReturnType<typeof startDev> | null = null

      test.beforeAll(async () => {
        proc = startDev(exampleDir)
        await waitForDevManifest(exampleDir)
      })

      test.afterAll(async () => {
        if (proc) await stopDev(proc)
      })

      test('updates content script UI on change', async ({page}) => {
        const filePath = path.join(exampleDir, 'src', contentScriptPath)
        const original = fs.readFileSync(filePath, 'utf8')

        await page.goto('https://example.com/')
        const initialText =
          (
            await waitForShadowElement(
              page,
              '#extension-root, [data-extension-root="true"]',
              'div.content_script > h1',
              60000
            )
          )?.evaluate((node) => node.textContent || '') ?? ''
        const resolvedInitial = (await initialText).trim()
        if (!resolvedInitial) {
          throw new Error('Unable to read initial content script text')
        }
        const updatedText = `${resolvedInitial} Dev Update`

        try {
          const updated = replaceOnce(original, resolvedInitial, updatedText)
          fs.writeFileSync(filePath, updated, 'utf8')
          await expectContentText(page, updatedText)
        } finally {
          fs.writeFileSync(filePath, original, 'utf8')
        }
      })

      test('recovers after syntax error in content script', async ({page}) => {
        const filePath = path.join(exampleDir, 'src', contentScriptPath)
        const original = fs.readFileSync(filePath, 'utf8')

        await page.goto('https://example.com/')
        const initialText =
          (
            await waitForShadowElement(
              page,
              '#extension-root, [data-extension-root="true"]',
              'div.content_script > h1',
              60000
            )
          )?.evaluate((node) => node.textContent || '') ?? ''
        const resolvedInitial = (await initialText).trim()
        if (!resolvedInitial) {
          throw new Error('Unable to read initial content script text')
        }
        const recoveredText = `${resolvedInitial} Dev Recovered`

        try {
          fs.writeFileSync(
            filePath,
            `${original}\nconst __SYNTAX_ERROR__ = ;\n`,
            'utf8'
          )
          const recovered = replaceOnce(
            original,
            resolvedInitial,
            recoveredText
          )
          fs.writeFileSync(filePath, recovered, 'utf8')
          await expectContentText(page, recoveredText)
        } finally {
          fs.writeFileSync(filePath, original, 'utf8')
        }
      })
    })
  }

  if (htmlEntryPath) {
    const devPath = path.join(exampleDir, '.extension', 'chrome')
    const test = extensionFixtures(devPath)

    test.describe(`${example}: dev html`, () => {
      test.describe.configure({mode: 'serial'})

      let proc: ReturnType<typeof startDev> | null = null
      const entryPath = normalizeRelativePath(htmlEntryPath)

      test.beforeAll(async () => {
        proc = startDev(exampleDir)
        await waitForDevManifest(exampleDir)
      })

      test.afterAll(async () => {
        if (proc) await stopDev(proc)
      })

      test('updates html UI on change', async ({page, extensionId}) => {
        const filePath = path.join(exampleDir, 'src', entryPath)
        const original = fs.readFileSync(filePath, 'utf8')

        const pageUrl = entryPath.includes('sidebar/')
          ? getSidebarPath(extensionId)
          : entryPath.includes('action/')
            ? `chrome-extension://${extensionId}/${entryPath}`
            : `chrome-extension://${extensionId}/${entryPath}`

        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        })
        const initialText =
          (await page.locator('h1').first().textContent()) || ''
        const resolvedInitial = initialText.trim()
        if (!resolvedInitial) {
          throw new Error('Unable to read initial HTML header text')
        }
        const updatedText = `${resolvedInitial} Dev Update`

        try {
          const updated = replaceOnce(original, resolvedInitial, updatedText)
          fs.writeFileSync(filePath, updated, 'utf8')
          await expectHtmlText(page, updatedText)
        } finally {
          fs.writeFileSync(filePath, original, 'utf8')
        }
      })

      test('recovers after syntax error in html entry', async ({
        page,
        extensionId
      }) => {
        const filePath = path.join(exampleDir, 'src', entryPath)
        const original = fs.readFileSync(filePath, 'utf8')

        const pageUrl = entryPath.includes('sidebar/')
          ? getSidebarPath(extensionId)
          : entryPath.includes('action/')
            ? `chrome-extension://${extensionId}/${entryPath}`
            : `chrome-extension://${extensionId}/${entryPath}`

        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        })
        const initialText =
          (await page.locator('h1').first().textContent()) || ''
        const resolvedInitial = initialText.trim()
        if (!resolvedInitial) {
          throw new Error('Unable to read initial HTML header text')
        }
        const recoveredText = `${resolvedInitial} Dev Recovered`

        try {
          const broken = `${original}\n<script>const __SYNTAX_ERROR__ = ;</script>\n`
          fs.writeFileSync(filePath, broken, 'utf8')
          const recovered = replaceOnce(
            original,
            resolvedInitial,
            recoveredText
          )
          fs.writeFileSync(filePath, recovered, 'utf8')
          await expectHtmlText(page, recoveredText)
        } finally {
          fs.writeFileSync(filePath, original, 'utf8')
        }
      })
    })
  }
}
