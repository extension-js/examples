// Firefox extension test fixtures using Playwright + Firefox RDP
//
// Strategy:
// 1. Launch Firefox via Playwright's firefox.launchPersistentContext with
//    a temp profile that has remote debugging enabled
// 2. Pass -start-debugger-server <port> to open the RDP socket
// 3. Connect a minimal RDP client and call installTemporaryAddon
// 4. Discover the moz-extension:// UUID from the profile's prefs.js
// 5. Expose page + extensionId (UUID) for Playwright assertions
//
// Limitation: Playwright's Juggler protocol cannot navigate to
// moz-extension:// URLs, and the patched Firefox RDP does not expose
// addon debugging (webExtensionDescriptor has no getTarget). Therefore
// extension page rendering is verified via built HTML content on disk,
// while content scripts are verified at runtime via Playwright.

import {
  test as base,
  firefox,
  type Page,
  type BrowserContext
} from '@playwright/test'
import net from 'net'
import path from 'path'
import fs from 'fs'
import os from 'os'

// ---------------------------------------------------------------------------
// Minimal RDP client — just enough for installTemporaryAddon + listTabs
// ---------------------------------------------------------------------------

function buildRdpFrame(obj: unknown): string {
  const body = JSON.stringify(obj)
  return `${Buffer.byteLength(body)}:${body}`
}

class RdpClient {
  private socket!: net.Socket
  private buffer: Buffer = Buffer.alloc(0)
  private dataResolve: (() => void) | null = null

  async connect(port: number, retries = 15, delayMs = 200): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const s = net.createConnection({host: '127.0.0.1', port}, () => {
            this.socket = s
            s.on('data', (chunk) => {
              this.buffer = Buffer.concat([this.buffer, chunk])
              if (this.dataResolve) {
                const fn = this.dataResolve
                this.dataResolve = null
                fn()
              }
            })
            resolve()
          })
          s.once('error', reject)
        })
        return
      } catch {
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, delayMs))
        }
      }
    }
    throw new Error(`Failed to connect to Firefox RDP on port ${port}`)
  }

  private tryParse(): any | null {
    const str = this.buffer.toString()
    const sep = str.indexOf(':')
    if (sep < 1) return null
    const len = parseInt(str.substring(0, sep), 10)
    if (isNaN(len)) return null
    const byteOffset = Buffer.byteLength(str.substring(0, sep + 1))
    if (this.buffer.length - byteOffset < len) return null
    const msg = this.buffer.slice(byteOffset, byteOffset + len)
    this.buffer = this.buffer.slice(byteOffset + len)
    return JSON.parse(msg.toString())
  }

  private async readOneMessage(timeoutMs = 8000): Promise<any> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const msg = this.tryParse()
      if (msg) return msg
      await new Promise<void>((resolve) => {
        this.dataResolve = resolve
        setTimeout(resolve, 100)
      })
    }
    throw new Error('RDP read timeout')
  }

  /** Consume the initial welcome packet Firefox sends on connect */
  async consumeWelcome(): Promise<any> {
    return this.readOneMessage()
  }

  async request(payload: any): Promise<any> {
    this.socket.write(buildRdpFrame(payload))
    // Read messages, skipping unsolicited events from other actors
    const deadline = Date.now() + 8000
    while (Date.now() < deadline) {
      const msg = await this.readOneMessage(
        Math.max(deadline - Date.now(), 500)
      )
      if (msg.from === payload.to || !msg.type || payload.to === 'root') {
        return msg
      }
    }
    throw new Error(
      `RDP request timeout waiting for response from ${payload.to}`
    )
  }

  /** Drain any unsolicited messages (events) from the buffer */
  drainEvents(): void {
    while (this.tryParse()) {
      // discard
    }
  }

  disconnect(): void {
    try {
      this.socket?.end()
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Port allocation
// ---------------------------------------------------------------------------

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as net.AddressInfo
      srv.close(() => resolve(addr.port))
    })
    srv.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// UUID discovery — reads prefs.js after addon install
// ---------------------------------------------------------------------------

async function getExtensionUuid(
  profileDir: string,
  addonId: string,
  maxRetries = 20,
  delayMs = 200
): Promise<string | undefined> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const prefsPath = path.join(profileDir, 'prefs.js')
      if (fs.existsSync(prefsPath)) {
        const content = fs.readFileSync(prefsPath, 'utf8')
        const uuidMatch = content.match(
          /user_pref\("extensions\.webextensions\.uuids",\s*"(.+?)"\)/
        )
        if (uuidMatch) {
          // Value is escaped JSON: {\"addon-id\":\"uuid\", ...}
          const jsonStr = uuidMatch[1].replace(/\\"/g, '"')
          const uuids = JSON.parse(jsonStr)
          if (uuids[addonId]) return uuids[addonId]
        }
      }
    } catch {
      // prefs.js may not exist yet or may be partially written
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Firefox build path resolution
// ---------------------------------------------------------------------------

export function resolveBuiltFirefoxExtensionPath(
  exampleDirAbsolute: string
): string {
  const roots = ['dist', 'build', '.extension']
  for (const root of roots) {
    const dir = path.join(exampleDirAbsolute, root, 'firefox')
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'manifest.json'))) {
      return dir
    }
  }
  return path.join(exampleDirAbsolute, 'dist', 'firefox')
}

// ---------------------------------------------------------------------------
// Firefox master preferences for test profile
// ---------------------------------------------------------------------------

