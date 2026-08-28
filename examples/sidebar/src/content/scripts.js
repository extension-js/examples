import logo from '../images/icon.png'

console.log('[From the page context] Hello from content_scripts!')

const isFirefoxLike =
  process.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  process.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

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

  const pill = document.createElement('button')
  pill.className = 'content_pill'
  pill.type = 'button'
  // Named for Accessibility as well as for sight: the label is how a screen
  // reader announces the button, and how the docs recorder finds it.
  pill.setAttribute('aria-label', 'Open sidebar')
  pill.addEventListener('click', () => {
    if (isFirefoxLike) {
      browser.runtime.sendMessage({type: 'openSidebar'})
    } else {
      chrome.runtime.sendMessage({type: 'openSidebar'})
    }
  })
  contentDiv.appendChild(pill)

  const pillLogo = document.createElement('img')
  pillLogo.className = 'content_pill_logo'
  pillLogo.src = logo
  pillLogo.alt = ''
  pillLogo.setAttribute('aria-hidden', 'true')
  pill.appendChild(pillLogo)

  const pillText = document.createElement('span')
  pillText.className = 'content_pill_text'
  pillText.textContent = 'Open sidebar'
  pill.appendChild(pillText)

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
