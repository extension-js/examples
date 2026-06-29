#!/usr/bin/env node
// Deterministic Firefox content-script reload gate — self-launch + RDP edition.
//
// Why this exists: the Playwright `firefox-content-reload` project drives the
// browser that `extension dev` launches. In headless macOS sandboxes that
// launched profile crashes Firefox's SWGL compositor before its RDP server is
// ready ("RenderCompositorSWGL failed mapping default framebuffer"), so the gate
// can't run there. This harness sidesteps that: it runs `extension dev
// --no-browser --browser=firefox` (bridge + watch only, no launcher) and
// self-launches a MINIMAL-profile headless Firefox that renders fine, installs
// the freshly built `dist/firefox` over RDP, then asserts a JS edit AND a CSS
// edit re-inject into an already-open tab IN PLACE — the SAME control-bridge SW
// producer (chrome.scripting) that launched Firefox also uses post-Option-B.
//
// Reload is never triggered manually: no page reload after the initial mount.
// If the broadcast/re-injection chain regresses for Firefox, the marker never
// appears and this exits non-zero.
//
// Firefox binary discovery (first that exists):
//   1. $EXTENSION_GECKO_BINARY
//   2. extension.js browser cache, newest stable build
//   3. /Applications/Firefox.app
// Requires the local CLI: $EXTENSION_LOCAL_CLI_CJS (or programs/extension/dist/cli.cjs).

import {spawn} from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as net from 'node:net'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const examplesRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(examplesRoot, '..', '..')

const PROJ = process.argv[2] || path.join(examplesRoot, 'examples', 'content')
const CLI =
  process.env.EXTENSION_LOCAL_CLI_CJS ||
  path.join(repoRoot, 'programs', 'extension', 'dist', 'cli.cjs')
const RDP = Number(process.env.RDP_PORT || 9361)
const DEV_PORT = process.env.DEV_PORT || '8081'

const addonPath = path.join(PROJ, 'dist', 'firefox')
const scriptPath = path.join(PROJ, 'src', 'content', 'scripts.js')
const stylePath = path.join(PROJ, 'src', 'content', 'styles.css')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log('[ff-reload]', ...a)

function discoverFirefox() {
  const env = (process.env.EXTENSION_GECKO_BINARY || '').trim()
  if (env && fs.existsSync(env)) return env
  // extension.js cache: newest "stable" build wins.
  const cacheDir = path.join(
    os.homedir(),
    'Library/Caches/extension.js/browsers/firefox/firefox'
  )
  try {
    const builds = fs
      .readdirSync(cacheDir)
      .filter((d) => /stable/i.test(d))
      .sort()
      .reverse()
    for (const b of builds) {
      const bin = path.join(cacheDir, b, 'Firefox.app/Contents/MacOS/firefox')
      if (fs.existsSync(bin)) return bin
    }
  } catch {}
  const sys = '/Applications/Firefox.app/Contents/MacOS/firefox'
  if (fs.existsSync(sys)) return sys
  throw new Error('No Firefox binary found (set EXTENSION_GECKO_BINARY)')
}

// --- minimal RDP client (length-prefixed JSON packets) ----------------------
function session(port) {
  const sock = net.createConnection({host: '127.0.0.1', port})
  let buf = Buffer.alloc(0)
  const waiters = []
  sock.on('data', (c) => {
    buf = Buffer.concat([buf, c])
    while (true) {
      const i = buf.indexOf(0x3a) // ':'
      if (i < 0) break
      const len = Number(buf.subarray(0, i).toString())
      if (!Number.isFinite(len) || buf.length < i + 1 + len) break
      const body = buf.subarray(i + 1, i + 1 + len).toString()
      buf = buf.subarray(i + 1 + len)
      let p
      try {
        p = JSON.parse(body)
      } catch {
        continue
      }
      for (let k = 0; k < waiters.length; k++) {
        if (waiters[k].match(p)) {
          waiters.splice(k, 1)[0].resolve(p)
          break
        }
      }
    }
  })
  return {
    send: (p) => {
      const j = JSON.stringify(p)
      sock.write(Buffer.from(`${Buffer.byteLength(j)}:${j}`))
    },
    expect: (match, ms = 12000) =>
      new Promise((resolve, reject) => {
        const w = {match, resolve}
        waiters.push(w)
        setTimeout(() => {
          const i = waiters.indexOf(w)
          if (i >= 0) {
            waiters.splice(i, 1)
            reject(new Error('rdp timeout'))
          }
        }, ms)
      }),
    close: () => {
      try {
        sock.end()
      } catch {}
    }
  }
}

