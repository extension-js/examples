import logo from '../images/icon.png'

console.log('[From the page context] Hello from content_scripts!')

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

  const contentDiv = document.createElement('div')
  contentDiv.className = 'content_script'
  shadowRoot.appendChild(contentDiv)

  const img = document.createElement('img')
  img.className = 'content_logo'
  img.src = logo
  contentDiv.appendChild(img)

  const title = document.createElement('h1')
  title.className = 'content_title'
  title.textContent = 'Special Folders — Scripts'
  contentDiv.appendChild(title)

  const description = document.createElement('p')
  description.className = 'content_description'
  description.innerHTML =
    'Click below to inject the three <code>scripts/script-*.js</code> files into this page — same effect as clicking the extension toolbar icon. Learn more at <a href="https://extension.js.org" target="_blank" rel="noreferrer noopener">extension.js.org</a>.'
  contentDiv.appendChild(description)

  contentDiv.appendChild(createRunButton())

  return () => {
    rootDiv.remove()
  }
}

// "Run scripts/" button. Clicking it sends a runtime message to the background
// service worker, which issues the SAME
// chrome.scripting.executeScript({files: ['/scripts/...']}) call that the
// toolbar action's onClicked handler runs — so the visible effect is identical:
// the three badge divs appear in the page.
function createRunButton() {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'content_run_button'
  button.textContent = 'Run scripts/'

  button.addEventListener('click', () => {
    button.disabled = true
    button.textContent = 'Injecting…'

    chrome.runtime.sendMessage(
      {type: 'special-folders-scripts:run'},
      (response) => {
        button.disabled = false

        if (chrome.runtime.lastError) {
          button.textContent = 'Run failed'
          console.warn(
            '[special-folders-scripts] message failed',
            chrome.runtime.lastError.message
          )
          return
        }

        if (response && response.ok === false) {
          button.textContent = 'Run failed'
          console.warn(
            '[special-folders-scripts] background returned error',
            response.error
          )
          return
        }

        button.textContent = 'Run scripts/'
      }
    )
  })

  return button
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  return response.ok ? text : Promise.reject(text)
}
