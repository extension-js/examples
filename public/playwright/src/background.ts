console.log(
  '[From the background context] Hello from the background worker/script!'
)

const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

if (isFirefoxLike) {
  browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open()
  })

  browser.runtime.onMessage.addListener((message: any) => {
    if (!message || message.type !== 'openSidebar') return

    browser.sidebarAction.open()
  })
}

if (!isFirefoxLike) {
  // setPanelBehavior only affects FUTURE action clicks — registering it
  // inside onClicked would swallow the first toolbar click.
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})

  // The content_script pill asks for the panel from the page context.
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message || message.type !== 'openSidebar') return

    // Everything here runs synchronously inside the listener. An async hop
    // (chrome.tabs.query and friends) drops the click's user gesture, and
    // sidePanel.open() then refuses to run.
    chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})

    const tabId = sender.tab?.id
    if (!chrome.sidePanel.open || tabId === undefined) return

    try {
      chrome.sidePanel.open({tabId})
    } catch (error) {
      console.error(error)
    }
  })
}
