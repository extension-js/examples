console.log('[From the page context] Hello from content_scripts!')

const MAX_TEXT_LENGTH = 8000

function getPageContext() {
  const text = (document.body?.innerText ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH)

  return {
    title: document.title,
    url: location.href,
    text
  }
}

function getSelection() {
  const selection = window.getSelection()
  const text = (selection?.toString() ?? '').trim()

  return {
    title: document.title,
    url: location.href,
    text
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'getPageContext') {
    sendResponse(getPageContext())
    return
  }
  if (message?.type === 'getSelection') {
    sendResponse(getSelection())
    return
  }
})
