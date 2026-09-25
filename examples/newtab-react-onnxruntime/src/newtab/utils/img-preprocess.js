import {Tensor} from 'onnxruntime-web/webgpu'

/**
 * Pre-process input image.
 *
 * @param {ImageData|HTMLCanvasElement|OffscreenCanvas} input - input image data/canvas
 * @param {[Number, Number]} outputSize - Output size [width, height]
 * @param {String} imgszType - Processing type, "dynamic" or "zeroPad"
 * @returns {[ort.Tensor, Number, Number]} - return [inputTensor, xRatio, yRatio]
 */
const preProcessImage = (input, outputSize, imgszType) => {
  const imageData = ensureImageData(input)

  if (!imageData) {
    throw new Error('Unable to read image data for preprocessing.')
  }

  let preProcessedData, xRatio, yRatio, inputTensor, div_width, div_height

  if (imgszType === 'dynamic') {
    ;[preProcessedData, xRatio, yRatio, div_width, div_height] =
      dynamicInputProcess(imageData, outputSize)

    // create input tensor
    inputTensor = new Tensor(
      'float32',
      preProcessedData,
      [1, 3, div_height, div_width] // [batch, channel, height, width]
    )
  } else if (imgszType === 'zeroPad') {
    const modelDefaultInputSize = [640, 640] // yolo model default input size
    ;[preProcessedData, xRatio, yRatio] = zeroPadInputProcess(
      imageData,
      modelDefaultInputSize,
      outputSize
    )

    // create input tensor
    inputTensor = new Tensor(
      'float32',
      preProcessedData,
      [1, 3, modelDefaultInputSize[1], modelDefaultInputSize[0]] // [batch, channel, height, width]
    )
  }

  return [inputTensor, xRatio, yRatio]
}

/**
 * Pre process input image.
 *
 * Zero padding to square and resize to input size.
 *
 * @param {ImageData} imageData - Pre process yolo model input image.
 * @param {Number} modelSize - Yolo model image size input [width, height].
 * @returns {[Float32Array, Number, Number]} Processed tensor data, xRatio, yRatio.
 */
const zeroPadInputProcess = (imageData, modelSize) => {
  // Resize to dimensions divisible by 32
  const [div_width, div_height] = divStride(
    32,
    imageData.width,
    imageData.height
  )
  const resized = resizeImageData(imageData, div_width, div_height)

  // Padding to square
  const max_dim = Math.max(div_width, div_height)
  const padded = padToSquare(resized, max_dim)

  // Resize to input size and normalize to [0, 1]
  const resizedModel = resizeImageData(padded, modelSize[0], modelSize[1])
  const preProcessed = imageDataToTensorData(resizedModel)

  const xRatio = max_dim / div_width
  const yRatio = max_dim / div_height

  return [preProcessed, xRatio, yRatio]
}

/**
 * Pre process input image for dynamic input model.
 *
 * @param {ImageData} imageData - Pre process yolo model input image.
 * @returns {[Float32Array, Number, Number ...]} Processed tensor data, xRatio, yRatio, div_width, div_height.
 */
const dynamicInputProcess = (imageData, outputSize) => {
  // resize image to divisible by 32
  const [div_width, div_height] = divStride(
    32,
    imageData.width,
    imageData.height
  )

  // resize, normalize to [0, 1]
  const resized = resizeImageData(imageData, div_width, div_height)
  const preProcessed = imageDataToTensorData(resized)
  const xRatio = outputSize[0] / div_width // scale factor for overlay
  const yRatio = outputSize[1] / div_height

  return [preProcessed, xRatio, yRatio, div_width, div_height]
}

/**
 * Return height and width are divisible by stride.
 * @param {Number} stride - Stride value.
 * @param {Number} width - Image width.
 * @param {Number} height - Image height.
 * @returns {[Number]}[width, height] divisible by stride.
 **/
const divStride = (stride, width, height) => {
  width =
    width % stride >= stride / 2
      ? (Math.floor(width / stride) + 1) * stride
      : Math.floor(width / stride) * stride

  height =
    height % stride >= stride / 2
      ? (Math.floor(height / stride) + 1) * stride
      : Math.floor(height / stride) * stride

  return [width, height]
}

const ensureImageData = (input) => {
  if (typeof ImageData !== 'undefined' && input instanceof ImageData) {
    return input
  }

  if (
    input &&
    typeof input === 'object' &&
    typeof input.width === 'number' &&
    typeof input.height === 'number' &&
    typeof input.getContext === 'function'
  ) {
    const ctx = input.getContext('2d', {willReadFrequently: true})
    if (!ctx) return null

    return ctx.getImageData(0, 0, input.width, input.height)
  }

  return null
}

const resizeImageData = (imageData, width, height) => {
  const srcCanvas = createCanvas(imageData.width, imageData.height)
  const srcCtx = srcCanvas.getContext('2d', {willReadFrequently: true})
  srcCtx.putImageData(imageData, 0, 0)

  const dstCanvas = createCanvas(width, height)
  const dstCtx = dstCanvas.getContext('2d', {willReadFrequently: true})
  dstCtx.drawImage(srcCanvas, 0, 0, width, height)

  return dstCtx.getImageData(0, 0, width, height)
}

const padToSquare = (imageData, size) => {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d', {willReadFrequently: true})
  ctx.clearRect(0, 0, size, size)
  ctx.putImageData(imageData, 0, 0)

  return ctx.getImageData(0, 0, size, size)
}

const imageDataToTensorData = (imageData) => {
  const {data, width, height} = imageData
  const area = width * height
  const floatData = new Float32Array(area * 3)

  for (let i = 0; i < area; i++) {
    const offset = i * 4
    floatData[i] = data[offset] / 255
    floatData[i + area] = data[offset + 1] / 255
    floatData[i + area * 2] = data[offset + 2] / 255
  }

  return floatData
}

const createCanvas = (width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  return canvas
}

/**
 * Ultralytics default color palette https://ultralytics.com/.
 *
 * This class provides methods to work with the Ultralytics color palette, including converting hex color codes to
 * RGB values.
 */
class Colors {
  static palette = [
    '042AFF',
    '0BDBEB',
    'F3F3F3',
    '00DFB7',
    '111F68',
    'FF6FDD',
    'FF444F',
    'CCED00',
    '00F344',
    'BD00FF',
    '00B4FF',
    'DD00BA',
    '00FFFF',
    '26C000',
    '01FFB3',
    '7D24FF',
    '7B0068',
    'FF1B6C',
    'FC6D2F',
    'A2FF0B'
  ].map((c) => Colors.hex2rgba(`#${c}`))
  static n = Colors.palette.length
  static cache = {} // Cache for colors

  static hex2rgba(h, alpha = 1.0) {
    return [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
      alpha
    ]
  }

  static getColor(i, alpha = 1.0, bgr = false) {
    const key = `${i}-${alpha}-${bgr}`

    if (Colors.cache[key]) {
      return Colors.cache[key]
    }

    const c = Colors.palette[i % Colors.n]
    const rgba = [...c.slice(0, 3), alpha]
    const result = bgr ? [rgba[2], rgba[1], rgba[0], rgba[3]] : rgba
    Colors.cache[key] = result

    return result
  }
}

export {preProcessImage, Colors}
