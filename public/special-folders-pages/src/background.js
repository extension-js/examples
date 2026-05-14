console.log(
  '[From the background context] Hello from the background worker/script!'
)
chrome.runtime.onInstalled.addListener((details) => {
  // Only open the welcome tab on a real first install. Chrome also fires
  // onInstalled with reason "update" every time an unpacked extension is
  // reloaded — including on each `extension dev` save — which would otherwise
  // open a new welcome tab on every code change.
  if (details.reason !== 'install') return
  const welcomeUrl = chrome.runtime.getURL('pages/welcome.html')
  console.log('Special Folders - Pages: Opening pages/welcome.html on install')
  chrome.tabs.create({url: welcomeUrl})
})

chrome.runtime.onStartup.addListener(() => {
  const welcomeUrl = chrome.runtime.getURL('pages/welcome.html')
  console.log('Special Folders - Pages: Opening pages/welcome.html on startup')
  chrome.tabs.create({url: welcomeUrl})
})
