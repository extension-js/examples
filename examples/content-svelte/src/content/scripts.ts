import {mount, unmount} from 'svelte'
import ContentApp from './ContentApp.svelte'
import './styles.css'

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

  fetchCSS().then((response) => (styleElement.textContent = response))

  // Create container for Svelte app
  const contentDiv = document.createElement('div')
  contentDiv.className = 'content_script'
  shadowRoot.appendChild(contentDiv)

  // Mount Svelte app using Svelte 5's mount function
  const app = mount(ContentApp, {
    target: contentDiv
  })

  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
    render(Boolean(settings[SETTING_KEY]))
  })

  // The options page writes the same key, so the overlay follows it live rather
  // than waiting for the next page load.
  const onStorageChanged = (
    changes: Record<string, {newValue?: unknown}>,
    areaName: string
  ) => {
    if (areaName === 'sync' && changes[SETTING_KEY]) {
      render(Boolean(changes[SETTING_KEY].newValue))
    }
  }
  chrome.storage.onChanged.addListener(onStorageChanged)

  // The host element carries the toggle, not the Svelte component: the
  // component runs in legacy mode and the visibility never needs its markup.
  // The host is hardened with `all: initial !important`, which sets display
  // too, so the toggle has to match that priority to win.
  function render(showBadge: boolean) {
    rootDiv.style.setProperty(
      'display',
      showBadge ? 'initial' : 'none',
      'important'
    )
  }

  return () => {
    chrome.storage.onChanged.removeListener(onStorageChanged)
    unmount(app)
    rootDiv.remove()
  }
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}
