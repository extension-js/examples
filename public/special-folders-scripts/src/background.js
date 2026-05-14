console.log(
  '[From the background context] Hello from the background worker/script!'
)
// Special Folders (scripts/) demo
// Any JS-like file inside src/scripts/ is treated as an entrypoint.
// Click the extension action to inject and execute all scripts/* in the page.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab?.id) return

    // chrome.scripting.executeScript expects paths relative to the extension
    // root, not the authoring source tree. The scripts/ folder is emitted to
    // dist/<browser>/scripts/, so /scripts/<name>.js (or "scripts/<name>.js")
    // resolves to chrome-extension://<id>/scripts/<name>.js at runtime.
    await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      files: [
        '/scripts/script-one.js',
        '/scripts/script-two.js',
        '/scripts/script-three.js'
      ]
    })
  } catch (error) {
    console.warn('[special-folders-scripts] injection failed', error)
  }
})
