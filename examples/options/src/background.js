// A content script cannot open the options page itself: openOptionsPage lives
// on the extension side, so the click is relayed here and opened from here.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'open-options') {
    chrome.runtime.openOptionsPage()
  }
})
