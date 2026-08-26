const SETTING_KEY = 'showBanner'
const DEFAULT_VALUE = true

const checkbox = document.getElementById('show-banner')
const banner = document.getElementById('banner')
const statusLine = document.getElementById('status')

function render(showBanner) {
  checkbox.checked = showBanner
  banner.hidden = !showBanner
}

// The key is absent until the first write, so ask storage for the default too.
chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
  render(settings[SETTING_KEY])
  statusLine.textContent = 'Setting loaded from chrome.storage.sync'
})

checkbox.addEventListener('change', () => {
  const showBanner = checkbox.checked
  render(showBanner)
  chrome.storage.sync.set({[SETTING_KEY]: showBanner}, () => {
    statusLine.textContent = `Saved: banner is ${showBanner ? 'on' : 'off'}`
  })
})
