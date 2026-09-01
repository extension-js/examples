const toggle = document.getElementById('greet')
const status = document.getElementById('status')

// chrome.storage only exists when this page runs as part of an installed
// extension. Opened as a plain file, such as in a test, the namespace is
// missing, so the page says so instead of throwing.
const area = chrome?.storage?.sync

if (area) {
  area.get({greet: false}, (saved) => {
    toggle.checked = Boolean(saved.greet)
    status.textContent = 'Saved settings loaded.'
  })

  toggle.addEventListener('change', () => {
    area.set({greet: toggle.checked}, () => {
      status.textContent = toggle.checked
        ? 'Saved. You will be greeted by name.'
        : 'Saved. Greeting turned off.'
    })
  })
} else {
  toggle.disabled = true
  status.textContent =
    'Open this page from the extensions page of your browser to save settings.'
}
