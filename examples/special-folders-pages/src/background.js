chrome.runtime.onInstalled.addListener((details) => {
  const welcomeUrl = chrome.runtime.getURL('pages/welcome.html')
  console.log(
    'Special Folders - Pages: Opening pages/welcome.html on install',
    details?.reason
  )
  chrome.tabs.create({url: welcomeUrl})
})

chrome.runtime.onStartup.addListener(() => {
  const welcomeUrl = chrome.runtime.getURL('pages/welcome.html')
  console.log('Special Folders - Pages: Opening pages/welcome.html on startup')
  chrome.tabs.create({url: welcomeUrl})
})
