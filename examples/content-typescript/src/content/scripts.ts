import logo from '../images/icon.png'
import type {OpenOptionsMessage, Settings} from '../types'

console.log('[From the page context] Hello from content_scripts!')

const DEFAULT_SETTINGS: Settings = {showBadge: true}

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
  // descendants; the host element itself still takes page CSS.
  rootDiv.style.cssText = 'all: initial !important'
  document.body.appendChild(rootDiv)

  const shadowRoot = rootDiv.attachShadow({mode: 'open'})
  const styleElement = document.createElement('style')
  shadowRoot.appendChild(styleElement)

  fetchCSS().then((css) => (styleElement.textContent = css))

  const contentDiv = document.createElement('div')
  contentDiv.className = 'content_script'
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

  function render(showBadge: boolean) {
    // The host carries `all: initial !important`, and a plain assignment
    // cannot overwrite an important declaration: the CSSOM drops it and
    // the badge never hides. setProperty with the flag is what sticks.
    rootDiv.style.setProperty(
      'display',
      showBadge ? 'initial' : 'none',
      'important'
    )
  }

  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    render(Boolean(items.showBadge))
  })

  // The options page writes the same key, so this UI follows it live rather
  // than waiting for the next page load.
  const onSettingChanged = (
    changes: {[key: string]: chrome.storage.StorageChange},
    areaName: string
  ) => {
    const change = changes.showBadge
    if (areaName === 'sync' && change) {
      render(Boolean(change.newValue))
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
