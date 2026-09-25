import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

/** @type {import('extension').FileConfig} */
// Extension.js uses a fresh profile on every run.
// Prefer that default? Remove the profile config below.
const profile = (name) => `./dist/extension-profile-${name}`

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
// `onnxruntime-web` resolves to a file inside its dist folder.
const ortDist = path.dirname(require.resolve('onnxruntime-web'))

// The webgpu entry dynamically imports this pair. Ship only that pair:
// the package also contains threaded, jsep, and jspi builds we do not load.
const ortFiles = [
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs'
]

const bundledFiles = {
  'models/yolo11n-detect.onnx': path.join(
    here,
    'src/newtab/models/yolo11n-detect.onnx'
  ),
  'models/LICENSE.txt': path.join(here, 'src/newtab/models/LICENSE.txt'),
  'samples/bus.jpg': path.join(here, 'fixtures/bus.jpg')
}

for (const name of ortFiles) {
  bundledFiles[`ort/${name}`] = path.join(ortDist, name)
}

export default {
  // The production build ships the onnxruntime WebAssembly core (about
  // 26 MiB) and the YOLO11n model at the output root; the new tab loads
  // both from inside the extension.
  perfBudgets: {
    runtime: 32 * 1024 * 1024
  },
  config(config) {
    config.module ??= {}
    config.module.rules ??= []
    // `new URL("ort-wasm-simd-threaded.asyncify.wasm", import.meta.url)`
    // inside onnxruntime-web must emit a static file, not a wasm module.
    config.module.rules.unshift({
      test: /ort-wasm-simd-threaded\.asyncify\.(wasm|mjs)$/,
      type: 'asset/resource',
      generator: {
        filename: 'ort/[name][ext]'
      }
    })

    config.plugins ??= []
    config.plugins.push({
      apply(compiler) {
        compiler.hooks.thisCompilation.tap('yolo-assets', (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: 'yolo-assets',
              stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
            },
            () => {
              const {RawSource} = compiler.webpack.sources

              for (const [name, file] of Object.entries(bundledFiles)) {
                if (compilation.getAsset(name)) continue

                compilation.emitAsset(name, new RawSource(fs.readFileSync(file)))
              }
            }
          )
        })
      }
    })

    return config
  },
  browser: {
    chrome: {profile: profile('chrome')},
    chromium: {profile: profile('chromium')},
    edge: {profile: profile('edge')},
    firefox: {profile: profile('firefox')},
    'chromium-based': {profile: profile('chromium-based')},
    'gecko-based': {profile: profile('gecko-based')}
  }
}
