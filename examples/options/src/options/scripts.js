const SETTING_KEY = 'showBadge'
const DEFAULT_VALUE = true

const checkbox = document.getElementById('show-badge')
const statusLine = document.getElementById('status')

// The key is absent until the first write, so ask storage for the default too.
chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
  checkbox.checked = settings[SETTING_KEY]
  statusLine.textContent = 'Setting loaded from chrome.storage.sync'
})

checkbox.addEventListener('change', () => {
  const showBadge = checkbox.checked
  chrome.storage.sync.set({[SETTING_KEY]: showBadge}, () => {
    statusLine.textContent = `Saved: the badge is ${showBadge ? 'on' : 'off'}`
  })
})
