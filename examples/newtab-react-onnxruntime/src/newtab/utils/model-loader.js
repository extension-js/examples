import './ort-env.js'
import {InferenceSession, Tensor} from 'onnxruntime-web/webgpu'

export async function modelLoader(modelPath, backend) {
  const DEFAULT_INPUT_SIZE = [1, 3, 640, 640]

  // load model (explicit fetch for clearer errors + CSP friendliness)
  const response = await fetch(modelPath)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch model (${response.status} ${response.statusText}). ` +
        `Make sure the .onnx file exists at ${modelPath}.`
    )
  }

  const modelBuffer = await response.arrayBuffer()
  const yolo_model = await InferenceSession.create(
    new Uint8Array(modelBuffer),
    {
      executionProviders: [backend]
    }
  )

  // warm up
  const dummy_input_tensor = new Tensor(
    'float32',
    new Float32Array(DEFAULT_INPUT_SIZE.reduce((a, b) => a * b)),
    DEFAULT_INPUT_SIZE
  )
  const {output0} = await yolo_model.run({images: dummy_input_tensor})
  output0.dispose()
  dummy_input_tensor.dispose()

  return yolo_model
}
