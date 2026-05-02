// background.js - Handles requests from the UI, runs the model, then sends back a response

import {env, pipeline} from '@huggingface/transformers'

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
    const cfg = this.currentConfig

    if (!this.cache.has(key)) {
      const entry = {}
      entry.fn = async (...args) => {
        entry.instance ||= pipeline(cfg.task, cfg.model, {
          progress_callback,
          device: cfg.device,
          dtype: cfg.dtype
        })
        return (entry.promise_chain = (
          entry.promise_chain || Promise.resolve()
        ).then(async () => {
          const runner = await entry.instance
          return runner(...args)
        }))
      }
      this.cache.set(key, entry)
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

////////////////////// Message Events /////////////////////
//
// Listen for messages from the UI, process it, and send the result back.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'classify') {
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

  if (message.action === 'model-config-updated') {
    // Storage listener already updates; acknowledge for UI
    sendResponse({ok: true})
    return
  }
})
//////////////////////////////////////////////////////////////
