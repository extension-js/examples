import {ACTION_NAME} from '../constants.js'
import './styles.css'

// Firefox Manifest V2 returns promises only from the browser namespace.
const ext = globalThis.browser ?? chrome

const DEFAULTS = {
  task: 'text-classification',
  model: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  device: 'webgpu',
  dtype: 'q4'
}

const MODELS = {
  'text-classification': [
    'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    'Xenova/mobilebert-uncased-mnli'
  ],
  'token-classification': ['Xenova/bert-base-cased-finetuned-conll03-english'],
  'question-answering': ['Xenova/distilbert-base-cased-distilled-squad'],
  'text-generation': ['Xenova/tiny-stories-1M']
}

function SidebarApp() {
  const root = document.getElementById('root')
  if (!root) return

  // The static markup lives in index.html, so the page only wires it up.
  const inputElement = root.querySelector('#text-input')
  const outputElement = root.querySelector('#output')
  const titleElement = root.querySelector('#title')
  const runBtn = root.querySelector('#run-analysis')
  const usePageBtn = root.querySelector('#use-page')
  const useSelectionBtn = root.querySelector('#use-selection')
  const taskEl = root.querySelector('#task')
  const modelEl = root.querySelector('#model')
  const customEl = root.querySelector('#customModel')
  const deviceEl = root.querySelector('#device')
  const dtypeEl = root.querySelector('#dtype')

  // Show active model in title (if available)
  ext.storage.sync.get('modelConfig').then(({modelConfig}) => {
    if (modelConfig?.model && titleElement) {
      titleElement.textContent = `Transformers.js (${modelConfig.model})`
    }
  })

  // Populate task and model selects
  function populateTasks() {
    taskEl.replaceChildren(...Object.keys(MODELS).map((t) => new Option(t, t)))
  }

  function populateModels(taskValue, selected) {
    modelEl.replaceChildren(...MODELS[taskValue].map((m) => new Option(m, m)))

    if (selected && MODELS[taskValue].includes(selected)) {
      modelEl.value = selected
    }
  }

  async function loadConfig() {
    populateTasks()
    const {modelConfig} = await ext.storage.sync.get('modelConfig')
    const cfg = {...DEFAULTS, ...(modelConfig || {})}
    taskEl.value = cfg.task
    populateModels(cfg.task, cfg.model)
    customEl.value = cfg.customModel || ''
    deviceEl.value = cfg.device
    dtypeEl.value = cfg.dtype
  }

  function currentConfig() {
    const customModel = customEl.value.trim()

    return {
      task: taskEl.value,
      model: customModel || modelEl.value,
      customModel: customModel || undefined,
      device: deviceEl.value,
      dtype: dtypeEl.value
    }
  }

  async function saveConfig() {
    const cfg = currentConfig()
    await ext.storage.sync.set({modelConfig: cfg})

    if (titleElement && cfg.model) {
      titleElement.textContent = `Transformers.js (${cfg.model})`
    }

    // Notify background (optional, background also listens to storage change)
    ext.runtime.sendMessage({action: 'model-config-updated', config: cfg})
  }

  // Changing the task re-populates the model list; every change persists config.
  taskEl.addEventListener('change', async () => {
    populateModels(taskEl.value)
    await saveConfig()
  })
  ;[modelEl, customEl, deviceEl, dtypeEl].forEach((el) =>
    el.addEventListener('change', saveConfig)
  )

  loadConfig()

  // Run analysis only when clicking the button
  runBtn.addEventListener('click', async () => {
    const text = inputElement.value.trim()

    if (!text) {
      outputElement.textContent =
        'Enter some text above to see the sentiment analysis results.'

      outputElement.className = 'sidebar_output'

      return
    }

    outputElement.textContent = 'Analyzing sentiment...'
    outputElement.className = 'sidebar_output sidebar_output--loading'

    try {
      await classifyText(text, outputElement)
    } catch (error) {
      showError(error, outputElement)
    }
  })

  // Pull text from the active page (relayed through the background SW
  // because the sidebar can't message tabs directly in MV3).
  async function fillFromActiveTab(action, fallback) {
    try {
      const response = await ext.runtime.sendMessage({action})

      if (!response?.ok) {
        showError(
          new Error(response?.error || `Could not read ${fallback}`),
          outputElement
        )

        return
      }

      const text = response.context?.text || ''

      if (!text) {
        showError(
          new Error(`No ${fallback} found on the active tab`),
          outputElement
        )

        return
      }

      inputElement.value = text
      outputElement.textContent = `Loaded ${fallback} from the active tab. Click "Run Analysis" to classify it.`
      outputElement.className = 'sidebar_output'
    } catch (error) {
      showError(error, outputElement)
    }
  }

  usePageBtn.addEventListener('click', () =>
    fillFromActiveTab('getActiveTabContext', 'page text')
  )

  useSelectionBtn.addEventListener('click', () =>
    fillFromActiveTab('getActiveTabSelection', 'selection')
  )

  // Pick up classifications triggered from the right-click context menu.
  ext.runtime.onMessage.addListener((message) => {
    if (message?.action !== 'classification-broadcast') return

    if (message.ok) {
      inputElement.value = message.text
      showResults(message.result, outputElement)
    } else {
      showError(new Error(message.error), outputElement)
    }
  })
}

async function classifyText(text, outputElement) {
  try {
    // Bundle the input data into a message
    const message = {
      action: ACTION_NAME,
      text: text
    }

    // Send message to the service worker
    const response = await ext.runtime.sendMessage(message)

    if (response && response.length > 0) {
      showResults(response, outputElement)
    } else {
      throw new Error('No results received from classification')
    }
  } catch (error) {
    showError(error, outputElement)
  }
}

function showResults(results, outputElement) {
  // Format the results for display
  const formattedResults = results.map((result) => ({
    label: result.label,
    score: (result.score * 100).toFixed(2) + '%',
    confidence:
      result.score > 0.8 ? 'High' : result.score > 0.6 ? 'Medium' : 'Low'
  }))

  const output = {
    results: formattedResults,
    timestamp: new Date().toLocaleTimeString(),
    model: 'DistilBERT (SST-2)'
  }

  outputElement.textContent = JSON.stringify(output, null, 2)
  outputElement.className = 'sidebar_output sidebar_output--success'
}

function showError(error, outputElement) {
  const errorOutput = {
    error: error.message || 'Classification failed',
    timestamp: new Date().toLocaleTimeString(),
    suggestion: 'Try again with different text or check your connection'
  }

  outputElement.textContent = JSON.stringify(errorOutput, null, 2)
  outputElement.className = 'sidebar_output sidebar_output--error'
}

SidebarApp()
