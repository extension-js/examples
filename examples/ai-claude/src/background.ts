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
  browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open()
  })
} else if (isSafariLike) {
  // Safari never had setPanelBehavior, so the toolbar click needs a listener.
  chrome.action?.onClicked.addListener(() => {
    openSidebarTab()
  })
} else {
  // setPanelBehavior only affects FUTURE action clicks — registering it
  // inside onClicked would swallow the first toolbar click.
  chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: true})
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'openSidebar') {
    if (isSafariLike) {
      openSidebarTab()

      return
    }

    // Must be invoked synchronously inside the message handler so the
    // user-gesture context from the content-script click is preserved.
    chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: true})
    const tabId = sender.tab?.id

    if (chrome.sidePanel?.open && tabId !== undefined) {
      try {
        chrome.sidePanel?.open({tabId})
      } catch (error) {
        console.error(error)
      }
    }

    return
  }

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
