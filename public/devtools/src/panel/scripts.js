const output = document.getElementById('inspected-title')

// chrome.devtools only exists when this page runs as a devtools panel. Opened
// as a plain extension page, such as in a test, the namespace is missing.
if (chrome?.devtools?.inspectedWindow) {
  chrome.devtools.inspectedWindow.eval('document.title', (result, error) => {
    if (error) {
      output.textContent = 'Could not read the inspected page.'
      return
    }
    output.textContent = result || 'The inspected page has no title.'
  })
} else {
  output.textContent =
    'Open this page from the Example tab of the browser devtools to read the inspected page.'
}
