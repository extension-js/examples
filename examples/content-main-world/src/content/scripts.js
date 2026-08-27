import logo from '../images/icon.png'
import {createBadge} from './utils/create-badge.js'
import {BRIDGE_SOURCE} from './utils/constants.js'

console.log('[From the page context] Hello from content_scripts!')

/**
 * Extension.js content_script entrypoint. The framework calls this on
 * injection and calls the returned function on HMR/teardown to clean up.
 * Do not invoke it yourself.
 */
export default function initial() {
  // Set a window property to prove we're in MAIN world
  window.__EXTJS_MAIN_WORLD_ACTIVE = true

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
  title.textContent = 'Main World Content'
  contentDiv.appendChild(title)

  contentDiv.appendChild(createBadge())

  const description = document.createElement('p')
  description.className = 'content_description'
  description.innerHTML =
    'This MAIN world content script runs alongside page scripts. Learn more at <a href="https://extension.js.org" target="_blank" rel="noreferrer noopener">extension.js.org</a>.'
  contentDiv.appendChild(description)

  const button = document.createElement('button')
  button.className = 'content_button'
  button.type = 'button'
  button.textContent = 'Open options'
  // Named for Accessibility as well as for sight: the label is how a screen
  // reader announces the button.
  button.setAttribute('aria-label', 'Open options')
  button.addEventListener('click', () => {
    // No chrome.runtime here, so the click goes to the isolated world
    // companion, which relays it to the background script.
    window.postMessage({source: BRIDGE_SOURCE, type: 'open-options'}, '*')
  })
  contentDiv.appendChild(button)

  // The companion reads chrome.storage for this UI and publishes the setting
  // here, both on load and whenever the options page changes it.
  const onBridgeMessage = (event) => {
    if (event.source !== window) return
    const data = event.data
    if (!data || data.source !== BRIDGE_SOURCE || data.type !== 'setting') {
      return
    }
    render(Boolean(data.showBadge))
  }
  window.addEventListener('message', onBridgeMessage)

  // The companion may have published before this listener existed, so ask for
  // the current value now that it is attached.
  window.postMessage({source: BRIDGE_SOURCE, type: 'request-setting'}, '*')

  function render(showBadge) {
    // The host carries all: initial !important, and the CSSOM drops a plain
    // assignment over an important one, so this has to match that importance.
    rootDiv.style.setProperty(
      'display',
      showBadge ? 'initial' : 'none',
      'important'
    )
  }

  return () => {
    window.removeEventListener('message', onBridgeMessage)
    rootDiv.remove()
  }
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}
