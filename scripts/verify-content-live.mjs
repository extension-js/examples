#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  appendContentHeadingProbe,
  buildFailureSummary,
  countEvents,
  createVerifyProfileDir,
  createRunId,
  ensureCleanDir,
  examplesRoot,
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
  replaceVisibleProofToken,
  resolveContentStyleExpectation,
  resolveReinjectKey,
  runWithRetries,
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
const templatesArg = parseArg(
  args,
  '--templates',
  [
    'content',
    'content-react',
    'content-vue',
    'content-svelte',
    'content-preact',
    'content-typescript',
    'content-env',
    'content-css-modules',
    'content-less',
    'content-less-modules',
    'content-sass',
    'content-sass-modules',
    'content-custom-font',
    'content-multi-one-entry',
    'content-multi-three-entries',
    'javascript',
    'react'
  ].join(',')
)
const templatesRequested = templatesArg
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const templates = templatesRequested

const templateDirectoryAliases = {}

const templateScenarioMap = {
  javascript: [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/ContentApp.js'
    }
  ],
  'content-typescript': [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/scripts.ts'
    }
  ],
  'content-svelte': [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/ContentApp.svelte'
    }
  ],
  'content-vue': [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/ContentApp.vue'
    }
  ],
  react: [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/ContentApp.tsx'
    }
  ],
  'content-preact': [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/ContentApp.tsx'
    }
  ],
  'content-multi-one-entry': [
    {
      id: 'script-fourth-file',
      type: 'script',
      groupIndex: 0,
      scriptIndex: 3,
      mutationRelativePath: 'content/script-bottom-right.js'
    }
  ],
  'content-multi-three-entries': [
    {
      id: 'script-third-group',
      type: 'script',
      groupIndex: 2,
      scriptIndex: 0,
      mutationRelativePath: 'content/script-bottom-right.js'
    }
  ],
  'content-css-modules': [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/scripts.js'
    }
  ],
  'content-sass-modules': [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/scripts.js'
    }
  ],
  'content-less-modules': [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/scripts.js'
    }
  ],
  'content-less': [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/scripts.js'
    }
  ],
  'content-sass': [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/scripts.js'
    }
  ],
  'content-react': [
    {
      id: 'script-primary',
      type: 'script',
      mutationRelativePath: 'content/ContentApp.tsx'
    },
    {id: 'css-style-only', type: 'css'}
  ]
}

function normalizeComparableText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function includesComparableText(haystack, needle) {
  return normalizeComparableText(haystack).includes(
    normalizeComparableText(needle)
  )
}

function resolveTemplateContext(template) {
  const exampleDir =
    templateDirectoryAliases[template] || path.join(examplesRoot, template)
  const templateLabel = template
  return {
    template,
    templateLabel,
    exampleDir
  }
}

