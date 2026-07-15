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
