import {render} from 'preact'
import {signal} from '@preact/signals'
import ContentApp, {type BadgePosition} from './ContentApp'

console.log('[From the page context] Hello from content_scripts!')

const SETTING_KEY = 'badgePosition'
const DEFAULT_VALUE: BadgePosition = 'right'

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

  // A signal instead of a re-render call: the component reads it, so writing
  // to it from storage is all it takes to move the injected UI. The component
  // owns the positioned element, so it mounts straight into the shadow root.
  const badgePosition = signal<BadgePosition>(DEFAULT_VALUE)
  render(<ContentApp badgePosition={badgePosition} />, shadowRoot)

  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
    badgePosition.value = toPosition(settings[SETTING_KEY])
  })

  // The options page writes the same key, so the UI changes edge live rather
  // than waiting for the next page load.
  const onChanged = (
    changes: {[key: string]: chrome.storage.StorageChange},
    area: string
  ) => {
    if (area === 'sync' && changes[SETTING_KEY]) {
      badgePosition.value = toPosition(changes[SETTING_KEY].newValue)
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