function getTemplateScenarios(template) {
  return (
    templateScenarioMap[template] || [{id: 'script-primary', type: 'script'}]
  )
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

function deriveVisibleTextHint(source) {
  const titleMatch = String(source || '').match(
    /title\.textContent\s*=\s*['"`]([^'"`]+)['"`]/
  )
  if (titleMatch?.[1]) return titleMatch[1]

  const headingMatch = String(source || '').match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (headingMatch?.[1]) return headingMatch[1]

  return null
}

function hasBuildChange(initialRootMeta, rootMeta) {
  if (!initialRootMeta || !rootMeta) return false
  const initialRootBuilds = JSON.stringify(
    initialRootMeta.rootBuildTokens || []
  )
  const nextRootBuilds = JSON.stringify(rootMeta.rootBuildTokens || [])
  const initialMarkerBuilds = JSON.stringify(
    initialRootMeta.markerBuildTokens || []
  )
  const nextMarkerBuilds = JSON.stringify(rootMeta.markerBuildTokens || [])
  return (
    initialRootBuilds !== nextRootBuilds ||
    initialMarkerBuilds !== nextMarkerBuilds
  )
}

function createCssMutationMarker(marker) {
  return `.extjs-live-style-${String(marker)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')}`
}

function appendCssMutation(source, marker) {
  const selector = createCssMutationMarker(marker)
  return {
    selector,
    nextSource:
      `${source}\n${selector} {\n` +
      `  outline: 3px solid #ff4d4f !important;\n` +
      `  box-shadow: 0 0 0 2px #22c55e !important;\n` +
      `}\n`
  }
}

function styleOutputIncludesMarker(styleOutput, pageHtml, marker) {
  const styleHtml = Array.isArray(styleOutput?.styles)
    ? styleOutput.styles
        .map((styleEntry) => String(styleEntry?.html || ''))
        .join('\n')
    : ''
  return (
    includesComparableText(styleHtml, marker) ||
    includesComparableText(pageHtml?.html || '', marker)
  )
}

async function waitForUpdatedOutputToSettle(
  dev,
  quietMs = 1500,
  timeoutMs = 8000
) {
  const startedAt = Date.now()
  let stableSince = Date.now()
  let previousSignature = ''

  while (Date.now() - startedAt < timeoutMs) {
    const signature = JSON.stringify({
      pageUpdated: countEvents(
        dev.getOutput(),
        (event) => event?.type === 'page_html' && event?.stage === 'updated'
      ),
      styleUpdated: countEvents(
        dev.getOutput(),
        (event) =>
          event?.type === 'shadow_style_output' && event?.stage === 'updated'
      ),
      sourceSnapshots: countEvents(
        dev.getOutput(),
        (event) =>
          event?.type === 'action_event' &&
          event?.action === 'source_snapshot_captured' &&
          event?.stage === 'updated'
      )
    })

    if (signature !== previousSignature) {
      previousSignature = signature
      stableSince = Date.now()
    } else if (Date.now() - stableSince >= quietMs) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

async function waitForInitialInjection({
  dev,
  label,
  reinjectKey,
  styleExpectation,
  visibleTextHint
}) {
  await waitFor(
    async () => {
      if (dev.hasExited()) {
        throw new Error(
          `[${label}] dev child exited early before initial injection\n\n${dev
            .getOutput()
            .slice(-5000)}`
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
      const hasVisibleMount =
        !!visibleTextHint &&
        typeof pageHtml?.html === 'string' &&
        includesComparableText(pageHtml.html, visibleTextHint)
      const hasInjectedStyle =
        hasInjectedStyleOutput(styleOutput, styleExpectation) ||
        hasInjectedStyleInPageHtml(pageHtml, styleExpectation)
      return (
        injected &&
        hasInjectedStyle &&
        ((rootMeta &&
          rootMeta.generation >= 1 &&
          (rootMeta.status === undefined || rootMeta.status === 'mounted') &&
          rootMeta.rootCount >= 1) ||
          hasVisibleMount)
      )
    },
    timeoutMs,
    `${label} initial ${browser} content injection`
  )
}

async function runScriptMutationScenario({
  dev,
  label,
  reinjectKey,
  absoluteScriptPath,
  originalSource,
  styleExpectation,
  visibleTextHint
}) {
  const editMarker = `extjs-${browser}-live-${label}-${Date.now()}`
  const initialRootMeta = latestRootMeta(dev.getOutput(), reinjectKey)
  const beforeUpdatedCount = countEvents(
    dev.getOutput(),
    (event) => event?.type === 'page_html' && event?.stage === 'updated'
  )
  const beforeReloadCount = countEvents(
    dev.getOutput(),
    (event) =>
      event?.type === 'action_event' && event?.action === 'extension_reload'
  )

  const mutatedSource = /Live Update Proof(?: [A-Za-z0-9_-]+)?/.test(
    String(originalSource || '')
  )
    ? replaceVisibleProofToken(originalSource, editMarker)
    : appendContentHeadingProbe(originalSource, editMarker)

  await fs.writeFile(absoluteScriptPath, mutatedSource, 'utf8')

  await waitFor(
    async () => {
      if (dev.hasExited()) {
        throw new Error(
          `[${label}] dev child exited early before updated reinjection\n\n${dev
            .getOutput()
            .slice(-5000)}`
        )
      }
      const updatedCount = countEvents(
        dev.getOutput(),
        (event) => event?.type === 'page_html' && event?.stage === 'updated'
      )
      if (updatedCount <= beforeUpdatedCount) return false
      const reloadCount = countEvents(
        dev.getOutput(),
        (event) =>
          event?.type === 'action_event' && event?.action === 'extension_reload'
      )
      const rootMeta = latestRootMeta(dev.getOutput(), reinjectKey)
      const pageHtml = latestPageHtml(dev.getOutput(), 'updated')
      const styleOutput =
        latestShadowStyleOutput(dev.getOutput(), 'updated') ||
        latestShadowStyleOutput(dev.getOutput(), 'post_injection')
      const hasVisibleUpdate =
        typeof pageHtml?.html === 'string' &&
        includesComparableText(pageHtml.html, editMarker)
      const hasInjectedStyle =
        hasInjectedStyleOutput(styleOutput, styleExpectation) ||
        hasInjectedStyleInPageHtml(pageHtml, styleExpectation)
      return (
        reloadCount === beforeReloadCount &&
        hasInjectedStyle &&
        (hasVisibleUpdate ||
          (rootMeta &&
            initialRootMeta &&
            (rootMeta.generation > initialRootMeta.generation ||
              (rootMeta.buildToken &&
                initialRootMeta.buildToken &&
                rootMeta.buildToken !== initialRootMeta.buildToken) ||
              hasBuildChange(initialRootMeta, rootMeta)) &&
            (rootMeta.status === undefined || rootMeta.status === 'mounted') &&
            rootMeta.rootCount >= 1))
      )
    },
    timeoutMs,
    `${label} updated ${browser} content reinjection`
  )

  await waitForUpdatedOutputToSettle(dev)

  const beforeRestoreUpdatedCount = countEvents(
    dev.getOutput(),
    (event) => event?.type === 'page_html' && event?.stage === 'updated'
  )
  const restoreTimestamp = new Date().toISOString()
  await fs.writeFile(absoluteScriptPath, originalSource, 'utf8')

  await waitFor(
    async () => {
      if (dev.hasExited()) {
        throw new Error(
          `[${label}] dev child exited early before restored reinjection\n\n${dev
            .getOutput()
            .slice(-5000)}`
        )
      }
      const updatedCount = countEvents(
        dev.getOutput(),
        (event) => event?.type === 'page_html' && event?.stage === 'updated'
      )
      if (updatedCount <= beforeRestoreUpdatedCount) return false
      const pageHtml =
        latestEvent(
          dev.getOutput(),
          (event) =>
            event?.type === 'page_html' &&
            event?.stage === 'updated' &&
            typeof event?.timestamp === 'string' &&
            event.timestamp >= restoreTimestamp
        ) || latestPageHtml(dev.getOutput(), 'updated')
      const styleOutput =
        latestEvent(
          dev.getOutput(),
          (event) =>
            event?.type === 'shadow_style_output' &&
            event?.stage === 'updated' &&
            typeof event?.timestamp === 'string' &&
            event.timestamp >= restoreTimestamp
        ) ||
        latestShadowStyleOutput(dev.getOutput(), 'updated') ||
        latestShadowStyleOutput(dev.getOutput(), 'post_injection')
      const hasInjectedStyle =
        hasInjectedStyleOutput(styleOutput, styleExpectation) ||
        hasInjectedStyleInPageHtml(pageHtml, styleExpectation)
      const markerRemoved =
        typeof pageHtml?.html === 'string' &&
        !includesComparableText(pageHtml.html, editMarker)
      const baselineVisible =
        !visibleTextHint ||
        (typeof pageHtml?.html === 'string' &&
          includesComparableText(pageHtml.html, visibleTextHint))
      return hasInjectedStyle && markerRemoved && baselineVisible
    },
    timeoutMs,
    `${label} restored ${browser} content reinjection`
  )
}

async function runCssMutationScenario({
  dev,
  label,
  reinjectKey,
  absoluteStylePath,
  originalStyleSource,
  styleExpectation
}) {
  const editMarker = `extjs-${browser}-css-${label}-${Date.now()}`
  const {selector, nextSource} = appendCssMutation(
    originalStyleSource,
    editMarker
  )
  const initialRootMeta = latestRootMeta(dev.getOutput(), reinjectKey)
  const beforeUpdatedPageCount = countEvents(
    dev.getOutput(),
    (event) => event?.type === 'page_html' && event?.stage === 'updated'
  )
  const beforeUpdatedStyleCount = countEvents(
    dev.getOutput(),
    (event) =>
      event?.type === 'shadow_style_output' && event?.stage === 'updated'
  )
  const beforeReloadCount = countEvents(
    dev.getOutput(),
    (event) =>
      event?.type === 'action_event' && event?.action === 'extension_reload'
  )

  await fs.writeFile(absoluteStylePath, nextSource, 'utf8')

  await waitFor(
    async () => {
      if (dev.hasExited()) {
        throw new Error(
          `[${label}] dev child exited early before CSS reinjection\n\n${dev
            .getOutput()
            .slice(-5000)}`
        )
      }
      const updatedPageCount = countEvents(
        dev.getOutput(),
        (event) => event?.type === 'page_html' && event?.stage === 'updated'
      )
      const updatedStyleCount = countEvents(
        dev.getOutput(),
        (event) =>
          event?.type === 'shadow_style_output' && event?.stage === 'updated'
      )
      if (
        updatedPageCount <= beforeUpdatedPageCount &&
        updatedStyleCount <= beforeUpdatedStyleCount
      ) {
        return false
      }
      const reloadCount = countEvents(
        dev.getOutput(),
        (event) =>
          event?.type === 'action_event' && event?.action === 'extension_reload'
      )
      const rootMeta = latestRootMeta(dev.getOutput(), reinjectKey)
      const pageHtml =
        latestPageHtml(dev.getOutput(), 'updated') ||
        latestPageHtml(dev.getOutput(), 'post_injection')
      const styleOutput =
        latestShadowStyleOutput(dev.getOutput(), 'updated') ||
        latestShadowStyleOutput(dev.getOutput(), 'post_injection')
      const hasInjectedStyle =
        hasInjectedStyleOutput(styleOutput, styleExpectation) ||
        hasInjectedStyleInPageHtml(pageHtml, styleExpectation)
      const markerPresent = styleOutputIncludesMarker(
        styleOutput,
        pageHtml,
        selector
      )
      const hasLifecycleChange =
        rootMeta &&
        initialRootMeta &&
        (rootMeta.generation > initialRootMeta.generation ||
          (rootMeta.buildToken &&
            initialRootMeta.buildToken &&
            rootMeta.buildToken !== initialRootMeta.buildToken) ||
          hasBuildChange(initialRootMeta, rootMeta))
      return (
        reloadCount === beforeReloadCount &&
        markerPresent &&
        hasInjectedStyle &&
        (hasLifecycleChange ||
          updatedStyleCount > beforeUpdatedStyleCount ||
          updatedPageCount > beforeUpdatedPageCount)
      )
    },
    timeoutMs,
    `${label} updated ${browser} CSS reinjection`
  )
}

async function runTemplateScenario(template, scenario, attempt) {
  const {templateLabel, exampleDir} = resolveTemplateContext(template)
  const browserDistDir = path.join(exampleDir, 'dist', browser)
  const manifestPath = path.join(exampleDir, 'src', 'manifest.json')
  const manifest = await readJson(manifestPath)
  const target = resolveContentScriptTarget(manifest, scenario)
  const declaredScriptPath = target.scriptPath
  const mutationRelativePath =
    typeof scenario.mutationRelativePath === 'string' &&
    scenario.mutationRelativePath.trim().length > 0
      ? scenario.mutationRelativePath.trim()
      : declaredScriptPath.replace(/^\.\//, '')
  const absoluteDeclaredScriptPath = path.join(
    exampleDir,
    'src',
    declaredScriptPath.replace(/^\.\//, '')
  )
  const absoluteMutationPath = path.join(
    exampleDir,
    'src',
    mutationRelativePath
  )
  const originalDeclaredScriptSource = await fs.readFile(
    absoluteDeclaredScriptPath,
    'utf8'
  )
  const originalMutationSource = await fs.readFile(absoluteMutationPath, 'utf8')
  const styleExpectation = await resolveContentStyleExpectation(
    absoluteDeclaredScriptPath,
    originalDeclaredScriptSource
  )
  const reinjectKey = resolveReinjectKey(manifest, declaredScriptPath)
  const visibleTextHint = deriveVisibleTextHint(originalMutationSource)
  const scenarioLabel = `${templateLabel}:${scenario.id}`
  const runId = createRunId([
    'content-live',
    browser,
    templateLabel,
    scenario.id,
    `attempt-${attempt}`
  ])
  const profileDir = createVerifyProfileDir(runId)
  const absoluteStylePath = styleExpectation?.absoluteStylePath
  const originalStyleSource =
    scenario.type === 'css' && absoluteStylePath
      ? await fs.readFile(absoluteStylePath, 'utf8')
      : null

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
    await waitForInitialInjection({
      dev,
      label: scenarioLabel,
      reinjectKey,
      styleExpectation,
      visibleTextHint
    })

    if (scenario.type === 'css') {
      if (!absoluteStylePath || originalStyleSource === null) {
        throw new Error(
          `[${scenarioLabel}] no stylesheet could be resolved for CSS mutation`
        )
      }
      await runCssMutationScenario({
        dev,
        label: scenarioLabel,
        reinjectKey,
        absoluteStylePath,
        originalStyleSource,
        styleExpectation
      })
    } else {
      await runScriptMutationScenario({
        dev,
        label: scenarioLabel,
        reinjectKey,
        absoluteScriptPath: absoluteMutationPath,
        originalSource: originalMutationSource,
        styleExpectation,
        visibleTextHint
      })
    }

    return {
      template: templateLabel,
      browser,
      scenario: scenario.id,
      status: 'PASS',
      reinjectKey
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `[${scenarioLabel}] ${message}\n\n${buildFailureSummary(
        dev.getOutput(),
        reinjectKey
      )}`
    )
  } finally {
    await fs.writeFile(absoluteMutationPath, originalMutationSource, 'utf8')
    if (absoluteStylePath && originalStyleSource !== null) {
      await fs.writeFile(absoluteStylePath, originalStyleSource, 'utf8')
    }
    await stopChild(dev.child)
    await fs.rm(profileDir, {recursive: true, force: true}).catch(() => {})
  }
}

async function main() {
  const results = []

  if (templates.length === 0) {
    console.warn(
      '[verify-content-live] no templates left to run (e.g. all were skipped for this browser).'
    )
    process.exit(0)
  }

  for (const template of templates) {
    const scenarios = getTemplateScenarios(template)
    for (const scenario of scenarios) {
      const scenarioLabel = `${template}:${scenario.id}`
      try {
        console.log(`[${scenarioLabel}] starting ${browser} live verification`)
        const result = await runWithRetries({
          retries,
          label: `${browser}:${scenarioLabel}`,
          shouldRetry: isRetryableBrowserFailure,
          execute: (attempt) => runTemplateScenario(template, scenario, attempt)
        })
        results.push(result)
        console.log(`[${scenarioLabel}] PASS`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({
          template,
          browser,
          scenario: scenario.id,
          status: 'FAIL',
          error: message
        })
        console.error(`[${scenarioLabel}] FAIL`)
        console.error(message)
      }
    }
  }

  console.log(
    `\n[verify-content-live:${browser}] results=` +
      JSON.stringify(results, null, 2)
  )

  const failures = results.filter((result) => result.status !== 'PASS')
  if (failures.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
})
