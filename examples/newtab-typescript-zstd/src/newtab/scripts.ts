import {compress, decompress, init} from '@bokuweb/zstd-wasm'

console.log('[From the newtab override context] Hello regular page!')

const levelInput = document.getElementById(
  'levelInput'
) as HTMLInputElement | null
const levelValue = document.getElementById('levelValue')
const compressButton = document.getElementById(
  'compressButton'
) as HTMLButtonElement | null
const decompressButton = document.getElementById(
  'decompressButton'
) as HTMLButtonElement | null
const clearButton = document.getElementById(
  'clearButton'
) as HTMLButtonElement | null
const inputText = document.getElementById(
  'inputText'
) as HTMLTextAreaElement | null
const outputText = document.getElementById(
  'outputText'
) as HTMLTextAreaElement | null
const statusText = document.getElementById('statusText')
const statusMeta = document.getElementById('statusMeta')
const inputBytes = document.getElementById('inputBytes')
const outputBytes = document.getElementById('outputBytes')
const ratioValue = document.getElementById('ratioValue')

if (
  !levelInput ||
  !levelValue ||
  !compressButton ||
  !decompressButton ||
  !clearButton ||
  !inputText ||
  !outputText ||
  !statusText ||
  !statusMeta ||
  !inputBytes ||
  !outputBytes ||
  !ratioValue
) {
  throw new Error('Missing required UI elements')
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const setStatus = (title: string, meta: string) => {
  statusText.textContent = title
  statusMeta.textContent = meta
}

const setStats = (inputSize: number, outputSize: number) => {
  inputBytes.textContent = inputSize.toString()
  outputBytes.textContent = outputSize.toString()

  if (inputSize === 0 || outputSize === 0) {
    ratioValue.textContent = '–'

    return
  }

  const ratio = (outputSize / inputSize) * 100
  ratioValue.textContent = `${ratio.toFixed(1)}%`
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

const fromBase64 = (value: string) => {
  const cleaned = value.trim()

  if (!cleaned) {
    return new Uint8Array()
  }

  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

const updateLevelLabel = () => {
  levelValue.textContent = levelInput.value
}

const setBusy = (busy: boolean) => {
  compressButton.disabled = busy
  decompressButton.disabled = busy
  clearButton.disabled = busy
  inputText.disabled = busy
  outputText.disabled = busy
}

const handleCompress = () => {
  try {
    const raw = inputText.value
    const inputBytesValue = encoder.encode(raw)

    if (!raw.trim()) {
      setStatus('No input', 'Type or paste text before compressing.')
      setStats(0, 0)
      outputText.value = ''

      return
    }

    const level = Number(levelInput.value) || 10
    const compressed = compress(inputBytesValue, level)
    outputText.value = toBase64(compressed)
    setStats(inputBytesValue.length, compressed.length)
    setStatus('Compressed', `Level ${level} • Base64 output ready`)
  } catch (error) {
    console.error(error)
    setStatus('Compress failed', 'Check the console for details.')
  }
}

const handleDecompress = () => {
  try {
    const encoded = outputText.value

    if (!encoded.trim()) {
      setStatus('No output', 'Paste Base64 data before decompressing.')

      return
    }

    const compressed = fromBase64(encoded)
    const decompressed = decompress(compressed)
    const text = decoder.decode(decompressed)
    inputText.value = text
    setStats(decompressed.length, compressed.length)
    setStatus('Decompressed', 'Output decoded into the input panel')
  } catch (error) {
    console.error(error)
    setStatus('Decompress failed', 'Check the console for details.')
  }
}

const handleClear = () => {
  inputText.value = ''
  outputText.value = ''
  setStats(0, 0)
  setStatus('Ready', 'Add text to compress or Base64 to decompress.')
}

const boot = async () => {
  setBusy(true)

  try {
    setStatus('Loading Zstandard…', 'Preparing the bundled runtime')
    // `init()` resolves `./zstd.wasm` next to the library module. The bundler
    // emits that file into the extension, so this never hits the network.
    await init()
    setStatus('Ready', 'Add text to compress or Base64 to decompress.')
  } catch (error) {
    console.error(error)
    setStatus('Failed to load', 'Check the console for details.')
  } finally {
    setBusy(false)
  }
}

levelInput.addEventListener('input', updateLevelLabel)
compressButton.addEventListener('click', handleCompress)
decompressButton.addEventListener('click', handleDecompress)
clearButton.addEventListener('click', handleClear)

updateLevelLabel()
setStats(0, 0)
boot()
