const SETTING_KEY = 'showBadge'
const DEFAULT_SETTINGS = {[SETTING_KEY]: true}

const checkbox = document.querySelector<HTMLInputElement>('#show-badge')
const statusLine = document.querySelector<HTMLParagraphElement>('#status')
const buildLine = document.querySelector<HTMLParagraphElement>('#build')

// The build replaces import.meta.env.* at compile time, so the value below is
// baked in per browser by the matching .env file.
if (buildLine) {
  buildLine.textContent = `Built as: ${import.meta.env.EXTENSION_PUBLIC_DESCRIPTION_TEXT}`
}

if (checkbox && statusLine) {
  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    checkbox.checked = Boolean(settings[SETTING_KEY])
    statusLine.textContent = 'Setting loaded from chrome.storage.sync'
  })

  checkbox.addEventListener('change', () => {
    const showBadge = checkbox.checked
    chrome.storage.sync.set({[SETTING_KEY]: showBadge}, () => {
      statusLine.textContent = `Saved: the panel is ${showBadge ? 'on' : 'off'}`
    })
  })
}
