console.log(
  '[From the background context] Hello from the background worker/script!'
)
console.log(
  `${import.meta.env.EXTENSION_PUBLIC_DESCRIPTION_TEXT} loaded with a background script!`
)

interface OpenOptionsMessage {
  type: 'open-options'
}

// The message crosses from the page context, so it arrives untrusted. Narrow
// it to a known shape before acting on it.
function isOpenOptionsMessage(message: unknown): message is OpenOptionsMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Partial<OpenOptionsMessage>).type === 'open-options'
  )
}

// A content script cannot open the options page itself: openOptionsPage lives
// on the extension side, so the click is relayed here and opened from here.
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (isOpenOptionsMessage(message)) {
    chrome.runtime.openOptionsPage()
  }
})
