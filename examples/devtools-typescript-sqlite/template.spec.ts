import {execSync} from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {chromium, expect, test} from '@playwright/test'
import {getDirname} from '../dirname.js'
import {resolveBuiltExtensionPath} from '../extension-fixtures.js'

const __dirname = getDirname(import.meta.url)

test.setTimeout(180_000)

const QUERY = `SELECT method, status, url
FROM requests
WHERE url LIKE '%/api/%'
ORDER BY url`

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Request fixture</title>
  </head>
  <body>
    <p id="state">waiting</p>
    <script>
      window.startRequests = async () => {
        document.querySelector('#state').textContent = 'loading'
        await fetch('/api/alpha.json', {cache: 'no-store'})
        await fetch('/api/beta.txt', {
          method: 'POST',
          headers: {'content-type': 'text/plain'},
          body: 'beta',
          cache: 'no-store'
        })
        await fetch('/api/missing.json', {cache: 'no-store'})
        document.querySelector('#state').textContent = 'done'
      }
    </script>
  </body>
</html>`

interface AttachedTarget {
  sessionId: string
  targetId: string
  type: string
  url: string
  title: string
}

interface QueryResult {
  error: string
  rows: string[][]
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0

      server.close(() => resolve(port))
    })

    server.on('error', reject)
  })
}

function readBody(req: http.IncomingMessage) {
  return new Promise<void>((resolve) => {
    req.on('data', () => undefined)
    req.on('end', () => resolve())
    req.resume()
  })
}

function startFixtureServer() {
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname

    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, {'content-type': 'text/html; charset=utf-8'})
      res.end(PAGE)

      return
    }

    if (req.method === 'GET' && pathname === '/api/alpha.json') {
      res.writeHead(200, {'content-type': 'application/json'})
      res.end('{"name":"alpha"}')

      return
    }

    if (req.method === 'POST' && pathname === '/api/beta.txt') {
      await readBody(req)
      res.writeHead(201, {'content-type': 'text/plain; charset=utf-8'})
      res.end('beta')

      return
    }

    if (req.method === 'GET' && pathname === '/api/missing.json') {
      res.writeHead(404, {'content-type': 'application/json'})
      res.end('{"error":"missing"}')

      return
    }

    res.writeHead(404, {'content-type': 'text/plain; charset=utf-8'})
    res.end('missing')
  })

  return new Promise<{origin: string; close: () => Promise<void>}>(
    (resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        const port = typeof address === 'object' && address ? address.port : 0

        resolve({
          origin: `http://127.0.0.1:${port}`,
          close: () =>
            new Promise<void>((done) => {
              server.close(() => done())
            })
        })
      })
    }
  )
}

