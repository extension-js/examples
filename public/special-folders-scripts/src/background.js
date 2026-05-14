console.log(
  '[From the background context] Hello from the background worker/script!'
)

// chrome.scripting.executeScript expects paths relative to the extension
// root, not the authoring source tree. The scripts/ folder is emitted to
// dist/<browser>/scripts/, so /scripts/<name>.js resolves to
// chrome-extension://<id>/scripts/<name>.js at runtime.
const SCRIPT_FILES = [
  '/scripts/script-one.js',
  '/scripts/script-two.js',
  '/scripts/script-three.js'
]

async function injectScripts(tabId) {
  await chrome.scripting.executeScript({
    target: {tabId},
    files: SCRIPT_FILES
  })
}

// Toolbar action click — activeTab grants temporary access to the current tab.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab?.id) return
    await injectScripts(tab.id)
  } catch (error) {
    console.warn('[special-folders-scripts] action injection failed', error)
  }
})

// In-page "Run scripts/" button (content.js) → background → same executeScript
// path as the toolbar action. Requires host_permissions to inject into the
// page since activeTab isn't granted for arbitrary content-script messages.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'special-folders-scripts:run') return
  const tabId = sender?.tab?.id
  if (typeof tabId !== 'number') {
    sendResponse({ok: false, error: 'no sender.tab.id'})
    return
  }
  injectScripts(tabId)
    .then(() => sendResponse({ok: true}))
    .catch((error) =>
      sendResponse({ok: false, error: String(error?.message || error)})
    )
  return true
})
