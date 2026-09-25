export const LAST_DETECTION_KEY = 'lastDetection'

// The new tab writes the latest run here. The side panel reads it on open,
// including when it was closed while the run finished.
export function handOverDetection(results, classNames) {
  const items = (Array.isArray(results) ? results : []).map((item) => ({
    label:
      (classNames && classNames[item.classIdx]) ||
      (item.classIdx == null ? 'Object' : `Class ${item.classIdx}`),
    score: typeof item.score === 'number' ? item.score : 0
  }))

  chrome.storage.local.set({
    [LAST_DETECTION_KEY]: {
      detectedAt: Date.now(),
      items
    }
  })
}
