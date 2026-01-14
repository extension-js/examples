// Special Folders (scripts/) demo
// Any JS-like file inside src/scripts/ is treated as an entrypoint.
// Click the extension action to inject and execute all scripts/* in the page.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab?.id) return

    await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      files: [
        '../scripts/script-one.js',
        '../scripts/script-two.js',
        '../scripts/script-three.js'
      ]
    })
  } catch (error) {
    console.warn('[special-folders-scripts] injection failed', error)
  }
})
