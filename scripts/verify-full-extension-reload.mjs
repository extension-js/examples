#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  appendContentHeadingProbe,
  appendNoopSourceChange,
  buildFailureSummary,
  countEvents,
  createVerifyProfileDir,
  createRunId,
  ensureCleanDir,
  examplesRoot,
  extractJsonLines,
  hasCompiled,
  hasInjectedStyleInPageHtml,
  hasInjectedStyleOutput,
  isRetryableBrowserFailure,
  latestEvent,
  latestPageHtml,
  latestRootMeta,
  latestShadowStyleOutput,
  parseArg,
  readJson,
  resolveContentStyleExpectation,
  resolveReinjectKey,
  runWithRetries,
  stagingRoot,
  startDevProcess,
  stopChild,
  waitFor
} from './dev-reload-helpers.mjs'

const args = process.argv.slice(2)
const browser = parseArg(args, '--browser', 'firefox')
const timeoutMs = Number(parseArg(args, '--timeout-ms', '180000'))
const retries = Number(
  parseArg(args, '--retries', browser === 'firefox' ? '3' : '1')
)
const scenariosArg = parseArg(args, '--scenarios', 'background,manifest')
const scenarios = scenariosArg
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const templatesArg = parseArg(
  args,
  '--templates',
  [
    'content',
    'content-react',
    'content-vue',
    'content-svelte',
    'content-preact',
    'content-css-modules',
    'content-less-modules',
    'content-sass-modules',
    'content-multi-one-entry',
    'content-multi-three-entries',
    'javascript',
    'react',
    'staging-content-main-world'
  ].join(',')
)
const templates = templatesArg
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const templateConfigMap = {
  'content-multi-one-entry': {
    target: {groupIndex: 0, scriptIndex: 3}
  },
  'content-multi-three-entries': {
    target: {groupIndex: 2, scriptIndex: 0}
  },
  'staging-content-main-world': {
    exampleDir: path.join(stagingRoot, 'content-main-world')
  }
}

function resolveTemplateConfig(template) {
  return templateConfigMap[template] || {}
}

function resolveContentScriptTarget(manifest, scenario = {}) {
  const groups = Array.isArray(manifest?.content_scripts)
    ? manifest.content_scripts
    : []
  const groupIndex = Number.isInteger(scenario.groupIndex)
    ? scenario.groupIndex
    : 0
  const group = groups[groupIndex]
  const jsList = Array.isArray(group?.js) ? group.js : []
  const scriptIndex = Number.isInteger(scenario.scriptIndex)
    ? scenario.scriptIndex
    : 0
  const scriptPath = jsList[scriptIndex]
  if (!scriptPath) {
    throw new Error(
      `no content script entry found for group ${groupIndex} script ${scriptIndex}`
    )
  }

  return {
    groupIndex,
    scriptIndex,
    scriptPath: String(scriptPath)
  }
}

function countRenderablePageSnapshots(output) {
  return countEvents(
    output,
    (event) =>
      event?.type === 'page_html' &&
      (event?.stage === 'updated' || event?.stage === 'post_injection')
  )
}

function latestRenderableSnapshotAfter(output, afterTimestamp) {
  const events = extractJsonLines(output)
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (
      event?.type !== 'page_html' ||
      (event?.stage !== 'updated' && event?.stage !== 'post_injection')
    ) {
      continue
    }
    if (
      afterTimestamp &&
      typeof event?.timestamp === 'string' &&
      event.timestamp < afterTimestamp
    ) {
      continue
    }
    return event
  }
  return undefined
}

function latestShadowStyleOutputAfter(output, afterTimestamp) {
  const events = extractJsonLines(output)
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (
      event?.type !== 'shadow_style_output' ||
      !Array.isArray(event?.styles)
    ) {
      continue
    }
    if (
      afterTimestamp &&
      typeof event?.timestamp === 'string' &&
      event.timestamp < afterTimestamp
    ) {
      continue
    }
    return event
  }
  return undefined
}

