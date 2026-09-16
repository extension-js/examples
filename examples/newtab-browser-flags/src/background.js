console.log(
  '[From the background context] Hello from the background worker/script!'
)

// This extension doesn't need to do much in the background
// It's primarily designed to demonstrate browser flag customization
console.log('Browser Flags Example background script running')

// Safari has no side panel surface, so the sidebar page opens in a tab.
let sidebarTabId

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

// Sidebar open handling (Chromium, Firefox and Safari)
function setupSidebarOpenHandlers() {
  try {
    // Prefer import.meta.env for environment hints; fall back
    // to feature detection
    let envBrowser = import.meta.env.EXTENSION_PUBLIC_BROWSER
    const isFirefoxLike =
      envBrowser === 'firefox' || envBrowser === 'gecko-based'
    const isSafariLike =
      envBrowser === 'safari' || envBrowser === 'webkit-based'

    if (isFirefoxLike) {
      browser.runtime.onMessage.addListener((message) => {
        if (!message || message.type !== 'openSidebar') return

        try {
          browser.sidebarAction.open()
        } catch (error) {
          console.error(error)
        }
      })
    }

    if (isSafariLike) {
      chrome.runtime.onMessage.addListener((message) => {
        if (!message || message.type !== 'openSidebar') return

        try {
          openSidebarTab()
        } catch (error) {
          console.error(error)
        }
      })
    }

    if (!isFirefoxLike && !isSafariLike) {
      chrome.runtime.onMessage.addListener((message) => {
        if (!message || message.type !== 'openSidebar') return

        try {
          // Ensure clicks on the action will open the panel as fallback
          if (chrome?.sidePanel?.setPanelBehavior) {
            chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: true})
          }

          if (typeof chrome?.sidePanel?.open !== 'function') return

          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const activeTabId = tabs && tabs[0] && tabs[0].id
            if (!activeTabId) return

            try {
              chrome.sidePanel?.open({tabId: activeTabId})
            } catch (error) {
              console.error(error)
            }
          })
        } catch (error) {
          console.error(error)
        }
      })
    }
  } catch {
    // best-effort
  }
}

setupSidebarOpenHandlers()
