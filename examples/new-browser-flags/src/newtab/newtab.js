;(function () {
  const btn = document.getElementById('openSidebar')
  if (!btn) return

  btn.addEventListener('click', () => {
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({type: 'openSidebar'})
        return
      }
    } catch {}
    try {
      if (typeof browser !== 'undefined' && browser?.runtime?.sendMessage) {
        browser.runtime.sendMessage({type: 'openSidebar'})
      }
    } catch {}
  })
})()
