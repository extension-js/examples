async function ensureStyles() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()
  if (!document.head.querySelector('style[data-iskilar-styles]')) {
    const style = document.createElement('style')
    style.setAttribute('data-iskilar-styles', 'true')
    style.textContent = text
    document.head.appendChild(style)
  }
}

export default async function main() {
  try {
    await ensureStyles()
    let host = document.querySelector('[data-extension-root="true"]')
    if (!host) {
      host = document.createElement('div')
      host.setAttribute('data-extension-root', 'true')
      document.body.appendChild(host)
      host.attachShadow({mode: 'open'})
    }
    const sr = host.shadowRoot || host.attachShadow?.({mode: 'open'})
    if (!sr) return

    const box = document.createElement('div')
    box.className = 'iskilar_box iskilar_bottom_right'
    box.textContent = 'iskilar'
    sr.appendChild(box)

    try {
      // eslint-disable-next-line no-console
      console.log('[content] iskilar bottom-right mounted')
    } catch {}

    return () => {
      try {
        box.remove()
      } catch {}
    }
  } catch {}
}
