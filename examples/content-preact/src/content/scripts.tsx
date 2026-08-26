import {render} from 'preact'
import {signal} from '@preact/signals'
import ContentApp from './ContentApp'

console.log('[From the page context] Hello from content_scripts!')

const SETTING_KEY = 'showBadge'
const DEFAULT_VALUE = true

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

  const container = document.createElement('div')
  container.className = 'content_script'
  shadowRoot.appendChild(container)

  // A signal instead of a re-render call: the component reads it, so writing
  // to it from storage is all it takes to show or hide the injected UI.
  const showBadge = signal(DEFAULT_VALUE)
  render(<ContentApp showBadge={showBadge} />, container)

  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
    showBadge.value = Boolean(settings[SETTING_KEY])
  })

  // The options page writes the same key, so the UI follows it live rather
  // than waiting for the next page load.
  const onChanged = (
    changes: {[key: string]: chrome.storage.StorageChange},
    area: string
  ) => {
    if (area === 'sync' && changes[SETTING_KEY]) {
      showBadge.value = Boolean(changes[SETTING_KEY].newValue)
    }
  }
  chrome.storage.onChanged.addListener(onChanged)

  return () => {
    chrome.storage.onChanged.removeListener(onChanged)
    rootDiv.remove()
  }
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}
