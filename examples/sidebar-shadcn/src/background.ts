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

// The content_script pill asks for the panel from the page context.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== 'openSidebar') return

  if (isSafariLike) {
    openSidebarTab()

    return
  }

  // Everything here runs synchronously inside the listener. An async hop
  // (chrome.tabs.query and friends) drops the click's user gesture, and
  // sidePanel.open() then refuses to run.
  chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick: true})

  const tabId = sender.tab?.id
  if (!chrome.sidePanel?.open || tabId === undefined) return

  try {
    chrome.sidePanel?.open({tabId})
  } catch (error) {
    console.error(error)
  }
})
