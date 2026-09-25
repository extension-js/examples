import {OCRClient} from 'tesseract-wasm'

console.log('[From the newtab override context] Hello regular page!')

const workerURL = chrome.runtime.getURL('tesseract-worker.js')
const wasmURL = chrome.runtime.getURL('tesseract-core.wasm')
const modelURL = chrome.runtime.getURL('tessdata/eng.traineddata')

const statusText = document.getElementById('statusText')
const progressBar = document.getElementById('progressBar')
const fileInput = document.getElementById(
  'fileInput'
) as HTMLInputElement | null
const runButton = document.getElementById(
  'runButton'
) as HTMLButtonElement | null
const clearButton = document.getElementById(
  'clearButton'
) as HTMLButtonElement | null
const dropzone = document.getElementById('dropzone')
const previewImage = document.getElementById(
  'previewImage'
) as HTMLImageElement | null
const ocrOutput = document.getElementById('ocrOutput')

if (
  !statusText ||
  !progressBar ||
  !fileInput ||
  !runButton ||
  !clearButton ||
  !dropzone ||
  !previewImage ||
  !ocrOutput
) {
  throw new Error('Missing required UI elements')
}

let currentFile: File | null = null
let currentRunId = 0
let ocrClient: OCRClient | null = null
let ocrClientLoading: Promise<OCRClient> | null = null

const setStatus = (message: string) => {
  statusText.textContent = message
}

const setProgress = (progress: number | null) => {
  if (progress === null) {
    progressBar.style.width = '0%'

    return
  }

  const clamped = Math.min(Math.max(progress, 0), 1)
  progressBar.style.width = `${Math.round(clamped * 100)}%`
}

const setBusy = (busy: boolean) => {
  runButton.disabled = busy || !currentFile
  clearButton.disabled = busy
  fileInput.disabled = busy
}

const clearOutput = () => {
  if (previewImage.dataset.url) {
    URL.revokeObjectURL(previewImage.dataset.url)
  }

  previewImage.src = ''
  previewImage.dataset.url = ''
  previewImage.classList.remove('visible')
  ocrOutput.textContent = 'Pick an image to get started.'
  setStatus('Idle')
  setProgress(null)
}

const loadBundled = async (url: string) => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to load bundled asset ${url}`)
  }

  return response.arrayBuffer()
}

const loadOCRClient = async () => {
  if (ocrClient) {
    return ocrClient
  }

  if (ocrClientLoading) {
    return ocrClientLoading
  }

  const loadPromise = (async () => {
    setStatus('Loading OCR engine')
    const wasmBinary = await loadBundled(wasmURL)
    const client = new OCRClient({
      workerURL,
      wasmBinary
    })
    setStatus('Loading English model')
    await client.loadModel(await loadBundled(modelURL))
    ocrClient = client
    ocrClientLoading = null

    return client
  })()

  ocrClientLoading = loadPromise

  return loadPromise
}

const updatePreview = (file: File) => {
  if (previewImage.dataset.url) {
    URL.revokeObjectURL(previewImage.dataset.url)
  }

  const url = URL.createObjectURL(file)
  previewImage.src = url
  previewImage.dataset.url = url
  previewImage.classList.add('visible')
}

const pickFile = (file: File | null) => {
  currentFile = file
  runButton.disabled = !file

  if (!file) {
    clearOutput()

    return
  }

  updatePreview(file)
  setStatus('Ready to run OCR')
  setProgress(null)
}

const runOCR = async () => {
  if (!currentFile) {
    return
  }

  const runId = ++currentRunId
  setBusy(true)
  setStatus('Decoding image')
  setProgress(0)
  ocrOutput.textContent = 'Recognizing text...'

  try {
    const imageBitmap = await createImageBitmap(currentFile)
    const client = await loadOCRClient()

    if (runId !== currentRunId) {
      return
    }

    setStatus('Loading image')
    await client.loadImage(imageBitmap)

    if (runId !== currentRunId) {
      return
    }

    setStatus('Recognizing text')
    await client.getTextBoxes('word', (progress) => {
      if (runId !== currentRunId) {
        return
      }

      setProgress(progress)
    })

    const text = await client.getText()

    if (runId !== currentRunId) {
      return
    }

    ocrOutput.textContent = text || 'No text detected.'
    setStatus('Complete')
    setProgress(null)
  } catch (error) {
    console.error(error)
    ocrOutput.textContent =
      'Something went wrong. Check the console for details.'

    setStatus('Failed')
    setProgress(null)
  } finally {
    setBusy(false)
  }
}

const bindDropzone = () => {
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault()
    dropzone.classList.add('dragging')
  })

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragging')
  })

  dropzone.addEventListener('drop', (event) => {
    event.preventDefault()
    dropzone.classList.remove('dragging')
    const file = event.dataTransfer?.files?.[0] ?? null
    pickFile(file)
  })
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0] ?? null
  pickFile(file)
})

runButton.addEventListener('click', () => {
  void runOCR()
})

clearButton.addEventListener('click', () => {
  currentRunId += 1
  currentFile = null
  fileInput.value = ''
  clearOutput()
  setBusy(false)
})

bindDropzone()
setBusy(false)
clearOutput()