// Evaluate an expression in the example.com tab's content context. Opens a fresh
// RDP socket per call (the producer re-injects under us; a long-lived console
// actor can be torn down mid-reinject).
async function tabEval(expr) {
  const s = session(RDP)
  try {
    await s.expect((p) => p.from === 'root' && p.applicationType)
    s.send({to: 'root', type: 'listTabs'})
    const lt = await s.expect((p) => p.from === 'root' && p.tabs)
    const tab =
      (lt.tabs || []).find((t) =>
        String(t.url || '').includes('example.com')
      ) || lt.tabs[0]
    if (!tab) return null
    s.send({to: tab.actor, type: 'getTarget'})
    const tg = await s.expect((p) => p.from === tab.actor)
    const ca = tg?.frame?.consoleActor || tg?.consoleActor
    if (!ca) return null
    s.send({to: ca, type: 'evaluateJSAsync', text: expr})
    const ev = await s.expect(
      (p) => p.from === ca && p.type === 'evaluationResult'
    )
    return ev.result
  } catch {
    return null
  } finally {
    s.close()
  }
}

const TITLE_EXPR = `JSON.stringify((function(){var h=document.querySelector('[data-extension-root="true"]');var sr=h&&h.shadowRoot;var e=sr&&sr.querySelector('.content_title');return e?e.textContent:null})())`

function styleExpr(prop) {
  const p = JSON.stringify(prop)
  return `JSON.stringify((function(){var h=document.querySelector('[data-extension-root="true"]');var sr=h&&h.shadowRoot;var el=sr&&sr.querySelector('.content_script');if(!el)return '';var v=(el.ownerDocument.defaultView||window).getComputedStyle(el).getPropertyValue(${p});return (v||'').replace(/['"\\s]/g,'')})())`
}

async function pollEval(
  expr,
  predicate,
  {timeoutMs = 30000, every = 800} = {}
) {
  const start = Date.now()
  let last = null
  while (Date.now() - start < timeoutMs) {
    last = await tabEval(expr)
    if (predicate(last)) return {ok: true, value: last}
    await wait(every)
  }
  return {ok: false, value: last}
}

function latestBundleMtime() {
  let latest = 0
  for (const root of ['.extension', 'dist', 'build']) {
    for (const ch of ['firefox', 'gecko']) {
      const csDir = path.join(PROJ, root, ch, 'content_scripts')
      if (!fs.existsSync(csDir)) continue
      try {
        for (const f of fs.readdirSync(csDir)) {
          if (!/\.js$/.test(f) || /\.map$/.test(f)) continue
          const mt = fs.statSync(path.join(csDir, f)).mtimeMs
          if (mt > latest) latest = mt
        }
      } catch {}
    }
  }
  return latest
}

async function waitForReemit(baseline, timeoutMs = 45000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (latestBundleMtime() > baseline) return true
    await wait(200)
  }
  return false
}

