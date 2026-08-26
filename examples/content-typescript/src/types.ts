// The shapes the three surfaces of this template share. The content script,
// the options page, and the background script all import from here, so the
// message and the setting cannot drift apart without a type error.
export type Settings = {
  showBadge: boolean
}

export type OpenOptionsMessage = {
  type: 'open-options'
}
