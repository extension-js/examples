const SETTING_KEY = 'badgePosition'
const DEFAULT_VALUE = 'right'

const checkbox = document.getElementById('badge-left')
const statusLine = document.getElementById('status')

// The key is absent until the first write, so ask storage for the default too.
chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
  checkbox.checked = settings[SETTING_KEY] === 'left'
  statusLine.textContent = 'Setting loaded from chrome.storage.sync'
})

checkbox.addEventListener('change', () => {
  const position = checkbox.checked ? 'left' : 'right'
  chrome.storage.sync.set({[SETTING_KEY]: position}, () => {
    statusLine.textContent = `Saved: the badge sits on the ${position}`
  })
})
