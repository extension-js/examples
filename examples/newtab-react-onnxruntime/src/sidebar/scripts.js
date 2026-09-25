import {LAST_DETECTION_KEY} from '../last-detection.js'

const status = document.getElementById('status')
const list = document.getElementById('results')

function render(detection) {
  list.replaceChildren()

  if (!detection || !Array.isArray(detection.items)) {
    status.textContent = 'No detection yet.'

    return
  }

  if (detection.items.length === 0) {
    status.textContent = 'The last run found nothing.'

    return
  }

  status.textContent =
    detection.items.length === 1
      ? '1 object'
      : `${detection.items.length} objects`

  for (const item of detection.items) {
    const row = document.createElement('li')
    row.dataset.detectionItem = ''

    const name = document.createElement('span')
    name.textContent = item.label

    const score = document.createElement('span')
    score.textContent =
      typeof item.score === 'number' ? `${(item.score * 100).toFixed(1)}%` : ''

    row.append(name, score)
    list.append(row)
  }
}

function readStoredDetection() {
  chrome.storage.local.get(LAST_DETECTION_KEY, (stored) => {
    if (chrome.runtime.lastError) {
      status.textContent = 'Could not read the last detection.'

      return
    }

    render(stored?.[LAST_DETECTION_KEY])
  })
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[LAST_DETECTION_KEY]) return

  render(changes[LAST_DETECTION_KEY].newValue)
})

readStoredDetection()
