export default function initMonorepoContent() {
  const root = document.createElement('div')
  root.setAttribute('data-extension-root', 'true')
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
  badge.textContent = 'Turbopack Monorepo Content Script Active'
  container.appendChild(badge)

  const info = document.createElement('div')
  info.className = 'monorepo_info'
  info.innerHTML =
    'Built with <strong>Extension.js</strong> · Monorepo + Turbopack'
  container.appendChild(info)

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
