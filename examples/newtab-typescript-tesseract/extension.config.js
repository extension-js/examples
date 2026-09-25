import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

/** @type {import('extension').FileConfig} */
// Extension.js uses a fresh profile on every run.
// Prefer that default? Remove the profile config below.
const profile = (name) => `./dist/extension-profile-${name}`

const require = createRequire(import.meta.url)
const tesseractDist = path.resolve(
  path.dirname(require.resolve('tesseract-wasm')),
  '..',
  'dist'
)
const here = path.dirname(fileURLToPath(import.meta.url))

// Ship the worker, both wasm builds, and the English model under stable
// names. tesseract-wasm looks those filenames up next to the worker, and
// the package does not export them for a normal import.
const bundledFiles = {
  'tesseract-worker.js': path.join(tesseractDist, 'tesseract-worker.js'),
  'tesseract-core.wasm': path.join(tesseractDist, 'tesseract-core.wasm'),
  'tesseract-core-fallback.wasm': path.join(
    tesseractDist,
    'tesseract-core-fallback.wasm'
  ),
  'tessdata/eng.traineddata': path.join(here, 'src/newtab/eng.traineddata')
}

export default {
  // The production build ships both tesseract-wasm cores (about 1.8 MiB
  // each) at the output root; the new tab picks one at runtime.
  perfBudgets: {
    runtime: 4 * 1024 * 1024
  },
  config(config) {
    config.module ??= {}
    config.module.rules ??= []
    // `new URL("./tesseract-worker.js" | "tesseract-core.wasm", import.meta.url)`
    // inside the library must emit the stable names the worker fetches.
    config.module.rules.unshift(
      {
        test: /tesseract-worker\.js$/,
        type: 'asset/resource',
        generator: {
          filename: 'tesseract-worker.js'
        }
      },
      {
        test: /tesseract-core(?:-fallback)?\.wasm$/,
        type: 'asset/resource',
        generator: {
          filename: '[name][ext]'
        }
      }
    )

    config.plugins ??= []
    config.plugins.push({
      apply(compiler) {
        compiler.hooks.thisCompilation.tap(
          'tesseract-assets',
          (compilation) => {
            compilation.hooks.processAssets.tap(
              {
                name: 'tesseract-assets',
                stage:
                  compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
              },
              () => {
                const {RawSource} = compiler.webpack.sources

                for (const [name, file] of Object.entries(bundledFiles)) {
                  if (compilation.getAsset(name)) continue

                  compilation.emitAsset(
                    name,
                    new RawSource(fs.readFileSync(file))
                  )
                }
              }
            )
          }
        )
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
