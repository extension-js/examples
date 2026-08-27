console.log('[From the page context] Hello from content_scripts!')

const SETTING_KEY = 'useCustomFont'
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

  // Chrome does not apply an @font-face rule declared inside a shadow root, and
  // the root-absolute url in the injected stylesheet would resolve against the
  // host page rather than the extension. So the face is registered on the
  // page's own font set, from the extension's copy of the file, and the shadow
  // tree can then use it.
  const customFace = new FontFace(
    'Momo Signature',
    `url("${chrome.runtime.getURL('fonts/MomoSignature-Regular.woff2')}")`
  )
  customFace
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => {
      // Ignore
    })

  const contentDiv = document.createElement('div')
  contentDiv.className = 'content_script'
  shadowRoot.appendChild(contentDiv)
  const demo = document.createElement('div')
  demo.className = 'font_demo font_momo_signature'
  const normal = document.createElement('p')
  normal.textContent =
    'In tabs and tools they find their home,\nExtensions roam the chrome‑y dome;\nThey tweak, they theme, they block, they play,\nSmall bits of joy to save your day.'
  demo.appendChild(normal)
  const bold = document.createElement('p')
  bold.style.fontWeight = '700'
  bold.textContent = 'Click, grant, delight — little scripts take flight!'
  demo.appendChild(bold)
  contentDiv.appendChild(demo)

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

  function render(useCustomFont) {
    // The switch lands on the demo block inside the shadow root, not on the
    // host: the host carries `all: initial !important`, and a plain CSSOM
    // write on the host is dropped without an error.
    demo.classList.toggle('font_system', !useCustomFont)
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
    document.fonts.delete(customFace)
    rootDiv.remove()
  }
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}
