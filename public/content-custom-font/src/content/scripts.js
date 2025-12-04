export default function initial() {
  const rootDiv = document.createElement('div')
  rootDiv.setAttribute('data-extension-root', 'true')
  document.body.appendChild(rootDiv)

  const shadowRoot = rootDiv.attachShadow({mode: 'open'})
  const styleElement = document.createElement('style')
  shadowRoot.appendChild(styleElement)
  fetchCSS().then((css) => (styleElement.textContent = css))

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
