import logo from '../images/icon.png'
import type {BadgePosition, OpenOptionsMessage, Settings} from '../types'

console.log('[From the page context] Hello from content_scripts!')

const DEFAULT_SETTINGS: Settings = {badgePosition: 'right'}

// The stylesheet parks the panel on one edge through these two classes, so
// swapping them is all it takes to move the injected UI.
const POSITION_CLASS: Record<BadgePosition, string> = {
  left: 'content_script content_script--left',
  right: 'content_script content_script--right'
}

function toPosition(value: unknown): BadgePosition {
  return value === 'left' ? 'left' : 'right'
}

/**
 * Extension.js content_script entrypoint. The framework calls this on
 * injection and calls the returned function on HMR/teardown to clean up.
 * Do not invoke it yourself.
 */
export default function initial() {
  const rootDiv = document.createElement('div')
  rootDiv.setAttribute('data-extension-root', 'true')
  // Isolate the host from page styles (e.g. example.com ships div{opacity:.8},
  // which would otherwise fade the whole widget): the shadow DOM only protects
  // descendants, and the host element itself still takes page CSS.
  rootDiv.style.cssText = 'all: initial !important'
  document.body.appendChild(rootDiv)

  const shadowRoot = rootDiv.attachShadow({mode: 'open'})
  const styleElement = document.createElement('style')
  shadowRoot.appendChild(styleElement)

  fetchCSS().then((css) => (styleElement.textContent = css))

  const contentDiv = document.createElement('div')
  contentDiv.className = POSITION_CLASS[DEFAULT_SETTINGS.badgePosition]
  shadowRoot.appendChild(contentDiv)

  const img = document.createElement('img')
  img.className = 'content_logo'
  img.src = logo
  contentDiv.appendChild(img)

  const title = document.createElement('h1')
  title.className = 'content_title'
  title.textContent = 'Content Template'
  contentDiv.appendChild(title)

  const description = document.createElement('p')
  description.className = 'content_description'
  description.innerHTML =
    'This content script runs in the context of web pages. Learn more at <a href="https://extension.js.org" target="_blank" rel="noreferrer noopener">extension.js.org</a>.'
  contentDiv.appendChild(description)

  const button = document.createElement('button')
  button.className = 'content_button'
  button.type = 'button'
  button.textContent = 'Open options'
  // Named for Accessibility as well as for sight: the label is how a screen
  // reader announces the button, and how the docs recorder finds it.
  button.setAttribute('aria-label', 'Open options')
  button.addEventListener('click', () => {
    const message: OpenOptionsMessage = {type: 'open-options'}
    chrome.runtime.sendMessage(message)
  })
  contentDiv.appendChild(button)

  function applyPosition(value: unknown) {
    // The class lands on the element the stylesheet positions, not on the
    // host: the host carries `all: initial !important`, which a plain style
    // write cannot beat, and it is not the positioned box either way.
    contentDiv.className = POSITION_CLASS[toPosition(value)]
  }

  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    applyPosition(items.badgePosition)
  })

  // The options page writes the same key, so this UI follows it live rather
  // than waiting for the next page load.
  const onSettingChanged = (
    changes: {[key: string]: chrome.storage.StorageChange},
    areaName: string
  ) => {
    const change = changes.badgePosition
    if (areaName === 'sync' && change) {
      applyPosition(change.newValue)
    }
  }
  chrome.storage.onChanged.addListener(onSettingChanged)

  return () => {
    chrome.storage.onChanged.removeListener(onSettingChanged)
    rootDiv.remove()
  }
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}
