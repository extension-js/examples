console.log(
  '[From the background context] Hello from the background worker/script!'
)

console.log('Monorepo Turborepo: background ready')

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

if (isFirefoxLike) {
  try {
    // Firefox refuses sidebarAction.open() outside a user input handler, and a
    // message listener is not one, so the toolbar click is the only route.
    browser.browserAction?.onClicked.addListener(() => {
      browser.sidebarAction.open()
    })
  } catch {
    // Ignore errors - best effort
  }
} else if (isSafariLike) {
  try {
    // Safari never had setPanelBehavior, so the toolbar click needs a listener.
    chrome.action?.onClicked.addListener(() => {
      openSidebarTab()
    })
  } catch {
    // Ignore errors - best effort
  }
} else {
  try {
    // setPanelBehavior only affects FUTURE action clicks — registering it
    // inside onClicked would swallow the first toolbar click.
    chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: true})
  } catch {
    // Ignore errors - best effort
  }
}

// The side panel API only exists in Chromium. Firefox opens the sidebar in
// the listener above, so this listener is compiled out of gecko builds.
if (isSafariLike) {
  try {
    chrome?.runtime?.onMessage.addListener((message) => {
      if (!message || message.type !== 'openSidebar') return

      openSidebarTab()
    })
  } catch {
    // Ignore errors - best effort
  }
}

if (!isFirefoxLike && !isSafariLike) {
  try {
    chrome?.runtime?.onMessage.addListener((message, sender) => {
      if (!message || message.type !== 'openSidebar') return

      try {
        // Everything here must run synchronously: a tabs.query callback would
        // outlive the click's user gesture and sidePanel.open() would refuse.
        chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: true})
        const tabId = sender.tab?.id
        if (!chrome.sidePanel?.open || tabId === undefined) return

        chrome.sidePanel?.open({tabId})
      } catch {
        // Ignore errors - best effort
      }
    })
  } catch {
    // Ignore errors - best effort
  }
}
