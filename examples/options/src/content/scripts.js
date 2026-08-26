import logo from '../images/icon.png'

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

  const contentDiv = document.createElement('div')
  contentDiv.className = 'content_script'
  shadowRoot.appendChild(contentDiv)

  const img = document.createElement('img')
  img.className = 'content_logo'
  img.src = logo
  contentDiv.appendChild(img)

  const title = document.createElement('h1')
  title.className = 'content_title'
  title.textContent = 'Options Template'
  contentDiv.appendChild(title)

  const description = document.createElement('p')
  description.className = 'content_description'
  description.textContent =
    'This badge is the setting. Open the options page to turn it off.'
  contentDiv.appendChild(description)

  const button = document.createElement('button')
  button.className = 'content_button'
  button.type = 'button'
  button.textContent = 'Open options'
  button.addEventListener('click', () => {
    chrome.runtime.sendMessage({type: 'open-options'})
  })
  contentDiv.appendChild(button)

  // The key is absent until the first write, so ask storage for the default too.
  chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
    render(settings[SETTING_KEY])
  })

  // The options page writes the same key, so the badge follows it live rather
  // than waiting for the next page load.
  const onChanged = (changes, area) => {
    if (area === 'sync' && changes[SETTING_KEY]) {
      render(changes[SETTING_KEY].newValue)
    }
  }
  chrome.storage.onChanged.addListener(onChanged)

  function render(showBadge) {
    rootDiv.style.display = showBadge ? '' : 'none'
  }

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
