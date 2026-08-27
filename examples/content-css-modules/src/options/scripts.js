import {
  options_title,
  options_logo,
  options_intro,
  options_banner,
  options_setting,
  options_status
} from './styles.module.css'

const SETTING_KEY = 'showBadge'
const DEFAULT_VALUE = true

// CSS module class names are hashed at build time, so the HTML cannot spell
// them out. The page picks its elements by id and wears the imported names.
const classNames = {
  title: options_title,
  logo: options_logo,
  intro: options_intro,
  banner: options_banner,
  setting: options_setting,
  status: options_status
}

for (const [id, className] of Object.entries(classNames)) {
  document.getElementById(id).className = className
}

const checkbox = document.getElementById('show-badge')
const statusLine = document.getElementById('status')

// The key is absent until the first write, so ask storage for the default too.
chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
  checkbox.checked = Boolean(settings[SETTING_KEY])
  statusLine.textContent = 'Setting loaded from chrome.storage.sync'
})

checkbox.addEventListener('change', () => {
  const showBadge = checkbox.checked
  chrome.storage.sync.set({[SETTING_KEY]: showBadge}, () => {
    statusLine.textContent = `Saved: the badge is ${showBadge ? 'on' : 'off'}`
  })
})
