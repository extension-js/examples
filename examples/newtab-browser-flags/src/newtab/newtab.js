;(function () {
  const btn = document.getElementById('openSidebar')
  if (!btn) return

  btn.addEventListener('click', () => {
    // An extension page IS a user input handler, so Firefox opens the sidebar
    // straight from the click. A message hop to the background loses the gesture.
    try {
      if (typeof browser !== 'undefined' && browser?.sidebarAction?.open) {
        browser.sidebarAction.open()

        return
      }
    } catch {
      // Ignore errors - best effort
    }

    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({type: 'openSidebar'})

        return
      }
    } catch {
      // Ignore errors - best effort
    }

    try {
      if (typeof browser !== 'undefined' && browser?.runtime?.sendMessage) {
        browser.runtime.sendMessage({type: 'openSidebar'})
      }
    } catch {
      // Ignore errors - best effort
    }
  })
})()
