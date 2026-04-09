// Level-1 dependency: imports constants (level 2), imported by each script (level 0).
// Editing this file must also trigger a rebuild of all scripts that import it.
import {BADGE_LABEL, BADGE_VERSION} from './constants.js'

export function createBadge() {
  const badge = document.createElement('span')
  badge.className = 'content_badge'
  badge.textContent = `${BADGE_LABEL} ${BADGE_VERSION}`
  badge.setAttribute('data-badge', 'true')
  return badge
}