async function waitForInitialContent(
  dev,
  reinjectKey,
  label,
  styleExpectation
) {
  await waitFor(
    async () => {
      if (dev.hasExited()) {
        throw new Error(
          `${label} exited before initial injection\n\n${dev.getOutput().slice(-5000)}`
        )
      }
      if (!hasCompiled(dev.getOutput())) return false
      const injected = latestEvent(
        dev.getOutput(),
        (event) =>
          event?.type === 'action_event' &&
          event?.action === 'content_script_injected'
      )
      const rootMeta = latestRootMeta(dev.getOutput(), reinjectKey)
      const pageHtml =
        latestPageHtml(dev.getOutput(), 'post_injection') ||
        latestPageHtml(dev.getOutput(), 'updated')
      const styleOutput =
        latestShadowStyleOutput(dev.getOutput(), 'post_injection') ||
        latestShadowStyleOutput(dev.getOutput(), 'updated')
      const hasInjectedStyle =
        hasInjectedStyleOutput(styleOutput, styleExpectation) ||
        hasInjectedStyleInPageHtml(pageHtml, styleExpectation)
      const hasMountedMarker =
        !!rootMeta &&
        (rootMeta.rootCount >= 1 ||
          rootMeta.markerCount >= 1 ||
          rootMeta.pageMatched) &&
        (rootMeta.status === undefined || rootMeta.status === 'mounted')
      return (
        injected && ((hasMountedMarker && hasInjectedStyle) || hasMountedMarker)
      )
    },
    timeoutMs,
    `${label} initial content injection`
  )
}

async function verifyReloadScenario({
  dev,
  label,
  reinjectKey,
  visibleEdit,
  reloadEdits,
  restoreEdits,
  styleExpectation,
  visibleToken
}) {
  const beforeVisiblePageSnapshotCount = countRenderablePageSnapshots(
    dev.getOutput()
  )

  await fs.writeFile(visibleEdit.path, visibleEdit.source, 'utf8')

  await waitFor(
    async () => {
      if (dev.hasExited()) {
        throw new Error(
          `${label} exited before visible UI update\n\n${dev.getOutput().slice(-5000)}`
        )
      }
      const pageSnapshotCount = countRenderablePageSnapshots(dev.getOutput())
      if (pageSnapshotCount <= beforeVisiblePageSnapshotCount) return false
      const pageHtml =
        latestPageHtml(dev.getOutput(), 'updated') ||
        latestPageHtml(dev.getOutput(), 'post_injection')
      const styleOutput =
        latestShadowStyleOutput(dev.getOutput(), 'updated') ||
        latestShadowStyleOutput(dev.getOutput(), 'post_injection')
      const hasInjectedStyle =
        hasInjectedStyleOutput(styleOutput, styleExpectation) ||
        hasInjectedStyleInPageHtml(pageHtml, styleExpectation)
      const hasVisibleUpdate =
        typeof pageHtml?.html === 'string' &&
        pageHtml.html.includes(visibleToken)
      return hasInjectedStyle && hasVisibleUpdate
    },
    timeoutMs,
    `${label} visible UI proof`
  )

  const beforeReloadCount = countEvents(
    dev.getOutput(),
    (event) =>
      event?.type === 'action_event' && event?.action === 'extension_reload'
  )
  const beforeReloadVisibleSnapshotCount = countRenderablePageSnapshots(
    dev.getOutput()
  )

  for (const edit of reloadEdits) {
    await fs.writeFile(edit.path, edit.source, 'utf8')
  }

  await waitFor(
    async () => {
      if (dev.hasExited()) {
        throw new Error(
          `${label} exited before expected extension reload\n\n${dev.getOutput().slice(-5000)}`
        )
      }
      const reloadCount = countEvents(
        dev.getOutput(),
        (event) =>
          event?.type === 'action_event' && event?.action === 'extension_reload'
      )
      return reloadCount > beforeReloadCount
    },
    timeoutMs,
    `${label} extension reload`
  )

  const reloadEvent = latestEvent(
    dev.getOutput(),
    (event) =>
      event?.type === 'action_event' && event?.action === 'extension_reload'
  )
  const reloadTimestamp =
    typeof reloadEvent?.timestamp === 'string'
      ? reloadEvent.timestamp
      : undefined

  await waitFor(
    async () => {
      if (dev.hasExited()) {
        throw new Error(
          `${label} exited before post-reload visible UI proof\n\n${dev.getOutput().slice(-5000)}`
        )
      }
      const pageHtml =
        latestRenderableSnapshotAfter(dev.getOutput(), reloadTimestamp) ||
        latestPageHtml(dev.getOutput(), 'updated') ||
        latestPageHtml(dev.getOutput(), 'post_injection')
      const styleOutput =
        latestShadowStyleOutputAfter(dev.getOutput(), reloadTimestamp) ||
        latestShadowStyleOutput(dev.getOutput(), 'updated') ||
        latestShadowStyleOutput(dev.getOutput(), 'post_injection')
      const hasInjectedStyle =
        hasInjectedStyleOutput(styleOutput, styleExpectation) ||
        hasInjectedStyleInPageHtml(pageHtml, styleExpectation)
      const hasVisibleUpdate =
        typeof pageHtml?.html === 'string' &&
        pageHtml.html.includes(visibleToken)
      return hasInjectedStyle && hasVisibleUpdate
    },
    timeoutMs,
    `${label} post-reload visible UI proof`
  )

  const beforeRestoreReloadCount = countEvents(
    dev.getOutput(),
    (event) =>
      event?.type === 'action_event' && event?.action === 'extension_reload'
  )
  const restoreTimestamp = new Date().toISOString()

  for (const restoreEdit of restoreEdits) {
    await fs.writeFile(restoreEdit.path, restoreEdit.source, 'utf8')
  }

  await waitFor(
    async () => {
      if (dev.hasExited()) {
        throw new Error(
          `${label} exited before restored UI proof\n\n${dev.getOutput().slice(-5000)}`
        )
      }
      const restoreReloadCount = countEvents(
        dev.getOutput(),
        (event) =>
          event?.type === 'action_event' && event?.action === 'extension_reload'
      )
      const restoreReloadEvent =
        restoreReloadCount > beforeRestoreReloadCount
          ? latestEvent(
              dev.getOutput(),
              (event) =>
                event?.type === 'action_event' &&
                event?.action === 'extension_reload'
            )
          : undefined
      const restoreAfterTimestamp =
        typeof restoreReloadEvent?.timestamp === 'string'
          ? restoreReloadEvent.timestamp
          : restoreTimestamp
      const pageHtml =
        latestRenderableSnapshotAfter(dev.getOutput(), restoreAfterTimestamp) ||
        latestPageHtml(dev.getOutput(), 'updated') ||
        latestPageHtml(dev.getOutput(), 'post_injection')
      return (
        typeof pageHtml?.html === 'string' &&
        !pageHtml.html.includes(visibleToken)
      )
    },
    timeoutMs,
    `${label} restored UI proof`
  )
}

