console.log('Monorepo Turbopack: background ready')

const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

if (isFirefoxLike) {
  try {
    browser.browserAction?.onClicked.addListener(() => {
      browser.sidebarAction.open()
    })
    browser.runtime.onMessage.addListener((message) => {
      if (!message || message.type !== 'openSidebar') return
      browser.sidebarAction.open()
    })
  } catch {
    // Ignore errors - best effort
  }
} else {
  try {
    chrome.action?.onClicked.addListener(() => {
      chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})
    })
  } catch {
    // Ignore errors - best effort
  }
}

try {
  chrome?.runtime?.onMessage.addListener((message) => {
    if (!message || message.type !== 'openSidebar') return
    try {
      chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})
      if (!chrome.sidePanel.open) return
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTabId = tabs && tabs[0] && tabs[0].id
        if (!activeTabId) return
        try {
          chrome.sidePanel.open({tabId: activeTabId})
        } catch {
          // Ignore errors - best effort
        }
      })
    } catch {
      // Ignore errors - best effort
    }
  })
} catch {
  // Ignore errors - best effort
}
