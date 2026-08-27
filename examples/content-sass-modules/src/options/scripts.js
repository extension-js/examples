import {
  options_page,
  options_logo,
  options_title,
  options_banner,
  options_setting,
  options_status
} from './styles.module.scss'

const SETTING_KEY = 'showBadge'
const DEFAULT_VALUE = true

// CSS Modules hash every class name at build time, so the markup carries ids
// and the hashed names are attached here, the same way the content script does.
const CLASS_NAMES = {
  'options-logo': options_logo,
  'options-title': options_title,
  'options-banner': options_banner,
  'options-setting': options_setting,
  status: options_status
}

document.body.className = options_page

for (const [id, className] of Object.entries(CLASS_NAMES)) {
  const element = document.getElementById(id)
  if (element) element.className = className
}

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
