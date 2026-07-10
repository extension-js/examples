import createContentApp from './ContentApp'
import './styles.css'

console.log('[From the page context] Hello from content_scripts!')

export interface PageContext {
  title: string
  url: string
  text: string
}

const MAX_TEXT_LENGTH = 8000

function getPageContext(): PageContext {
  const text = (document.body?.innerText ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH)

  return {
    title: document.title,
    url: location.href,
    text
  }
}

console.log('[Sidebar content script] loaded on', location.href)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'getPageContext') {
    const ctx = getPageContext()
    console.log('[Sidebar content script] getPageContext →', ctx.title)
    sendResponse(ctx)
  }
})

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
  // descendants — the host element itself still takes page CSS.
  rootDiv.style.cssText = 'all: initial !important'
  document.body.appendChild(rootDiv)

  const shadowRoot = rootDiv.attachShadow({mode: 'open'})

  const styleElement = document.createElement('style')
  shadowRoot.appendChild(styleElement)

  fetchCSS().then((css) => (styleElement.textContent = css))

  shadowRoot.appendChild(createContentApp())

  return () => {
    rootDiv.remove()
  }
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}
