import {test, expect, chromium} from '@playwright/test'
import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
import {join} from 'node:path'
import {getDirname} from '../dirname.js'

type ReadyPayload = {
  status: 'starting' | 'ready' | 'error'
  command?: 'dev' | 'start'
  distPath: string
  runId?: string
  startedAt?: string
  message?: string
  errors?: string[]
}

type RunMode = 'dev' | 'start'

const __dirname = getDirname(import.meta.url)
const rawCliPath = join(__dirname, '..', '..', '..', '..', 'programs', 'cli', 'dist', 'cli.cjs')

function getProducerCommand(mode: RunMode) {
  if (existsSync(rawCliPath)) {
    return {
      command: process.execPath,
      args: [
        rawCliPath,
        mode,
        __dirname,
        '--no-browser',
        '--browser=chromium',
        '--install=false'
      ]
    }
  }

  // Fallback for generated standalone template projects.
  return {
    command: 'extension',
    args: [mode, '--no-browser', '--browser=chromium', '--install=false']
  }
}

function getWaitCommand(mode: RunMode) {
  if (existsSync(rawCliPath)) {
    return {
      command: process.execPath,
      args: [
        rawCliPath,
        mode,
        __dirname,
        '--wait',
        '--browser=chromium',
        '--wait-timeout=60000',
        '--wait-format=json',
        '--install=false'
      ]
    }
  }

  return {
    command: 'extension',
    args: [
      mode,
      '--wait',
      '--browser=chromium',
      '--wait-timeout=60000',
      '--wait-format=json',
      '--install=false'
    ]
  }
}

async function runCommandCaptureOrThrow(
  command: string,
  args: string[],
  cwd: string
): Promise<{stdout: string; stderr: string}> {
  return await new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
    const child = spawn(command, args, {cwd, stdio: 'pipe', env: process.env})
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()))
    child.on('error', (error) => reject(error))
    child.on('close', (code) => {
      if ((code ?? 1) === 0) {
        resolve({stdout, stderr})
      } else {
        reject(
          new Error(
            `Command failed (${String(code)}): ${command} ${args.join(' ')} ${stderr}`.trim()
          )
        )
      }
    })
  })
}

function parseWaitOutputOrThrow(stdout: string, mode: RunMode): ReadyPayload {
  const output = JSON.parse(stdout.trim()) as {
    ok?: boolean
    command?: string
    results?: ReadyPayload[]
  }
  const payload = output.results?.[0]
  if (!output.ok || !payload) {
    throw new Error('Wait output did not include a successful ready result')
  }
  if (output.command !== mode) {
    throw new Error(`Expected command=${mode} but got ${String(output.command)}`)
  }
  if (payload.status !== 'ready') {
    throw new Error(
      `Expected status=ready but got ${String(payload.status)} ${payload.message || ''}`.trim()
    )
  }
  return payload
}

test.describe('playwright contract-first flow', () => {
  test.setTimeout(120000)

  async function runFlow(mode: RunMode) {
    const producerCommand = getProducerCommand(mode)
    const child = spawn(producerCommand.command, producerCommand.args, {
      cwd: __dirname,
      stdio: 'inherit',
      env: process.env
    })

    let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null =
      null

      try {
        const waitCommand = getWaitCommand(mode)
        const waitOutput = await runCommandCaptureOrThrow(
          waitCommand.command,
          waitCommand.args,
          __dirname
        )
        const ready = parseWaitOutputOrThrow(waitOutput.stdout, mode)
        context = await chromium.launchPersistentContext('', {
          headless: false,
          args: [
            `--disable-extensions-except=${ready.distPath}`,
            `--load-extension=${ready.distPath}`
          ]
        })

        let worker = context.serviceWorkers()[0]
        if (!worker) {
          worker = await context.waitForEvent('serviceworker', {timeout: 15000})
        }
        const extensionId = new URL(worker.url()).hostname
        await expect(extensionId).toMatch(/^[a-z]{32}$/)

        const page = await context.newPage()
        await page.goto(`chrome-extension://${extensionId}/sidebar/index.html`)
        await expect(page.locator('h1')).toHaveText('Playwright Contract Example')
    } finally {
      if (context) await context.close()
      child.kill('SIGTERM')
    }
  }

  test('dev no-browser + wait enables deterministic launch', async () => {
    await runFlow('dev')
  })

  test('start no-browser + wait enables deterministic launch', async () => {
    await runFlow('start')
  })
})
