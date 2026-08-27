const SETTING_KEY = 'useCustomFont'
const DEFAULT_VALUE = true

const checkbox = document.getElementById('custom-font')
const statusLine = document.getElementById('status')

// The key is absent until the first write, so ask storage for the default too.
chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
  checkbox.checked = settings[SETTING_KEY] === true
  statusLine.textContent = 'Setting loaded from chrome.storage.sync'
})

checkbox.addEventListener('change', () => {
  const useCustomFont = checkbox.checked
  chrome.storage.sync.set({[SETTING_KEY]: useCustomFont}, () => {
    statusLine.textContent = useCustomFont
      ? 'Saved: the badge uses the custom font'
      : 'Saved: the badge uses the system font'
  })
})
