import logo from '../images/icon.png'
import {createBadge} from './utils/create-badge.js'
import {
  BRIDGE_CHANNEL,
  REQUEST_POSITION,
  PUBLISH_POSITION,
  OPEN_OPTIONS,
  DEFAULT_VALUE
} from './utils/bridge.js'

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
  // reader announces the button, and how the docs recorder finds it.
  button.setAttribute('aria-label', 'Open options')
  button.addEventListener('click', () => {
    // chrome.runtime does not exist in the MAIN world, so the click goes to
    // the ISOLATED world companion, which relays it to the background worker.
    window.postMessage({channel: BRIDGE_CHANNEL, type: OPEN_OPTIONS}, '*')
  })
  contentDiv.appendChild(button)

  function render(position) {
    // The move lands on the badge inside the shadow root, not on the host:
    // the host carries `all: initial !important`, which a plain write loses to.
    const onLeft = position === 'left'
    // A fixed box with a width honors one anchor only, so the other is cleared.
    contentDiv.style.left = onLeft ? '0' : 'auto'
    contentDiv.style.right = onLeft ? 'auto' : '0'
  }

  // Paint the default straight away, then correct it when the companion
  // answers with what storage actually holds.
  render(DEFAULT_VALUE)

  // The page shares this window and can read and forge these messages, so the
  // payloads stay trivial and every value is narrowed to one of two edges.
  const onBridgeMessage = (event) => {
    if (event.source !== window) return
    const data = event.data
    if (!data || data.channel !== BRIDGE_CHANNEL) return
    if (data.type === PUBLISH_POSITION) {
      render(data.value === 'left' ? 'left' : 'right')
    }
  }
  window.addEventListener('message', onBridgeMessage)

  // The companion may have published before this listener existed, so ask for
  // the value once, now that the listener is attached.
  window.postMessage({channel: BRIDGE_CHANNEL, type: REQUEST_POSITION}, '*')

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
