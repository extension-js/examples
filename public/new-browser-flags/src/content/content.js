export default function initial() {
  // Log a message when the content script is injected
  console.log(
    'Browser Flags Example content script loaded on:',
    window.location.href
  )

  // Create a visible indicator that the extension is loaded
  const indicator = document.createElement('div')
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    z-index: 999999;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `
  indicator.textContent = 'Browser Flags Extension Loaded!'
  document.body.appendChild(indicator)

  // Remove the indicator after 5 seconds
  const timeoutId = setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator)
    }
  }, 5000)

  // Return cleanup function
  return () => {
    clearTimeout(timeoutId)
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator)
    }
  }
}
