console.log(
  '[From the background context] Hello from the background worker/script!'
)
const isFirefoxLike =
  process.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  process.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

if (isFirefoxLike) {
  browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open()
  })
} else {
  // setPanelBehavior only affects FUTURE action clicks — registering it
  // inside onClicked would swallow the first toolbar click.
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'openSidebar') return

  if (isFirefoxLike) {
    browser.sidebarAction.open()
    return
  }

  // Must be invoked synchronously inside the message handler so the
  // user-gesture context from the content-script click is preserved.
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})
  const tabId = sender.tab?.id
  if (chrome.sidePanel.open && tabId !== undefined) {
    chrome.sidePanel.open({tabId})
  }
})
