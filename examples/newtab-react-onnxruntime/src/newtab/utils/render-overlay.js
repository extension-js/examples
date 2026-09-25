import {Colors} from './img-preprocess.js'

/**
 * Draw bounding boxes in overlay canvas based on task type.
 * @param {Array[Object]} predictions - Detection results
 * @param {HTMLCanvasElement} overlatCtx - Show boxes in overlay canvas element
 * @param {Object} currentClasses - Currently selected classes object
 */
export async function renderOverlay(predictions, overlayCtx, currentClasses) {
  // Calculate diagonal length of the canvas
  const diagonalLength = Math.sqrt(
    Math.pow(overlayCtx.canvas.width, 2) + Math.pow(overlayCtx.canvas.height, 2)
  )
  const lineWidth = diagonalLength / 250

  if (!predictions || predictions.length === 0) return

  draw_object_detection(predictions, overlayCtx, lineWidth, currentClasses)
}

/**
 * Draw object detection results
 */
function draw_object_detection(predictions, ctx, lineWidth, currentClasses) {
  if (!predictions || predictions.length === 0) return

  const predictionsByClass = {}

  predictions.forEach((predict) => {
    const classId = predict.classIdx
    if (!predictionsByClass[classId]) predictionsByClass[classId] = []

    predictionsByClass[classId].push(predict)
  })

  Object.entries(predictionsByClass).forEach(([classId, items]) => {
    const color = Colors.getColor(Number(classId), 0.2)
    const borderColor = Colors.getColor(Number(classId), 0.8)
    const rgbaFillColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`
    const rgbaBorderColor = `rgba(${borderColor[0]}, ${borderColor[1]}, ${borderColor[2]}, ${borderColor[3]})`

    ctx.fillStyle = rgbaFillColor
    items.forEach((predict) => {
      const [x1, y1, width, height] = predict.bbox
      ctx.fillRect(x1, y1, width, height)
    })

    // draw bounding box
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = rgbaBorderColor
    items.forEach((predict) => {
      const [x1, y1, width, height] = predict.bbox
      ctx.strokeRect(x1, y1, width, height)
    })

    // draw score text
    ctx.fillStyle = rgbaBorderColor
    ctx.font = '16px Arial'
    items.forEach((predict) => {
      const [x1, y1] = predict.bbox
      const text = `${
        currentClasses.classes[predict.classIdx]
      } ${predict.score.toFixed(2)}`
      drawTextWithBackground(ctx, text, x1, y1)
    })
  })
}

const fontCache = {
  font: '16px Arial',
  measurements: {}
}

function getMeasuredTextWidth(text, ctx) {
  if (!fontCache.measurements[text]) {
    fontCache.measurements[text] = ctx.measureText(text).width
  }

  return fontCache.measurements[text]
}

/**
 * Helper function to draw text with background
 */
function drawTextWithBackground(ctx, text, x, y) {
  ctx.font = fontCache.font
  const textWidth = getMeasuredTextWidth(text, ctx)
  const textHeight = 16

  // Calculate the Y position for the text
  let textY = y - 5
  let rectY = y - textHeight - 4

  // Check if the text will be outside the canvas
  if (rectY < 0) {
    // Adjust the Y position to be inside the canvas
    textY = y + textHeight + 5
    rectY = y + 1
  }

  const currentFillStyle = ctx.fillStyle
  ctx.fillRect(x - 1, rectY, textWidth + 4, textHeight + 4)
  ctx.fillStyle = 'white'
  ctx.fillText(text, x, textY)
  ctx.fillStyle = currentFillStyle
}
