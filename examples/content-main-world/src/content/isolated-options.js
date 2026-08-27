import {
  BRIDGE_SOURCE,
  SETTING_KEY,
  DEFAULT_SHOW_BADGE
} from './utils/constants.js'

// ISOLATED world companion for the MAIN world UI.
// A MAIN world content script runs in the page's own JavaScript context, where
// chrome.runtime and chrome.storage do not exist. This file runs in the
// isolated world, where they do, so it owns the setting and the Open options
// click on behalf of the UI the MAIN world draws.

/**
 * Extension.js content_script entrypoint. The framework calls this on
 * injection and calls the returned function on HMR/teardown to clean up.
 * Do not invoke it yourself.
 */
export default function initial() {
  // The page shares this window, so it can read and forge these messages. Keep
  // the payloads trivial and never relay anything a page should not trigger.
  const post = (message) => {
    window.postMessage({source: BRIDGE_SOURCE, ...message}, '*')
  }

  const publish = (showBadge) => post({type: 'setting', showBadge})

  // The key is absent until the first write, so ask storage for the default too.
  const publishFromStorage = () => {
    chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_SHOW_BADGE}, (settings) => {
      publish(settings[SETTING_KEY])
    })
  }

  // Either half can load first, so this one publishes on load and also answers
  // a request from the MAIN world script. One of the two always lands.
  const onBridgeMessage = (event) => {
    if (event.source !== window) return
    const data = event.data
    if (!data || data.source !== BRIDGE_SOURCE) return

    if (data.type === 'request-setting') {
      publishFromStorage()
    }

    if (data.type === 'open-options') {
      chrome.runtime.sendMessage({type: 'open-options'})
    }
  }
  window.addEventListener('message', onBridgeMessage)

  // The options page writes the same key, so the UI follows it live rather
  // than waiting for the next page load.
  const onSettingChanged = (changes, areaName) => {
    if (areaName === 'sync' && changes[SETTING_KEY]) {
      publish(changes[SETTING_KEY].newValue)
    }
  }
  chrome.storage.onChanged.addListener(onSettingChanged)

  publishFromStorage()

  return () => {
    chrome.storage.onChanged.removeListener(onSettingChanged)
    window.removeEventListener('message', onBridgeMessage)
  }
}
