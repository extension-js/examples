import type {Settings} from '../types'

const DEFAULT_SETTINGS: Settings = {showBadge: true}

const checkbox = document.querySelector<HTMLInputElement>('#show-badge')
const statusLine = document.querySelector<HTMLParagraphElement>('#status')

if (checkbox && statusLine) {
  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    const settings: Settings = {showBadge: Boolean(items.showBadge)}
    checkbox.checked = settings.showBadge
    statusLine.textContent = 'Setting loaded from chrome.storage.sync'
  })

  checkbox.addEventListener('change', () => {
    const settings: Settings = {showBadge: checkbox.checked}
    chrome.storage.sync.set(settings, () => {
      statusLine.textContent = `Saved: the overlay is ${
        settings.showBadge ? 'on' : 'off'
      }`
    })
  })
}
