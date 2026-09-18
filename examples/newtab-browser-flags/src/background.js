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

// Sidebar open handling (Chromium, Firefox and Safari)
function setupSidebarOpenHandlers() {
  try {
    // Prefer import.meta.env for environment hints; fall back
    // to feature detection
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

    // No gecko listener on purpose: Firefox refuses sidebarAction.open() outside
    // a user input handler, so the new tab page opens the sidebar itself.

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
      chrome.runtime.onMessage.addListener((message, sender) => {
        if (!message || message.type !== 'openSidebar') return

        try {
          // Ensure clicks on the action will open the panel as fallback
          if (chrome?.sidePanel?.setPanelBehavior) {
            chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: true})
          }

          if (typeof chrome?.sidePanel?.open !== 'function') return

          // A tabs.query callback outlives the click gesture and the panel then
          // refuses to open, so read the sender's tab and open synchronously.
          const tabId = sender.tab?.id
          if (tabId === undefined) return

          chrome.sidePanel?.open({tabId})
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
