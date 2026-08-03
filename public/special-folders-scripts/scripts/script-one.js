export default function injectScriptOne() {
  try {
    const el = document.createElement('div')

    // Match the default content-script template's palette (#0a0c10/#c9c9c9)
    el.style.position = 'fixed'
    el.style.zIndex = '2147483647'
    el.style.top = '16px'
    el.style.right = '16px'
    el.style.padding = '12px 14px'
    el.style.background = '#0a0c10'
    el.style.color = '#c9c9c9'
    el.style.border = '1px solid #1f242b'
    el.style.borderRadius = '6px'
    el.style.font =
      '13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif'
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,.35)'

    el.textContent = 'scripts/script-one.js injected ✔'

    document.body.appendChild(el)

    return () => {
      try {
        el.remove()
      } catch {
        // ignore
      }
    }
  } catch (error) {
    console.log('[special-folders-scripts] script-one error', error)
  }
}
