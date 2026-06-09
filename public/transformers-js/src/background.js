// background.js - Handles requests from the UI, runs the model, then sends back a response
import {env, pipeline} from '@huggingface/transformers'
import {ACTION_NAME, CONTEXT_MENU_ITEM_ID} from './constants.js'

console.log(
  '[From the background context] Hello from the background worker/script!'
)
console.log('Transformers.js background script loaded!')

// Browser compatibility handling for sidebar functionality
const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

if (isFirefoxLike) {
  browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open()
  })
} else {
  chrome.action.onClicked.addListener(() => {
    chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})
  })
}

// If you'd like to use a local model instead of loading the model
// from the Hugging Face Hub, you can remove this line.
env.allowLocalModels = false

// A config-aware model manager that caches pipelines per configuration
function configKey(cfg) {
  const safe = {
    task: cfg.task,
    model: cfg.model,
    device: cfg.device,
    dtype: cfg.dtype
  }
  return JSON.stringify(safe)
}

// Build a cache entry whose `fn` lazily instantiates the pipeline on first use
// and serializes calls through a single promise chain.
function createCachedRunner(cfg, progress_callback) {
  const entry = {}
  entry.fn = async (...args) => {
    entry.instance ||= pipeline(cfg.task, cfg.model, {
      progress_callback,
      device: cfg.device,
      dtype: cfg.dtype
    })
    entry.promise_chain = (entry.promise_chain || Promise.resolve()).then(
      async () => {
        const runner = await entry.instance
        return runner(...args)
      }
    )
    return entry.promise_chain
  }
  return entry
}

class ModelManager {
  constructor() {
    this.cache = new Map()
    this.currentKey = null
    this.currentConfig = null
    this.ready = this.loadInitial()
    chrome.storage.onChanged.addListener(this.onStorageChanged.bind(this))
  }

  async loadInitial() {
    const {modelConfig} = await chrome.storage.sync.get('modelConfig')
    this.currentConfig = modelConfig || {
      task: 'text-classification',
      model: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
      device: 'webgpu',
      dtype: 'q4'
    }
    this.currentKey = configKey(this.currentConfig)
  }

  onStorageChanged(changes, area) {
    if (area !== 'sync' || !changes.modelConfig) return
    this.currentConfig = changes.modelConfig.newValue
    this.currentKey = configKey(this.currentConfig)
    // Lazy rebuild: next call uses the new key; cache retains previous instance
  }

  async getRunner(progress_callback) {
    await this.ready
    const key = this.currentKey

    if (!this.cache.has(key)) {
      this.cache.set(
        key,
        createCachedRunner(this.currentConfig, progress_callback)
      )
    }
    return this.cache.get(key).fn
  }
}

const models = new ModelManager()

const classify = async (text) => {
  const runner = await models.getRunner(() => {
    // Optionally forward progress to UI
    // console.log('progress', data)
  })
  return runner(text)
}

// Ask the active tab's content script for either the full page context or
// the current selection. Mirrors the ai-* templates' relay pattern.
async function relayActiveTabRequest(messageType) {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  })
  if (!tab?.id) {
    return {ok: false, error: 'No active tab'}
  }
  try {
    const context = await chrome.tabs.sendMessage(tab.id, {type: messageType})
    if (!context) {
      return {ok: false, error: 'No context received from page'}
    }
    return {ok: true, context}
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return {ok: false, error}
  }
}

// Right-click → "Classify selection" runs the pipeline directly and
// broadcasts the result so an open sidebar can pick it up.
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ITEM_ID,
      title: 'Classify selection with Transformers.js',
      contexts: ['selection']
    })
  } catch (error) {
    console.warn('[transformers-js] contextMenus.create failed', error)
  }
})

chrome.contextMenus?.onClicked.addListener(async (info) => {
  if (info.menuItemId !== CONTEXT_MENU_ITEM_ID) return
  const text = info.selectionText?.trim()
  if (!text) return
  try {
    const result = await classify(text)
    chrome.runtime.sendMessage({
      action: 'classification-broadcast',
      ok: true,
      text,
      result
    })
  } catch (e) {
    chrome.runtime.sendMessage({
      action: 'classification-broadcast',
      ok: false,
      error: e?.message || 'classification failed'
    })
  }
})

////////////////////// Message Events /////////////////////
//
// Listen for messages from the UI, process it, and send the result back.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === ACTION_NAME) {
    ;(async function () {
      try {
        const result = await classify(message.text)
        sendResponse(result)
      } catch (e) {
        sendResponse({error: e?.message || 'classification failed'})
      }
    })()
    return true
  }

  if (
    message.action === 'getActiveTabContext' ||
    message.action === 'getActiveTabSelection'
  ) {
    const messageType =
      message.action === 'getActiveTabSelection'
        ? 'getSelection'
        : 'getPageContext'
    ;(async () => sendResponse(await relayActiveTabRequest(messageType)))()
    return true
  }

  if (message.action === 'model-config-updated') {
    // Storage listener already updates; acknowledge for UI
    sendResponse({ok: true})
    return
  }
})
//////////////////////////////////////////////////////////////
