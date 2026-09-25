import {preProcessImage} from './img-preprocess.js'

/**
 * Inference pipeline for YOLO model.
 * @param {ImageData|HTMLCanvasElement|OffscreenCanvas} imageInput - Input image data or canvas
 * @param {ort.InferenceSession} session - YOLO model ort session.
 * @param {object} model_config - Model configuration object.
 * @returns {[object, string]} Tuple containing:
 *   - First element: object with inference results:
 *     - bbox_results: Array<Object> - Filtered detection results after NMS, each containing:
 *       - bbox: [x, y, width, height] in original image coordinates
 *       - class_idx: Predicted class index
 *       - score: Confidence score (0-1)
 *       - keypoints?:  For pose tasks: [{x, y, score}] for each keypoint
 *       - mask_weights?: For segmentation tasks: mask coefficients
 *     - mask_imgData?: For segmentation tasks: RGBA overlay image with colored masks
 *   - Second element: Inference time in milliseconds (formatted to 2 decimal places)
 *
 */
export async function inferencePipeline(imageInput, session, modelConfig) {
  try {
    // Pre-process img, inference
    const [inputTensor, xRatio, yRatio] = preProcessImage(
      imageInput,
      modelConfig.overlaySize,
      modelConfig.imgszType
    )

    const start = performance.now()
    const {output0} = await session.run({
      images: inputTensor
    })
    const end = performance.now()
    inputTensor.dispose()

    // Post process
    const results = postProcess(
      output0,
      modelConfig.scoreThreshold,
      xRatio,
      yRatio
    )
    output0.dispose()

    // Apply NMS
    const selectedIndices = applyNMS(
      results,
      results.map((r) => r.score),
      modelConfig.iouThreshold
    )
    const filteredResults = selectedIndices.map((i) => results[i])

    return [filteredResults, (end - start).toFixed(2)]
  } catch (error) {
    console.error('Inference error:', error)

    return [[], '0.00']
  }
}

/**
 * Post process detection raw outputs.
 *
 * @param {ort.Tensor} rawTensor - Yolo model output0
 * @param {number} scoreThreshold - Score threshold
 * @param {number} xRatio - xRatio
 * @param {number} yRatio - yRatio
 * @returns {Array<Object>} Array of object detection results. Each item:
 * - bbox: [number, number, number, number]
 */
function postProcess(rawTensor, scoreThreshold = 0.45, xRatio, yRatio) {
  const NUM_PREDICTIONS = rawTensor.dims[2]
  const NUM_BBOX_ATTRS = 4
  const NUM_SCORES = 80

  const predictions = rawTensor.data
  const bboxData = predictions.subarray(0, NUM_PREDICTIONS * NUM_BBOX_ATTRS)
  const scoresData = predictions.subarray(NUM_PREDICTIONS * NUM_BBOX_ATTRS)

  const results = new Array()
  let resultCount = 0

  for (let i = 0; i < NUM_PREDICTIONS; i++) {
    let maxScore = 0
    let classIdx = -1

    for (let c = 0; c < NUM_SCORES; c++) {
      const score = scoresData[i + c * NUM_PREDICTIONS]

      if (score > maxScore) {
        maxScore = score
        classIdx = c
      }
    }

    if (maxScore <= scoreThreshold) continue

    const w = bboxData[i + NUM_PREDICTIONS * 2] * xRatio
    const h = bboxData[i + NUM_PREDICTIONS * 3] * yRatio
    const tlx = bboxData[i] * xRatio - 0.5 * w
    const tly = bboxData[i + NUM_PREDICTIONS] * yRatio - 0.5 * h

    results[resultCount++] = {
      bbox: [tlx, tly, w, h],
      classIdx,
      score: maxScore
    }
  }

  return results
}

function calculateIOU(box1, box2) {
  const [x1, y1, w1, h1] = box1
  const [x2, y2, w2, h2] = box2

  // check if boxes are valid
  if (x1 > x2 + w2 || x2 > x1 + w1 || y1 > y2 + h2 || y2 > y1 + h1) {
    return 0.0
  }

  const box1_x2 = x1 + w1
  const box1_y2 = y1 + h1
  const box2_x2 = x2 + w2
  const box2_y2 = y2 + h2

  const intersect_x1 = Math.max(x1, x2)
  const intersect_y1 = Math.max(y1, y2)
  const intersect_x2 = Math.min(box1_x2, box2_x2)
  const intersect_y2 = Math.min(box1_y2, box2_y2)

  const intersection =
    (intersect_x2 - intersect_x1) * (intersect_y2 - intersect_y1)
  const box1_area = w1 * h1
  const box2_area = w2 * h2

  return intersection / (box1_area + box2_area - intersection)
}

function applyNMS(boxes, scores, iouThreshold = 0.7) {
  const n = scores.length
  if (n === 0) return []

  // pre calculate areas
  const areas = new Array(n)

  for (let i = 0; i < n; i++) {
    const [, , w, h] = boxes[i].bbox
    areas[i] = w * h
  }

  // sort indexes by scores
  const indexes = new Uint32Array(n)
  for (let i = 0; i < n; i++) indexes[i] = i

  // sort indexes by scores in descending order
  indexes.sort((a, b) => scores[b] - scores[a])

  // use bitmap to track suppressed boxes
  const suppress = new Uint8Array(n)
  const picked = []

  for (let i = 0; i < n; i++) {
    const idx = indexes[i]

    if (suppress[idx]) continue

    picked.push(idx)

    // check remaining boxes
    for (let j = i + 1; j < n; j++) {
      const otherIdx = indexes[j]

      if (suppress[otherIdx]) continue

      const iou = calculateIOU(boxes[idx].bbox, boxes[otherIdx].bbox)

      if (iou > iouThreshold) {
        suppress[otherIdx] = 1
      }
    }
  }

  return picked
}