const firefoxTestPrefs: Record<string, string | number | boolean> = {
  // Remote debugging
  'devtools.debugger.remote-enabled': true,
  'devtools.debugger.prompt-connection': false,
  'devtools.chrome.enabled': true,

  // Allow unsigned addons
  'xpinstall.signatures.required': false,

  // Suppress first-run / welcome UI
  'browser.aboutwelcome.enabled': false,
  'browser.startup.homepage_override.mstone': 'ignore',
  'browser.shell.didSkipDefaultBrowserCheckOnFirstRun': true,
  'browser.shell.checkDefaultBrowser': false,
  'datareporting.policy.dataSubmissionPolicyBypassNotification': true,
  'browser.startup.upgradeDialog.enabled': false,
  'browser.messaging-system.whatsNewPanel.enabled': false,
  'browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons': false,
  'browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features': false,

  // Disable updates / telemetry
  'app.update.enabled': false,
  'toolkit.telemetry.enabled': false,
  'extensions.update.enabled': false,
  'datareporting.policy.dataSubmissionEnabled': false,

  // Session / startup
  'browser.sessionstore.enabled': false,
  'browser.sessionstore.resume_from_crash': false,
  'browser.startup.page': 0,
  'browser.startup.homepage_welcome_url': 'about:blank',

  // Disable new-tab page
  'browser.newtabpage.enabled': false,

  // Extensions
  'extensions.autoDisableScopes': 10,
  'extensions.enabledScopes': 5,
  'extensions.installDistroAddons': false,
  'extensions.getAddons.cache.enabled': false
}

// ---------------------------------------------------------------------------
// RDP helpers
// ---------------------------------------------------------------------------

export interface RdpTab {
  actor: string
  url?: string
  title?: string
  outerWindowID?: number
}

/**
 * List tabs via RDP. Returns tab descriptors including moz-extension:// pages.
 */
export async function rdpListTabs(rdpClient: RdpClient): Promise<RdpTab[]> {
  rdpClient.drainEvents()
  const response = await rdpClient.request({to: 'root', type: 'listTabs'})
  return (response?.tabs || []) as RdpTab[]
}

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

export const firefoxExtensionFixtures = (pathToExtension: string) => {
  return base.extend<{
    context: BrowserContext
    page: Page
    extensionId: string
    rdp: RdpClient
  }>({
    context: async ({}, use) => {
      const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ff-ext-'))
      const rdpPort = await getFreePort()
      let context: BrowserContext | null = null
      let rdpClient: RdpClient | null = null

      try {
        // Launch Firefox with RDP server enabled
        context = await firefox.launchPersistentContext(profileDir, {
          headless: false, // Extensions require headed mode
          firefoxUserPrefs: firefoxTestPrefs,
          args: ['-start-debugger-server', String(rdpPort)]
        })

        // Connect RDP and install addon
        rdpClient = new RdpClient()
        await rdpClient.connect(rdpPort)
        await rdpClient.consumeWelcome()

        // Get addons actor
        const root = await rdpClient.request({to: 'root', type: 'getRoot'})
        const addonsActor: string | undefined = root?.addonsActor
        if (!addonsActor) {
          const tabs = await rdpClient.request({to: 'root', type: 'listTabs'})
          if (!tabs?.addonsActor) {
            throw new Error('Could not find addonsActor from Firefox RDP')
          }
        }

        const actor =
          root?.addonsActor ||
          (await rdpClient.request({to: 'root', type: 'listTabs'}))?.addonsActor

        // Install the extension as temporary addon
        const installResult = await rdpClient.request({
          to: actor,
          type: 'installTemporaryAddon',
          addonPath: pathToExtension,
          openDevTools: false
        })

        const addonId: string | undefined = installResult?.addon?.id
        if (!addonId) {
          throw new Error(
            `installTemporaryAddon did not return an addon ID. Response: ${JSON.stringify(installResult)}`
          )
        }

        // Store state on context for other fixtures to access
        ;(context as any).__firefoxAddonId = addonId
        ;(context as any).__firefoxProfileDir = profileDir
        ;(context as any).__firefoxRdpClient = rdpClient
        ;(context as any).__firefoxRdpPort = rdpPort

        // Give Firefox a moment to fully register the addon
        await new Promise((r) => setTimeout(r, 500))

        await use(context)
      } finally {
        if (rdpClient) rdpClient.disconnect()
        if (context) {
          try {
            await context.close()
          } catch {
            // ignore
          }
        }
        try {
          if (profileDir && fs.existsSync(profileDir)) {
            fs.rmSync(profileDir, {recursive: true, force: true})
          }
        } catch {
          // ignore
        }
      }
    },

    page: async ({context}, use) => {
      const pages = context.pages()
      const page = pages.length > 0 ? pages[0] : await context.newPage()
      await use(page)
    },

    extensionId: async ({context}, use) => {
      const addonId = (context as any).__firefoxAddonId as string
      const profileDir = (context as any).__firefoxProfileDir as string

      // Discover the moz-extension:// UUID from the profile
      const uuid = await getExtensionUuid(profileDir, addonId)
      if (!uuid) {
        throw new Error(
          `Could not discover moz-extension UUID for addon ${addonId} in ${profileDir}`
        )
      }
      await use(uuid)
    },

    rdp: async ({context}, use) => {
      const client = (context as any).__firefoxRdpClient as RdpClient
      await use(client)
    }
  })
}
