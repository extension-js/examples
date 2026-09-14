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
async function onActionClicked(tab) {
  try {
    if (!tab?.id) return
    await injectScripts(tab.id)
  } catch (error) {
    console.warn('[special-folders-scripts] action injection failed', error)
  }
}

const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

// The Firefox manifest is MV2, so the toolbar button is browser_action there.
// Each branch is compiled out of the other browser's build, which keeps the
// chrome.action reference out of the Gecko bundle entirely.
if (isFirefoxLike) {
  chrome.browserAction.onClicked.addListener(onActionClicked)
}

if (!isFirefoxLike) {
  chrome.action.onClicked.addListener(onActionClicked)
}

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
