import logo from '../images/icon.png'

console.log('[From the page context] Hello from content_scripts!')

const SETTING_KEY = 'badgePosition'
const DEFAULT_VALUE = 'right'

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
    chrome.runtime.sendMessage({type: 'open-options'})
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

  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
    render(settings[SETTING_KEY])
  })

  // The options page writes the same key, so this UI follows it live rather
  // than waiting for the next page load.
  const onSettingChanged = (changes, areaName) => {
    if (areaName === 'sync' && changes[SETTING_KEY]) {
      render(changes[SETTING_KEY].newValue)
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
