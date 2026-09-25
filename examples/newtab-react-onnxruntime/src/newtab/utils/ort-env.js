import {env} from 'onnxruntime-web/webgpu'

// Dedicated workers spawned by an extension page cannot see `chrome.*`.
// The page and those workers are still served from the extension origin,
// which is where the build copies the wasm runtime, the model, and the sample.
const bundled = (path) => new URL(path, self.location.origin).href

env.wasm.wasmPaths = bundled('ort/')
env.wasm.numThreads = 1
env.wasm.proxy = false

export function bundledModelUrl(model, task) {
  return bundled(`models/${model}-${task}.onnx`)
}

export const SAMPLE_IMAGE_URL = bundled('samples/bus.jpg')