async function main() {
  if (!fs.existsSync(CLI)) throw new Error(`CLI not found: ${CLI}`)
  const FF = discoverFirefox()
  log('CLI:', CLI)
  log('Firefox:', FF)
  log('project:', PROJ)

  const ORIGINAL_JS = fs.readFileSync(scriptPath, 'utf8')
  const ORIGINAL_CSS = fs.readFileSync(stylePath, 'utf8')

  // 1) dev --no-browser firefox: bridge + watch, build dist/firefox. No launcher.
  const dev = spawn(
    'node',
    [
      CLI,
      'dev',
      '--browser',
      'firefox',
      '--no-browser',
      '--port',
      DEV_PORT,
      PROJ
    ],
    {cwd: PROJ, stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env}}
  )
  let devOut = ''
  dev.stdout.on('data', (d) => (devOut += d))
  dev.stderr.on('data', (d) => (devOut += d))

  // 2) minimal-profile headless Firefox + RDP.
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'ffprof-'))
  fs.writeFileSync(
    path.join(prof, 'user.js'),
    [
      'user_pref("devtools.debugger.remote-enabled",true);',
      'user_pref("devtools.debugger.prompt-connection",false);',
      'user_pref("devtools.chrome.enabled",true);',
      'user_pref("xpinstall.signatures.required",false);',
      'user_pref("browser.shell.checkDefaultBrowser",false);'
    ].join('\n')
  )

  const failures = []
  let ff
  let rdp
  try {
    // Wait for dist/firefox to be built.
    let built = false
    for (let i = 0; i < 80; i++) {
      if (fs.existsSync(path.join(addonPath, 'manifest.json'))) {
        built = true
        break
      }
      await wait(500)
    }
    if (!built)
      throw new Error('dist/firefox not built\n' + devOut.slice(-1500))
    await wait(1500)
    log('dist/firefox built')

    ff = spawn(
      FF,
      [
        '-profile',
        prof,
        '-start-debugger-server',
        String(RDP),
        '-headless',
        '-no-remote',
        'https://example.com'
      ],
      {stdio: 'ignore', env: {...process.env, MOZ_HEADLESS: '1'}}
    )
    await wait(7000)

    rdp = session(RDP)
    await rdp.expect((p) => p.from === 'root' && p.applicationType, 20000)
    rdp.send({to: 'root', type: 'getRoot'})
    const root = await rdp.expect((p) => p.from === 'root' && p.addonsActor)
    rdp.send({to: root.addonsActor, type: 'installTemporaryAddon', addonPath})
    const inst = await rdp.expect((p) => p.addon || p.error)
    if (inst.error) throw new Error('installTemporaryAddon: ' + inst.message)
    log('installed addon', inst.addon.id)

    // Reload the tab once so the freshly installed content script mounts.
    await tabEval('location.reload()')

    // --- self-mount ---
    const mount = await pollEval(
      TITLE_EXPR,
      (t) => t === '"Content Template"',
      {
        timeoutMs: 45000
      }
    )
    if (!mount.ok)
      throw new Error('content script never mounted: ' + mount.value)
    log('PASS  self-mount:', mount.value)

    // --- JS edit in place ---
    {
      const marker = 'FFReload-' + Date.now()
      const baseline = latestBundleMtime()
      fs.writeFileSync(
        scriptPath,
        ORIGINAL_JS.split('Content Template').join(marker),
        'utf8'
      )
      await waitForReemit(baseline)
      const r = await pollEval(
        TITLE_EXPR,
        (t) => typeof t === 'string' && t.includes(marker),
        {timeoutMs: 45000}
      )
      if (r.ok) log('PASS  JS edit re-injected in place')
      else failures.push(`JS edit not observed (last=${r.value})`)

      const revertBaseline = latestBundleMtime()
      fs.writeFileSync(scriptPath, ORIGINAL_JS, 'utf8')
      await waitForReemit(revertBaseline)
      const rv = await pollEval(TITLE_EXPR, (t) => t === '"Content Template"', {
        timeoutMs: 45000
      })
      if (rv.ok) log('PASS  JS revert restored anchor')
      else failures.push(`JS revert not observed (last=${rv.value})`)
    }

    // --- CSS edit in place ---
    {
      const probe = `--reload-probe-${Date.now()}`
      const marker = Date.now().toString(36)
      // Stylesheet must be live first.
      const live = await pollEval(
        styleExpr('color'),
        (v) => v && v !== '""' && v !== '',
        {
          timeoutMs: 30000
        }
      )
      if (!live.ok) failures.push('stylesheet never became live')

      const baseline = latestBundleMtime()
      fs.writeFileSync(
        stylePath,
        `${ORIGINAL_CSS}\n.content_script { ${probe}: "${marker}"; }\n`,
        'utf8'
      )
      await waitForReemit(baseline)
      const r = await pollEval(
        styleExpr(probe),
        (v) => v === `"${marker}"` || v === marker,
        {
          timeoutMs: 45000
        }
      )
      if (r.ok) log('PASS  CSS edit re-injected in place')
      else failures.push(`CSS edit not observed (last=${r.value})`)

      const revertBaseline = latestBundleMtime()
      fs.writeFileSync(stylePath, ORIGINAL_CSS, 'utf8')
      await waitForReemit(revertBaseline)
      const rv = await pollEval(
        styleExpr(probe),
        (v) => v === '""' || v === '',
        {
          timeoutMs: 45000
        }
      )
      if (rv.ok) log('PASS  CSS revert cleared property')
      else failures.push(`CSS revert not observed (last=${rv.value})`)
    }
  } catch (e) {
    failures.push('FATAL: ' + (e && e.message ? e.message : String(e)))
  } finally {
    try {
      fs.writeFileSync(scriptPath, ORIGINAL_JS, 'utf8')
    } catch {}
    try {
      fs.writeFileSync(stylePath, ORIGINAL_CSS, 'utf8')
    } catch {}
    try {
      if (rdp) rdp.close()
    } catch {}
    try {
      if (ff) ff.kill('SIGKILL')
    } catch {}
    try {
      dev.kill('SIGKILL')
    } catch {}
  }

  if (failures.length) {
    log('RESULT: FAIL')
    for (const f of failures) log('  ✗', f)
    process.exit(1)
  }
  log('RESULT: PASS (Firefox JS + CSS reload in place)')
  process.exit(0)
}

main().catch((e) => {
  log('ERROR', e && e.message ? e.message : e)
  process.exit(2)
})
