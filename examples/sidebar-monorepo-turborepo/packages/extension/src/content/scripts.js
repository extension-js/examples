import logo from '../images/icon.png'

console.log('[From the page context] Hello from content_scripts!')

const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

/**
 * Extension.js content_script entrypoint. The framework calls this on
 * injection and calls the returned function on HMR/teardown to clean up.
 * Do not invoke it yourself.
 */
export default function initMonorepoContent() {
  const root = document.createElement('div')
  root.setAttribute('data-extension-root', 'true')
  // Isolate the host from page styles (e.g. example.com ships div{opacity:.8},
  // which would otherwise fade the whole widget): the shadow DOM only protects
  // descendants; the host element itself still takes page CSS.
  root.style.cssText = 'all: initial !important'
  document.documentElement.appendChild(root)

  const shadow = root.attachShadow({mode: 'open'})
  const styleEl = document.createElement('style')
  shadow.appendChild(styleEl)
  loadCSS()
    .then((css) => (styleEl.textContent = css))
    .catch(() => {})

  const container = document.createElement('div')
  container.className = 'monorepo_content'
  shadow.appendChild(container)

  const badge = document.createElement('div')
  badge.className = 'monorepo_badge'
  badge.textContent = 'Turborepo Monorepo Content Script Active'
  container.appendChild(badge)

  const info = document.createElement('div')
  info.className = 'monorepo_info'
  info.innerHTML =
    'Built with <strong>Extension.js</strong> · Monorepo + Turborepo'
  container.appendChild(info)

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
  container.appendChild(pill)

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
    root.remove()
  }
}

async function loadCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const res = await fetch(cssUrl)
  const text = await res.text()
  return res.ok ? text : ''
}
