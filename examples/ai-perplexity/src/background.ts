console.log(
  '[From the background context] Hello from the background worker/script!'
)
import type {PageContext} from './content/scripts'

const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

if (isFirefoxLike) {
  browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open()
  })
} else {
  chrome.action.onClicked.addListener(() => {
    chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'openSidebar') {
    if (isFirefoxLike) {
      browser.sidebarAction.open()
      return
    }
    // Must be invoked synchronously inside the message handler so the
    // user-gesture context from the content-script click is preserved.
    chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})
    const tabId = sender.tab?.id
    if (chrome.sidePanel.open && tabId !== undefined) {
      try {
        chrome.sidePanel.open({tabId})
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
