// Access environment variable and update the DOM
function updateDescriptionText() {
  const descriptionText =
    import.meta.env.EXTENSION_PUBLIC_DESCRIPTION_TEXT ||
    'an environment variable'

  // Log the environment variable value for debugging
  console.log('Environment variable value:', descriptionText)
  console.log('Full env object:', import.meta.env)

  const descriptionElement = document.getElementById('description-text')
  if (descriptionElement) {
    descriptionElement.textContent = descriptionText
  } else {
    console.error('Could not find element with id "description-text"')
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateDescriptionText)
} else {
  // DOM is already ready
  updateDescriptionText()
}

console.log('Hello from the new tab page!')
