export default function injectScriptThree() {
  try {
    const el = document.createElement('div')

    // Set styles explicitly for readability
    el.style.position = 'fixed'
    el.style.zIndex = '2147483647'
    el.style.bottom = '88px'
    el.style.left = '16px'
    el.style.padding = '8px 10px'
    el.style.background = '#7c2d12'
    el.style.color = '#fff7ed'
    el.style.borderRadius = '6px'
    el.style.font =
      '12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif'
    el.style.boxShadow = '0 4px 10px rgba(0,0,0,.15)'

    el.textContent = 'scripts/script-three.js injected ✔'

    document.body.appendChild(el)
  } catch (error) {
    console.log('[special-folders-scripts] script-three error', error)
  }
}
