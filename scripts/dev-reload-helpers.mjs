import {spawn} from 'node:child_process'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * When nested inside the extension.js monorepo (`_FUTURE/examples/`), the
 * monorepo root lives three directories above this script. In CI the examples
 * repo is checked out standalone, so three levels up has no package.json.
 * `workspaceRoot` always resolves to the examples repo root (one level up from
 * `scripts/`) and is used as the cwd for `pnpm extension` invocations.
 */
export const workspaceRoot = path.resolve(__dirname, '..')
const monorepoCandidate = path.resolve(__dirname, '..', '..', '..')
export const repoRoot = fsSync.existsSync(
  path.join(monorepoCandidate, 'programs', 'cli')
)
  ? monorepoCandidate
  : workspaceRoot
export const examplesRoot = path.resolve(__dirname, '..', 'examples')
export const localCliPath = path.join(
  repoRoot,
  'programs',
  'cli',
  'dist',
  'cli.cjs'
)
const localDevelopRoot = path.join(repoRoot, 'programs', 'develop')

/**
 * Content-script live verify must open this origin so RDP inspection matches the harness.
 *
 * Manual smoke (content template): from `examples/content`, run dev with this URL, confirm
 * `[data-extension-root]` (non-devtools) appears on the page and shadow content updates after edits.
 * Optional: `node scripts/verify-content-live.mjs --browser=chromium --templates=content`.
 */
export const DEFAULT_VERIFY_STARTING_URL = 'https://example.com/'

/**
 * Prefer the monorepo `pnpm extension` script (root package.json) so dev runs match
 * local CLI fixes (dotenv, same `node programs/extension/dist/cli.cjs` entry). Optional
 * `EXTENSION_LOCAL_CLI_CJS=/abs/path/cli.cjs` forces direct `node` + `cli.cjs` for debugging.
 */
export function resolveDevCliInvocation() {
  const overriddenCliPath =
    typeof process.env.EXTENSION_LOCAL_CLI_CJS === 'string'
      ? process.env.EXTENSION_LOCAL_CLI_CJS.trim()
      : ''
  if (overriddenCliPath.length > 0 && fsSync.existsSync(overriddenCliPath)) {
    return {
      command: process.execPath,
      args: [overriddenCliPath]
    }
  }

  // Do NOT use `pnpm run extension -- dev …`: pnpm forwards a `--` before `dev`, so the
  // process becomes `node cli.cjs -- dev …` and Commander breaks ("too many arguments for dev").
  return {
    command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: ['extension']
  }
}

export function createVerifyProfileDir(runId) {
  return path.join(os.tmpdir(), 'extensionjs-verify-profiles', runId)
}

export function parseArg(args, name, fallback) {
  const equalsPrefix = `${name}=`
  const inline = args.find((arg) => String(arg).startsWith(equalsPrefix))
  if (inline) {
    return String(inline).slice(equalsPrefix.length) || fallback
  }
  const index = args.indexOf(name)
  if (index === -1) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith('--')) return fallback
  return value
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

function normalizeComparableText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractJsonLines(output) {
  const parsed = []
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      parsed.push(JSON.parse(trimmed))
    } catch {
      // Ignore mixed non-JSON output.
    }
  }
  return parsed
}

export function hasCompiled(output) {
  return /compiled successfully|compiled with warnings/i.test(output)
}

export function latestEvent(output, predicate) {
  const events = extractJsonLines(output)
  for (let index = events.length - 1; index >= 0; index--) {
    if (predicate(events[index])) return events[index]
  }
  return undefined
}

export function latestPageHtml(output, stage) {
  return latestEvent(
    output,
    (event) =>
      event?.type === 'page_html' &&
      (stage ? event?.stage === stage : true) &&
      typeof event?.html === 'string'
  )
}

export function latestShadowStyleOutput(output, stage) {
  return latestEvent(
    output,
    (event) =>
      event?.type === 'shadow_style_output' &&
      (stage ? event?.stage === stage : true) &&
      Array.isArray(event?.styles)
  )
}

