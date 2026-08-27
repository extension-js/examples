console.log(
  '[From the background context] Hello from the background worker/script!'
)
// Background script for Custom Font Example
console.log('Custom Font Example: Background script loaded')

// A content script cannot open the options page itself: openOptionsPage lives
// on the extension side, so the click is relayed here and opened from here.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'open-options') {
    chrome.runtime.openOptionsPage()
  }
})
