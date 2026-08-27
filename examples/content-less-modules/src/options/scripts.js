import {
  options_root,
  options_page,
  options_logo,
  options_banner,
  options_setting,
  options_status
} from './styles.module.less'

const SETTING_KEY = 'showBadge'
const DEFAULT_VALUE = true

// Every rule in the module is a hashed class, so the page carries no class
// names of its own and picks them up from the import instead.
document.documentElement.className = options_root
document.body.className = options_page
document.getElementById('logo').className = options_logo
document.getElementById('banner').className = options_banner
document.getElementById('setting').className = options_setting

const checkbox = document.getElementById('show-badge')
const statusLine = document.getElementById('status')
statusLine.className = options_status

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
