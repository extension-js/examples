// Level-2 dependency: imported by create-badge.js
// Editing this file must trigger a rebuild of the MAIN world content script.
export const BADGE_LABEL = 'extension.js'
export const BADGE_VERSION = 'v1'

// Shared by the MAIN world script and its ISOLATED world companion. The MAIN
// world has no chrome.runtime, so the two halves talk over window.postMessage
// and must agree on this channel name.
export const BRIDGE_SOURCE = 'content-main-world'
export const SETTING_KEY = 'showBadge'
export const DEFAULT_SHOW_BADGE = true
