import ReactDOM from 'react-dom/client'
import ContentApp from './ContentApp'

console.log('[From the page context] Hello from content_scripts!')

type BadgePosition = 'left' | 'right'

const SETTING_KEY = 'badgePosition'
const DEFAULT_VALUE: BadgePosition = 'right'

// Both strings are spelled out so Tailwind sees `left-0` and `right-0` in the
// source and compiles them into the stylesheet the shadow root loads.
const POSITION_CLASS: Record<BadgePosition, string> = {
  left: 'content_script left-0',
  right: 'content_script right-0'
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

  const container = document.createElement('div')
  container.className = POSITION_CLASS[DEFAULT_VALUE]
  shadowRoot.appendChild(container)

  const mountingPoint = ReactDOM.createRoot(container)
  mountingPoint.render(<ContentApp />)

  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
    applyPosition(settings[SETTING_KEY])
  })

  // The options page writes the same key, so the badge changes edge live
  // rather than waiting for the next page load.
  const onChanged = (
    changes: {[key: string]: chrome.storage.StorageChange},
    area: string
  ) => {
    if (area === 'sync' && changes[SETTING_KEY]) {
      applyPosition(changes[SETTING_KEY].newValue)
    }
  }
  chrome.storage.onChanged.addListener(onChanged)

  function applyPosition(value: unknown) {
    // The stylesheet positions this inner element, not the host. The host
    // carries `all: initial !important`, which a plain style write cannot beat.
    container.className = POSITION_CLASS[toPosition(value)]
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