async function waitForJson(port: number, pathname: string) {
  const started = Date.now()
  let lastError: unknown = null

  while (Date.now() - started < 20_000) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${pathname}`)

      if (response.ok) return response.json()
    } catch (error) {
      lastError = error
    }

    await sleep(200)
  }

  throw new Error(`debug port ${port} did not answer ${pathname}: ${lastError}`)
}

function queryExpression(sql: string) {
  return `(() => {
    const box = document.querySelector('#query')
    const button = document.querySelector('#run')
    if (!(box instanceof HTMLTextAreaElement) || !(button instanceof HTMLButtonElement)) {
      return {error: 'missing controls', rows: []}
    }
    box.value = ${JSON.stringify(sql)}
    button.click()
    return {
      error: document.querySelector('#queryError')?.textContent ?? '',
      rows: [...document.querySelectorAll('#results tbody tr')].map((row) =>
        [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
      )
    }
  })()`
}

// The Requests panel only receives chrome.devtools.network inside the real
// devtools window. Playwright does not surface that target as a page, so the
// proof attaches to it on the browser's debugging port and drives the panel
// document directly.
function connectBrowser(debuggerUrl: string) {
  const ws = new WebSocket(debuggerUrl)
  const pending = new Map<
    number,
    {resolve: (value: any) => void; reject: (error: Error) => void}
  >()
  const attached: AttachedTarget[] = []
  const consoleLines: string[] = []
  let nextId = 0
  let panelSessionId = ''

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as {
      id?: number
      method?: string
      sessionId?: string
      error?: {message?: string}
      result?: unknown
      params?: {
        sessionId?: string
        targetInfo?: {
          targetId?: string
          type?: string
          url?: string
          title?: string
        }
        exceptionDetails?: {text?: string; exception?: {description?: string}}
        args?: Array<{value?: unknown; description?: string}>
      }
    }

    if (message.id && pending.has(message.id)) {
      const waiter = pending.get(message.id)

      pending.delete(message.id)

      if (!waiter) return

      if (message.error) {
        waiter.reject(new Error(message.error.message || 'cdp error'))

        return
      }

      waiter.resolve(message.result)

      return
    }

    if (
      message.method === 'Target.attachedToTarget' &&
      message.params?.sessionId &&
      message.params.targetInfo?.targetId
    ) {
      attached.push({
        sessionId: message.params.sessionId,
        targetId: message.params.targetInfo.targetId,
        type: message.params.targetInfo.type || '',
        url: message.params.targetInfo.url || '',
        title: message.params.targetInfo.title || ''
      })
    }

    if (message.sessionId && message.sessionId === panelSessionId) {
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params?.exceptionDetails

        consoleLines.push(
          details?.exception?.description || details?.text || 'exception'
        )
      }

      if (message.method === 'Runtime.consoleAPICalled') {
        const text = (message.params?.args || [])
          .map((arg) => arg.description || String(arg.value))
          .join(' ')

        consoleLines.push(text)
      }
    }
  })

  const opened = new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve())
    ws.addEventListener('error', () => reject(new Error('debug socket failed')))
  })

  const send = (method: string, params: object = {}, sessionId?: string) => {
    const id = ++nextId

    return new Promise((resolve, reject) => {
      pending.set(id, {resolve, reject})
      const payload: {
        id: number
        method: string
        params: object
        sessionId?: string
      } = {id, method, params}

      if (sessionId) payload.sessionId = sessionId

      ws.send(JSON.stringify(payload))
    })
  }

  const evaluate = async (sessionId: string, expression: string) => {
    const result = (await send(
      'Runtime.evaluate',
      {expression, awaitPromise: true, returnByValue: true},
      sessionId
    )) as {
      result?: {value?: unknown}
      exceptionDetails?: {text?: string; exception?: {description?: string}}
    }

    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text ||
          'panel evaluation failed'
      )
    }

    return result.result?.value
  }

  return {
    ws,
    attached,
    consoleLines,
    opened,
    send,
    evaluate,
    watchPanel(sessionId: string) {
      panelSessionId = sessionId
    }
  }
}

async function showRequestsPanel(browser: ReturnType<typeof connectBrowser>) {
  await browser.opened
  await browser.send('Target.setDiscoverTargets', {discover: true})
  await browser.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true
  })

  const started = Date.now()
  let devtools: AttachedTarget | undefined

  while (Date.now() - started < 20_000) {
    const pages = browser.attached.filter(
      (target) =>
        target.type === 'page' && target.url.startsWith('devtools://devtools/')
    )

    devtools =
      pages.find((target) => target.title.includes('Request fixture')) ||
      (pages.length === 1 ? pages[0] : undefined)

    if (devtools) break

    await sleep(200)
  }

  if (!devtools) {
    throw new Error(
      `devtools did not open: ${browser.attached
        .map((target) => `${target.type} ${target.title} ${target.url}`)
        .join(' | ')}`
    )
  }

  await browser.send('Runtime.enable', {}, devtools.sessionId)

  const selectStarted = Date.now()
  let selected: {ok?: boolean; id?: string; reason?: string; ids?: string[]} =
    {}

  while (Date.now() - selectStarted < 20_000) {
    selected = (await browser.evaluate(
      devtools.sessionId,
      `(() => {
        const find = (widget, pred, depth) => {
          if (!widget || depth > 8) return null
          if (pred(widget)) return widget
          const children = typeof widget.children === 'function' ? widget.children() : []
          for (const child of children) {
            const found = find(child, pred, depth + 1)
            if (found) return found
          }
          return null
        }
        if (typeof UI === 'undefined' || !UI.panels || !UI.panels.elements) {
          return {ok: false, reason: 'devtools ui is not ready'}
        }
        let root = UI.panels.elements
        const seen = new Set()
        while (root && root.parentWidget && root.parentWidget() && !seen.has(root)) {
          seen.add(root)
          root = root.parentWidget()
        }
        const tabbed = find(root, (widget) => typeof widget.tabIds === 'function' && typeof widget.selectTab === 'function', 0)
        if (!tabbed) return {ok: false, reason: 'tab strip is missing'}
        const id = tabbed.tabIds().find((tabId) => String(tabId).startsWith('chrome-extension://'))
        if (!id) return {ok: false, reason: 'requests panel is not registered', ids: tabbed.tabIds()}
        const selected = tabbed.selectTab(id, true)
        const finish = () => ({
          ok: tabbed.selectedTabId === id,
          id,
          selected: tabbed.selectedTabId
        })
        if (selected && typeof selected.then === 'function') return selected.then(finish)
        return finish()
      })()`
    )) as {ok?: boolean; id?: string; reason?: string; ids?: string[]}

    if (selected?.ok) break

    await sleep(250)
  }

  if (!selected?.ok) {
    throw new Error(
      `could not show the Requests panel: ${JSON.stringify(selected)}`
    )
  }

  const panelStarted = Date.now()
  let panelSessionId = ''
  let seen = ''

  while (Date.now() - panelStarted < 20_000) {
    const listed = (await browser.send('Target.getTargets')) as {
      targetInfos?: Array<{
        targetId: string
        type: string
        url: string
        title: string
      }>
    }
    const infos = listed.targetInfos || []

    seen = infos
      .map((target) => `${target.type} ${target.url.slice(0, 140)}`)
      .join(' | ')

    const info = infos.find((target) =>
      target.url.includes('/panel/index.html')
    )

    if (info) {
      const known = browser.attached.find(
        (target) => target.targetId === info.targetId
      )

      panelSessionId =
        known?.sessionId ||
        (
          (await browser.send('Target.attachToTarget', {
            targetId: info.targetId,
            flatten: true
          })) as {sessionId: string}
        ).sessionId

      break
    }

    await sleep(200)
  }

  if (!panelSessionId) {
    throw new Error(`the Requests panel iframe did not load: ${seen}`)
  }

  browser.watchPanel(panelSessionId)
  await browser.send('Runtime.enable', {}, panelSessionId)
  await browser
    .send('Console.enable', {}, panelSessionId)
    .catch(() => undefined)

  return panelSessionId
}

let extensionPath = ''

test.beforeAll(() => {
  execSync(
    `node ../../scripts/build-with-manifest.mjs build --browser=chrome`,
    {
      cwd: __dirname,
      stdio: 'inherit'
    }
  )

  extensionPath = resolveBuiltExtensionPath(__dirname)
})

test('loads the inspected requests and returns the queried rows', async () => {
  const bundle = fs.readFileSync(
    path.join(extensionPath, 'panel/index.js'),
    'utf8'
  )
  const wasmPath = path.join(extensionPath, 'sql-wasm-browser.wasm')

  expect(bundle).not.toMatch(/https?:\/\/[^'"\s]+\.wasm/)
  expect(fs.statSync(wasmPath).size).toBeGreaterThan(100_000)

  const fixture = await startFixtureServer()
  const debugPort = await freePort()
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-request-sql-'))
  const isHeadless = process.env.HEADLESS === 'true'
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: isHeadless,
    ...(isHeadless ? {channel: 'chromium' as const} : {}),
    viewport: {width: 1280, height: 800},
    args: [
      `--remote-debugging-port=${debugPort}`,
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--auto-open-devtools-for-tabs',
      '--no-first-run',
      '--no-default-browser-check'
    ]
  })

  const version = await waitForJson(debugPort, '/json/version')
  const browser = connectBrowser(version.webSocketDebuggerUrl as string)

  try {
    const page = context.pages()[0] || (await context.newPage())

    await page.goto(fixture.origin, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    })

    await expect(page.locator('#state')).toHaveText('waiting')

    const panelSessionId = await showRequestsPanel(browser)
    const readyStarted = Date.now()
    let ready: {
      heading?: string
      status?: string
      meta?: string
      resources?: string[]
    } = {}

    while (Date.now() - readyStarted < 30_000) {
      ready = (await browser.evaluate(
        panelSessionId,
        `({
          heading: document.querySelector('h1')?.textContent ?? '',
          status: document.querySelector('#status')?.textContent ?? '',
          meta: document.querySelector('#statusMeta')?.textContent ?? '',
          resources: performance.getEntriesByType('resource').map((entry) => entry.name)
        })`
      )) as typeof ready

      if (ready.status === 'Ready' || ready.status === 'Failed to load') break

      await sleep(200)
    }

    expect(ready.status, browser.consoleLines.join('\n')).toBe('Ready')
    expect(ready.heading).toContain('Request SQL')
    expect(ready.meta).toMatch(/SQLite \d+\.\d+/)

    const resources = ready.resources || []

    // Extension pages often omit resource timing for their own wasm fetch.
    // Any timing entry that does show up must still be the packaged file,
    // and the panel must not have reached the network for it.
    expect(
      resources
        .filter((url) => url.includes('.wasm'))
        .every((url) => url.startsWith('chrome-extension://'))
    ).toBe(true)

    expect(resources.filter((url) => /^https?:/.test(url))).toEqual([])

    await page.evaluate(() => {
      const start = (window as unknown as {startRequests?: () => Promise<void>})
        .startRequests

      if (!start) throw new Error('the fixture page is missing startRequests')

      return start()
    })

    await expect(page.locator('#state')).toHaveText('done')

    const expected = [
      ['GET', '200', `${fixture.origin}/api/alpha.json`],
      ['POST', '201', `${fixture.origin}/api/beta.txt`],
      ['GET', '404', `${fixture.origin}/api/missing.json`]
    ]
    const queryStarted = Date.now()
    let queried: QueryResult = {error: '', rows: []}

    while (Date.now() - queryStarted < 15_000) {
      queried = (await browser.evaluate(
        panelSessionId,
        queryExpression(QUERY)
      )) as QueryResult

      if (
        queried.error === '' &&
        JSON.stringify(queried.rows) === JSON.stringify(expected)
      ) {
        break
      }

      await sleep(250)
    }

    expect(queried.error, browser.consoleLines.join('\n')).toBe('')
    expect(queried.rows).toEqual(expected)
  } finally {
    await context.close()
    browser.ws.close()
    await fixture.close()
    fs.rmSync(userDataDir, {recursive: true, force: true})
  }
})