async function runScenario(attempt, template, scenario) {
  const templateConfig = resolveTemplateConfig(template)
  const exampleDir =
    typeof templateConfig.exampleDir === 'string'
      ? templateConfig.exampleDir
      : path.join(examplesRoot, template)
  const browserDistDir = path.join(exampleDir, 'dist', browser)
  const manifestPath = path.join(exampleDir, 'src', 'manifest.json')
  const manifest = await readJson(manifestPath)
  const {scriptPath} = resolveContentScriptTarget(
    manifest,
    templateConfig.target
  )
  const backgroundPath =
    manifest?.background?.['chromium:service_worker'] ||
    manifest?.background?.service_worker ||
    manifest?.background?.['firefox:scripts']?.[0]

  if (!scriptPath || !backgroundPath) {
    throw new Error(`[${template}] missing manifest content/background entries`)
  }

  const absoluteManifestPath = path.join(exampleDir, 'src', 'manifest.json')
  const absoluteBackgroundPath = path.join(
    exampleDir,
    'src',
    String(backgroundPath).replace(/^\.\//, '')
  )
  const originalManifest = await fs.readFile(absoluteManifestPath, 'utf8')
  const originalBackground = await fs.readFile(absoluteBackgroundPath, 'utf8')
  const absoluteScriptPath = path.join(
    exampleDir,
    'src',
    scriptPath.replace(/^\.\//, '')
  )
  const originalScriptSource = await fs.readFile(absoluteScriptPath, 'utf8')
  const styleExpectation = await resolveContentStyleExpectation(
    absoluteScriptPath,
    originalScriptSource
  )
  const reinjectKey = resolveReinjectKey(manifest, scriptPath)
  const runId = createRunId([
    'full-reload',
    browser,
    template,
    scenario,
    `attempt-${attempt}`
  ])
  const profileDir = createVerifyProfileDir(runId)

  await fs.rm(browserDistDir, {recursive: true, force: true})
  await ensureCleanDir(profileDir)

  const dev = startDevProcess({
    browser,
    exampleDir,
    sourceUrl: 'https://example.com/',
    profileDir,
    instanceId: runId
  })

  try {
    await waitForInitialContent(
      dev,
      reinjectKey,
      `${browser}:${template}:${scenario}`,
      styleExpectation
    )

    if (scenario === 'background') {
      const backgroundMarker = `extjs-${browser}-background-${Date.now()}`
      const visibleToken = `extjs-${browser}-full-reload-background-${Date.now()}`
      await verifyReloadScenario({
        dev,
        label: `${browser}:${template}:background`,
        reinjectKey,
        visibleEdit: {
          path: absoluteScriptPath,
          source: appendContentHeadingProbe(originalScriptSource, visibleToken)
        },
        reloadEdits: [
          {
            path: absoluteBackgroundPath,
            source: appendNoopSourceChange(originalBackground, backgroundMarker)
          }
        ],
        restoreEdits: [
          {path: absoluteScriptPath, source: originalScriptSource},
          {path: absoluteBackgroundPath, source: originalBackground}
        ],
        styleExpectation,
        visibleToken
      })
    } else {
      const manifestJson = JSON.parse(originalManifest)
      const manifestMarker = `manifest-reload-${Date.now()}`
      const visibleToken = `extjs-${browser}-full-reload-manifest-${Date.now()}`
      manifestJson.description = `${manifestJson.description} ${manifestMarker}`
      await verifyReloadScenario({
        dev,
        label: `${browser}:${template}:manifest`,
        reinjectKey,
        visibleEdit: {
          path: absoluteScriptPath,
          source: appendContentHeadingProbe(originalScriptSource, visibleToken)
        },
        reloadEdits: [
          {
            path: absoluteManifestPath,
            source: `${JSON.stringify(manifestJson, null, 2)}\n`
          }
        ],
        restoreEdits: [
          {path: absoluteScriptPath, source: originalScriptSource},
          {path: absoluteManifestPath, source: originalManifest}
        ],
        styleExpectation,
        visibleToken
      })
    }

    return {
      browser,
      template,
      scenario,
      status: 'PASS'
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `[${template}] ${message}\n\n${buildFailureSummary(dev.getOutput(), reinjectKey)}`
    )
  } finally {
    await fs.writeFile(absoluteScriptPath, originalScriptSource, 'utf8')
    await fs.writeFile(absoluteBackgroundPath, originalBackground, 'utf8')
    await fs.writeFile(absoluteManifestPath, originalManifest, 'utf8')
    await stopChild(dev.child)
    await fs.rm(profileDir, {recursive: true, force: true}).catch(() => {})
  }
}

async function runTemplateScenarios(template) {
  const scenarioResults = []

  for (const scenario of scenarios) {
    const scenarioResult = await runWithRetries({
      retries,
      label: `full-reload:${browser}:${template}:${scenario}`,
      shouldRetry: isRetryableBrowserFailure,
      execute: (attempt) => runScenario(attempt, template, scenario)
    })
    scenarioResults.push(scenarioResult)
  }

  return [
    ...scenarioResults,
    {
      browser,
      template,
      scenarios: scenarioResults.map((result) => result.scenario),
      status: 'PASS'
    }
  ]
}

async function main() {
  const results = []

  for (const template of templates) {
    const templateResults = await runTemplateScenarios(template)
    const summary = templateResults[templateResults.length - 1]
    results.push(summary)
  }

  console.log(
    `[verify-full-extension-reload:${browser}] results=` +
      JSON.stringify(results, null, 2)
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
})
