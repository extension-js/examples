console.log(
  '[From the background context] Hello from the background worker/script!'
)

const isFirefoxLike =
  process.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  process.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

const isSafariLike =
  process.env.EXTENSION_PUBLIC_BROWSER === 'safari' ||
  process.env.EXTENSION_PUBLIC_BROWSER === 'webkit-based'

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

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'openSidebar') return

  if (isSafariLike) {
    openSidebarTab()

    return
  }

  // Must be invoked synchronously inside the message handler so the
  // user-gesture context from the content-script click is preserved.
  chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: true})
  const tabId = sender.tab?.id

  if (chrome.sidePanel?.open && tabId !== undefined) {
    chrome.sidePanel?.open({tabId})
  }
})
