import type {PageContext} from './content/scripts'

console.log(
  '[From the background context] Hello from the background worker/script!'
)

const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
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

  chrome.tabs.update(knownTabId, {active: true}, () => {
    if (chrome.runtime.lastError) openNewTab()
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

// The sidebar asks for the active tab's page context on every browser, so this
// listener stays outside the browser branches above.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'getActiveTabContext') return
  ;(async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      })

      if (!tab?.id) {
        sendResponse({ok: false, error: 'No active tab'})

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
