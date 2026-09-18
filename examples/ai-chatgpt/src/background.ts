import type {PageContext} from './content/scripts'

console.log(
  '[From the background context] Hello from the background worker/script!'
)

// Named one by one so the bundler can fold each build down to a single
// branch. waterfox and librewolf are gecko, and used to fall to chromium.
const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'waterfox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'librewolf' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

const isSafariLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'safari' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'webkit-based'

// Safari has no side panel surface, so the sidebar page opens in a tab.
let sidebarTabId: number | undefined

function openSidebarTab() {
  const url = chrome.runtime.getURL('sidebar/index.html')

  const openNewTab = () => {
    chrome.tabs.create({url}, (tab) => {
      sidebarTabId = tab?.id
    })
  }

  // A repeat click focuses the tab already opened instead of a new copy.
  const knownTabId = sidebarTabId

  if (knownTabId === undefined) {
    openNewTab()

    return
  }

  chrome.tabs.update(knownTabId, {active: true}, (tab) => {
    if (chrome.runtime.lastError || !tab) {
      openNewTab()

      return
    }

    // Selecting a tab in another window leaves that window behind the one the
    // user is looking at, so raise it too.
    chrome.windows?.update(tab.windowId, {focused: true})
  })
}

if (isFirefoxLike) {
  // Firefox refuses sidebarAction.open() outside a user input handler, and a
  // message listener is not one, so the toolbar click is the only route.
  browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open()
  })
}

if (isSafariLike) {
  // Safari never had setPanelBehavior, so the toolbar click needs a listener.
  chrome.action?.onClicked.addListener(() => {
    openSidebarTab()
  })

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'openSidebar') return

    openSidebarTab()
  })
}

if (!isFirefoxLike && !isSafariLike) {
  // setPanelBehavior only affects FUTURE action clicks, registering it
  // inside onClicked would swallow the first toolbar click.
  chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: true})

  // The side panel API only exists in Chromium. Firefox opens the sidebar in
  // the listener above, so this listener is compiled out of gecko builds.
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message || message.type !== 'openSidebar') return

    // Every line here runs synchronously on purpose. sidePanel.open() is only
    // allowed inside the user gesture that the content-script click carries, and
    // a tabs.query callback outlives it: the panel then silently refuses to open.
    // sender.tab is the tab the click came from, so no lookup is needed at all.
    chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: true})

    const tabId = sender.tab?.id
    if (!chrome.sidePanel?.open || tabId === undefined) return

    try {
      chrome.sidePanel?.open({tabId})
    } catch (error) {
      console.error(error)
    }
  })
}

// On Safari the sidebar is a tab of its own, so the active tab can be the
// sidebar. The tab that asked is never the page the user wants summarized.
async function findPageTab(askingTabId: number | undefined) {
  const extensionOrigin = chrome.runtime.getURL('')

  const isPageTab = (tab: chrome.tabs.Tab) =>
    tab.id !== undefined &&
    tab.id !== askingTabId &&
    !String(tab.url || '').startsWith(extensionOrigin)

  const active = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  })

  const fromActive = active.find(isPageTab)

  if (fromActive) return fromActive

  const all = await chrome.tabs.query({lastFocusedWindow: true})

  return all
    .filter(isPageTab)
    .sort((one, two) => (two.lastAccessed ?? 0) - (one.lastAccessed ?? 0))[0]
}

// The sidebar asks for the active tab's page context on every browser, so this
// listener stays outside the browser branches above.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'getActiveTabContext') return

  // Remembering the asking tab also repopulates sidebarTabId after Safari
  // unloads the background page, so a repeat click reuses the same tab.
  const askingTabId = sender.tab?.id
  if (askingTabId !== undefined) sidebarTabId = askingTabId
  ;(async () => {
    try {
      const tab = await findPageTab(askingTabId)

      if (!tab?.id) {
        sendResponse({ok: false, error: 'No page tab to read'})

        return
      }

      const context = (await chrome.tabs.sendMessage(tab.id, {
        type: 'getPageContext'
      })) as PageContext | undefined

      if (!context) {
        sendResponse({ok: false, error: 'No page context received'})

        return
      }

      sendResponse({ok: true, context})
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      sendResponse({ok: false, error})
    }
  })()

  return true
})
