import ReactDOM from 'react-dom/client'
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

  const mountingPoint = ReactDOM.createRoot(shadowRoot)
  mountingPoint.render(
    <div className="content_script">
      <ContentApp />
    </div>
  )

  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
    render(Boolean(settings[SETTING_KEY]))
  })

  // The options page writes the same key, so the overlay follows it live rather
  // than waiting for the next page load.
  const onChanged = (
    changes: {[key: string]: chrome.storage.StorageChange},
    area: string
  ) => {
    if (area === 'sync' && changes[SETTING_KEY]) {
      render(Boolean(changes[SETTING_KEY].newValue))
    }
  }
  chrome.storage.onChanged.addListener(onChanged)

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

  return () => {
    chrome.storage.onChanged.removeListener(onChanged)
    mountingPoint.unmount()
    rootDiv.remove()
  }
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}
