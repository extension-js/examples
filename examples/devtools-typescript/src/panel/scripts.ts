const output = document.querySelector<HTMLParagraphElement>('#inspected-title')

// chrome.devtools only exists when this page runs as a devtools panel. Opened
// as a plain extension page, such as in a test, the namespace is missing.
if (output && chrome?.devtools?.inspectedWindow) {
  chrome.devtools.inspectedWindow.eval(
    'document.title',
    (result: unknown, error?: unknown) => {
      if (error) {
        output.textContent = 'Could not read the inspected page.'
        return
      }
      // eval hands back whatever the page expression produced, so the panel
      // checks the shape instead of trusting it to be a string.
      output.textContent =
        typeof result === 'string' && result.length > 0
          ? result
          : 'The inspected page has no title.'
    }
  )
} else if (output) {
  output.textContent =
    'Open this page from the Example tab of the browser devtools to read the inspected page.'
}