export async function resolveContentStyleExpectation(
  absoluteScriptPath,
  scriptSource
) {
  const normalizedSource = String(scriptSource || '')
  const styleImportMatch =
    normalizedSource.match(
      /new URL\(\s*['"](.+?\.css(?:\?[^'"]*)?)['"]\s*,\s*import\.meta\.url\s*\)/
    ) ||
    normalizedSource.match(
      /import\s+[A-Za-z_$][A-Za-z0-9_$]*\s+from\s+['"](.+?\.css(?:\?[^'"]*)?)['"]/
    )
  if (!styleImportMatch) return null

  const styleRelativePath = String(styleImportMatch[1]).replace(/\?.*$/, '')
  const absoluteStylePath = path.resolve(
    path.dirname(absoluteScriptPath),
    styleRelativePath
  )
  const isModuleStylesheet = /\.module\.[A-Za-z0-9]+$/i.test(styleRelativePath)

  let cssSource = ''
  try {
    cssSource = await fs.readFile(absoluteStylePath, 'utf8')
  } catch {
    return {
      absoluteStylePath,
      styleRelativePath,
      token: null
    }
  }

  const selectorMatch =
    cssSource.match(/([.#][A-Za-z0-9_-]+)\s*\{/m) ||
    cssSource.match(/([.#][A-Za-z0-9_-]+)/m)

  return {
    absoluteStylePath,
    styleRelativePath,
    // CSS Modules rewrite selectors, so presence of populated <style> output is
    // the reliable assertion rather than a source selector literal.
    token: isModuleStylesheet ? null : selectorMatch ? selectorMatch[1] : null
  }
}

export function hasInjectedStyleInPageHtml(pageHtml, styleExpectation) {
  const html = String(pageHtml?.html || '')
  if (!html) return false

  const normalizedHtml = normalizeComparableText(html)
  if (!normalizedHtml.includes('<style')) return false
  if (!normalizedHtml.includes('data-extension-root')) return false

  const token = styleExpectation?.token
  if (!token) return true

  return normalizedHtml.includes(normalizeComparableText(token))
}

export function hasInjectedStyleOutput(styleOutput, styleExpectation) {
  const styles = Array.isArray(styleOutput?.styles) ? styleOutput.styles : []
  if (styles.length === 0) return false

  const combinedHtml = styles
    .map((styleEntry) => String(styleEntry?.html || ''))
    .join('\n')
  const normalizedHtml = normalizeComparableText(combinedHtml)

  if (!normalizedHtml.includes('<style')) return false

  const token = styleExpectation?.token
  if (!token) return true

  return normalizedHtml.includes(normalizeComparableText(token))
}

export function countEvents(output, predicate) {
  return extractJsonLines(output).filter(predicate).length
}

export function resolveReinjectKey(manifest, scriptPath) {
  const groups = Array.isArray(manifest?.content_scripts)
    ? manifest.content_scripts
    : []
  for (let index = 0; index < groups.length; index++) {
    const js = Array.isArray(groups[index]?.js) ? groups[index].js : []
    if (js.some((value) => String(value) === scriptPath)) {
      return `content_scripts/content-${index}`
    }
  }
  return 'content_scripts/content-0'
}

export function latestRootMeta(output, reinjectKey) {
  const events = extractJsonLines(output)
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event?.type !== 'extension_root_meta') continue
    const roots = Array.isArray(event?.roots) ? event.roots : []
    const markers = Array.isArray(event?.markers) ? event.markers : []
    const registries = Array.isArray(event?.registries) ? event.registries : []
    const page =
      event?.page && typeof event.page === 'object' ? event.page : undefined
    const entries = roots
      .concat(markers)
      .filter((entry) => entry?.key === reinjectKey)
    const registryEntries = registries.filter(
      (entry) => entry?.key === reinjectKey
    )
    const pageMatches = page?.key === reinjectKey
    const hasStructuralEvidence =
      entries.length > 0 || registryEntries.length > 0
    if (!hasStructuralEvidence && !pageMatches) continue
    if (!hasStructuralEvidence && pageMatches) continue
    const generations = entries
      .map((entry) => Number(entry?.generation))
      .concat(
        hasStructuralEvidence && pageMatches ? [Number(page?.generation)] : []
      )
      .concat(registryEntries.map((entry) => Number(entry?.generation)))
      .filter((value) => Number.isFinite(value))
    const buildToken =
      [...entries]
        .reverse()
        .map((entry) => entry?.build)
        .find((value) => typeof value === 'string') ||
      (hasStructuralEvidence && pageMatches && typeof page?.build === 'string'
        ? page.build
        : undefined)
    const rootBuildTokens = roots
      .filter((entry) => entry?.key === reinjectKey)
      .map((entry) => entry?.build)
      .filter((value) => typeof value === 'string')
      .sort()
    const markerBuildTokens = markers
      .filter((entry) => entry?.key === reinjectKey)
      .map((entry) => entry?.build)
      .filter((value) => typeof value === 'string')
      .sort()
    const status =
      [...entries]
        .reverse()
        .map((entry) => entry?.status)
        .find((value) => typeof value === 'string') ||
      (hasStructuralEvidence && pageMatches && typeof page?.status === 'string'
        ? page.status
        : undefined)
    return {
      event,
      generation: generations.length ? Math.max(...generations) : 0,
      status,
      rootCount: roots.filter((entry) => entry?.key === reinjectKey).length,
      markerCount: markers.filter((entry) => entry?.key === reinjectKey).length,
      registryCount: registryEntries.length,
      hasCleanup: registryEntries.some((entry) => entry?.hasCleanup === true),
      buildToken,
      rootBuildTokens,
      markerBuildTokens,
      pageMatched: pageMatches
    }
  }
  return undefined
}

export function buildFailureSummary(output, reinjectKey) {
  const reloads = countEvents(
    output,
    (event) =>
      event?.type === 'action_event' && event?.action === 'extension_reload'
  )
  const injections = countEvents(
    output,
    (event) =>
      event?.type === 'action_event' &&
      event?.action === 'content_script_injected'
  )
  const updatedSnapshots = countEvents(
    output,
    (event) => event?.type === 'page_html' && event?.stage === 'updated'
  )
  const rootMeta = latestRootMeta(output, reinjectKey)
  return (
    `reloads=${reloads} injections=${injections} updatedSnapshots=${updatedSnapshots} rootMeta=${JSON.stringify(rootMeta || null)}\n\n` +
    output.slice(-8000)
  )
}

export async function waitFor(check, timeout, label) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const result = await check()
    if (result) return result
    await wait(500)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

export function appendNoopSourceChange(source, marker) {
  return `${source}\n// ${marker}\n`
}

export function replaceVisibleProofToken(source, nextToken) {
  return source.replace(/Live Update Proof(?: [A-Za-z0-9_-]+)?/g, nextToken)
}

export function appendContentHeadingProbe(source, marker) {
  const input = String(source || '')
  const assignmentPatterns = [
    /(title\.textContent\s*=\s*['"`])([^'"`]+)(['"`]\s*;?)/,
    /(heading\.textContent\s*=\s*['"`])([^'"`]+)(['"`]\s*;?)/,
    /(textContent\s*=\s*['"`])([^'"`]+)(['"`]\s*;?)/
  ]
  for (const pattern of assignmentPatterns) {
    if (pattern.test(input)) {
      return input.replace(
        pattern,
        (_match, start, text, end) => `${start}${text} ${marker}${end}`
      )
    }
  }

  const headingTagPattern = /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/i
  const headingTagMatch = input.match(headingTagPattern)
  if (headingTagMatch) {
    const [, level, attrs, inner] = headingTagMatch
    const normalizedInner = String(inner || '')
      .replace(/\s+/g, ' ')
      .trim()
    if (normalizedInner && !normalizedInner.includes('<')) {
      return input.replace(
        headingTagPattern,
        `<h${level}${attrs}>${normalizedInner} ${marker}</h${level}>`
      )
    }
  }

  const textTagPattern = /<(span|p|button)([^>]*)>([^<]+)<\/\1>/i
  const textTagMatch = input.match(textTagPattern)
  if (textTagMatch) {
    const [, tag, attrs, inner] = textTagMatch
    const normalizedInner = String(inner || '')
      .replace(/\s+/g, ' ')
      .trim()
    if (normalizedInner) {
      return input.replace(
        textTagPattern,
        `<${tag}${attrs}>${normalizedInner} ${marker}</${tag}>`
      )
    }
  }

  return `${input}

;(() => {
  const marker = ${JSON.stringify(marker)}
  const selector =
    'div.content_script h1, div.content_script h2, div.content_script h3, div.content_script p, div.content_script span'
  const hostSelector =
    '#extension-root, [data-extension-root]:not([data-extension-root="extension-js-devtools"])'
  const probeAttribute = 'data-extjs-visible-probe'
  const deadline = Date.now() + 15000
  const fallbackReadyAt = Date.now() + 2000
  let observer = null

  const removeProbes = () => {
    const hosts = Array.from(document.querySelectorAll(hostSelector))
    for (const host of hosts) {
      const shadowRoot = host && 'shadowRoot' in host ? host.shadowRoot : null
      const root = shadowRoot || host
      if (!root) continue
      for (const probe of Array.from(root.querySelectorAll(\`[\${probeAttribute}]\`))) {
        probe.remove()
      }
    }
  }

  const installCleanup = (host) => {
    const key =
      host?.getAttribute?.('data-extjs-reinject-key') ||
      document.documentElement?.getAttribute?.('data-extjs-last-reinject-key')
    if (!key) return
    const registry =
      typeof globalThis === 'object' && globalThis
        ? globalThis.__EXTENSIONJS_DEV_REINJECT__
        : null
    if (!registry || typeof registry !== 'object') return
    const entry = registry[key]
    if (!entry) return

    if (typeof entry === 'function') {
      if (entry.__extjsVisibleProbeWrapped) return
      const wrapped = (...args) => {
        try {
          removeProbes()
        } catch (error) {}
        return entry(...args)
      }
      wrapped.__extjsGeneration = entry.__extjsGeneration
      wrapped.__extjsVisibleProbeWrapped = true
      registry[key] = wrapped
      return
    }

    if (
      entry &&
      typeof entry === 'object' &&
      typeof entry.cleanup === 'function' &&
      !entry.cleanup.__extjsVisibleProbeWrapped
    ) {
      const originalCleanup = entry.cleanup
      const wrappedCleanup = (...args) => {
        try {
          removeProbes()
        } catch (error) {}
        return originalCleanup(...args)
      }
      wrappedCleanup.__extjsVisibleProbeWrapped = true
      entry.cleanup = wrappedCleanup
    }
  }

  const applyMarker = () => {
    const hosts = Array.from(document.querySelectorAll(hostSelector))
    let updated = false

    for (const host of hosts) {
      const shadowRoot = host && 'shadowRoot' in host ? host.shadowRoot : null
      const root = shadowRoot || host
      if (!root) continue
      const heading = root.querySelector(selector)

      if (heading) {
        for (const probe of Array.from(root.querySelectorAll(\`[\${probeAttribute}]\`))) {
          if (!heading.contains(probe)) probe.remove()
        }
        let inlineProbe = heading.querySelector(\`[\${probeAttribute}]\`)
        if (!inlineProbe) {
          inlineProbe = document.createElement('span')
          inlineProbe.setAttribute(probeAttribute, marker)
          inlineProbe.textContent = \` \${marker}\`
          inlineProbe.style.cssText = [
            'margin-left:8px',
            'padding:2px 6px',
            'border-radius:9999px',
            'background:#fde047',
            'color:#111827',
            'font:600 0.75em/1.2 sans-serif'
          ].join(';')
          heading.appendChild(inlineProbe)
          updated = true
        } else if (inlineProbe.textContent !== \` \${marker}\`) {
          inlineProbe.textContent = \` \${marker}\`
          updated = true
        }
      } else if (Date.now() >= fallbackReadyAt) {
        const existingProbe = root.querySelector(\`[\${probeAttribute}]\`)
        if (!existingProbe) {
          const probe = document.createElement('div')
          probe.setAttribute(probeAttribute, marker)
          probe.textContent = marker
          probe.style.cssText = [
            'position:fixed',
            'right:12px',
            'bottom:12px',
            'z-index:2147483647',
            'padding:6px 10px',
            'border:2px solid #111827',
            'background:#fde047',
            'color:#111827',
            'font:600 13px/1.2 sans-serif',
            'box-shadow:0 2px 10px rgba(0,0,0,0.25)'
          ].join(';')
          root.appendChild(probe)
          updated = true
        } else if (existingProbe.textContent !== marker) {
          existingProbe.textContent = marker
          updated = true
        }
      }
      installCleanup(host)
    }

    return updated
  }

  const stop = () => {
    if (observer) observer.disconnect()
    observer = null
  }

  const tick = () => {
    applyMarker()
    if (Date.now() >= deadline) {
      stop()
      return
    }
    window.setTimeout(tick, 120)
  }

  try {
    observer = new MutationObserver(() => {
      applyMarker()
    })
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      characterData: true
    })
  } catch (error) {}

  tick()
})()
`
}

export async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  await new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const killTimer = setTimeout(() => {
      try {
        // Kill entire process group so grandchild dev-server processes
        // don't linger as orphans on CI.
        if (process.platform !== 'win32' && child.pid) {
          process.kill(-child.pid, 'SIGKILL')
        } else {
          child.kill('SIGKILL')
        }
      } catch {
        // Process may have already exited between checks.
      }
      finish()
    }, 5000)
    child.once('close', () => {
      clearTimeout(killTimer)
      finish()
    })
    try {
      if (process.platform !== 'win32' && child.pid) {
        process.kill(-child.pid, 'SIGTERM')
      } else {
        child.kill('SIGTERM')
      }
    } catch {
      clearTimeout(killTimer)
      finish()
    }
  })
}

export function createRunId(parts) {
  return parts
    .filter(Boolean)
    .join('-')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
}

export async function ensureCleanDir(dirPath) {
  await fs.rm(dirPath, {recursive: true, force: true})
  await fs.mkdir(dirPath, {recursive: true})
}

export function startDevProcess({
  browser,
  exampleDir,
  sourceUrl,
  profileDir,
  instanceId,
  extraArgs = []
}) {
  const cliInvocation = resolveDevCliInvocation()
  const projectPath = path.resolve(exampleDir)
  const usesDirectNodeCli = cliInvocation.command === process.execPath
  const resolvedStartingUrl =
    typeof sourceUrl === 'string' && sourceUrl.trim().length > 0
      ? sourceUrl.trim()
      : DEFAULT_VERIFY_STARTING_URL
  const args = [
    ...cliInvocation.args,
    'dev',
    usesDirectNodeCli ? '.' : projectPath,
    `--browser=${browser}`,
    `--starting-url=${resolvedStartingUrl}`,
    `--source=${resolvedStartingUrl}`,
    '--source-format=ndjson',
    '--source-meta',
    '--source-include-shadow=all',
    '--install=false',
    `--profile=${profileDir}`,
    ...extraArgs
  ]
  const env = {
    ...process.env,
    EXTENSION_AUTHOR_MODE: 'true',
    EXTENSION_INSTANCE_ID: instanceId
  }

  if (fsSync.existsSync(localDevelopRoot)) {
    env.EXTENSION_DEVELOP_ROOT = localDevelopRoot
  }

  const child = spawn(cliInvocation.command, args, {
    cwd: usesDirectNodeCli ? projectPath : workspaceRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(process.platform !== 'win32' && {detached: true})
  })

  let output = ''
  let childExited = false
  child.stdout?.on('data', (chunk) => {
    output += String(chunk)
  })
  child.stderr?.on('data', (chunk) => {
    output += String(chunk)
  })
  child.on('close', () => {
    childExited = true
  })

  return {
    child,
    getOutput: () => output,
    hasExited: () => childExited
  }
}

export async function runWithRetries({retries, label, shouldRetry, execute}) {
  let lastError
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await execute(attempt)
    } catch (error) {
      lastError = error
      if (attempt >= retries || !shouldRetry(error)) {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `[${label}] retrying attempt ${attempt + 1}/${retries}: ${message}`
      )
      await wait(Math.min(1000 * attempt, 3000))
    }
  }
  throw lastError
}

export function isRetryableBrowserFailure(error) {
  const message = error instanceof Error ? error.message : String(error)
  return /Unable to connect to Firefox|Too many retries|dev child exited early|Timed out waiting for|ECONNREFUSED/i.test(
    message
  )
}
