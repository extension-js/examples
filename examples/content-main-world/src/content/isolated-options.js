// ISOLATED world companion for the MAIN world UI.
// chrome.storage and chrome.runtime do not exist in the MAIN world, so this
// half owns both and relays over window.postMessage.
import {
  BRIDGE_CHANNEL,
  REQUEST_POSITION,
  PUBLISH_POSITION,
  OPEN_OPTIONS,
  SETTING_KEY,
  DEFAULT_VALUE
} from './utils/bridge.js'

console.log('[content-main-world] isolated-options loaded (ISOLATED world)')

/**
 * Extension.js content_script entrypoint. The framework calls this on
 * injection and calls the returned function on HMR/teardown to clean up.
 * Do not invoke it yourself.
 */
export default function initial() {
  // The page shares this window and can read and forge these messages, so the
  // payloads stay trivial and carry nothing worth stealing or faking.
  const publish = (position) => {
    window.postMessage(
      {channel: BRIDGE_CHANNEL, type: PUBLISH_POSITION, value: position},
      '*'
    )
  }

  // The key is absent until the first write, so ask storage for the default too.
  const readAndPublish = () => {
    chrome.storage.sync.get({[SETTING_KEY]: DEFAULT_VALUE}, (settings) => {
      publish(settings[SETTING_KEY])
    })
  }

  const onBridgeMessage = (event) => {
    if (event.source !== window) return
    const data = event.data
    if (!data || data.channel !== BRIDGE_CHANNEL) return
    if (data.type === REQUEST_POSITION) readAndPublish()
    // A content script cannot open the options page itself, and the MAIN world
    // cannot even reach chrome.runtime, so the click is relayed twice.
    if (data.type === OPEN_OPTIONS) {
      chrome.runtime.sendMessage({type: OPEN_OPTIONS})
    }
  }

  window.addEventListener('message', onBridgeMessage)

  // Either half may load first, so publish now for the half already listening
  // and answer the request from the half that was not.
  readAndPublish()

  // The options page writes the same key, so the badge follows it live rather
  // than waiting for the next page load.
  const onSettingChanged = (changes, areaName) => {
    if (areaName === 'sync' && changes[SETTING_KEY]) {
      publish(changes[SETTING_KEY].newValue)
    }
  }
  chrome.storage.onChanged.addListener(onSettingChanged)

  return () => {
    window.removeEventListener('message', onBridgeMessage)
    chrome.storage.onChanged.removeListener(onSettingChanged)
  }
}
