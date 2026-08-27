import {
  options_root,
  options_page,
  options_logo,
  options_banner,
  options_setting,
  options_status
} from './styles.module.less'

const SETTING_KEY = 'badgePosition'
const DEFAULT_VALUE = 'right'

// Every rule in the module is a hashed class, so the page carries no class
// names of its own and picks them up from the import instead.
document.documentElement.className = options_root
document.body.className = options_page
document.getElementById('logo').className = options_logo
document.getElementById('banner').className = options_banner
document.getElementById('setting').className = options_setting

const checkbox = document.getElementById('badge-left')
const statusLine = document.getElementById('status')
statusLine.className = options_status

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
