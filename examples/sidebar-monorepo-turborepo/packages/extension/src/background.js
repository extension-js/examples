console.log(
  '[From the background context] Hello from the background worker/script!'
)
console.log('Monorepo Turborepo: background ready')

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
    // setPanelBehavior only affects FUTURE action clicks — registering it
    // inside onClicked would swallow the first toolbar click.
    chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: true})
  } catch {
    // Ignore errors - best effort
  }
}

try {
  chrome?.runtime?.onMessage.addListener((message, sender) => {
    if (!message || message.type !== 'openSidebar') return
    try {
      // Everything here must run synchronously: a tabs.query callback would
      // outlive the click's user gesture and sidePanel.open() would refuse.
      chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})
      const tabId = sender.tab?.id
      if (!chrome.sidePanel.open || tabId === undefined) return
      chrome.sidePanel.open({tabId})
    } catch {
      // Ignore errors - best effort
    }
  })
} catch {
  // Ignore errors - best effort
}
