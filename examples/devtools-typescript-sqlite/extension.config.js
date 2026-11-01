import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'

/** @type {import('extension').FileConfig} */
// Extension.js uses a fresh profile on every run.
// Prefer that default? Remove the profile config below.
const profile = (name) => `./dist/extension-profile-${name}`

const require = createRequire(import.meta.url)
const wasmFile = path.join(
  path.dirname(require.resolve('sql.js/dist/sql-wasm-browser.js')),
  'sql-wasm-browser.wasm'
)

export default {
  // sql.js fetches sql-wasm-browser.wasm at runtime. Ship that file at the
  // package root under a stable name. It is an Emscripten binary, not a
  // native wasm module, so the bundler must not instantiate it.
  config(config) {
    config.module ??= {}
    config.module.rules ??= []
    config.module.rules.unshift({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'wasm/[name][ext]'
      }
    })

    config.plugins ??= []
    config.plugins.push({
      apply(compiler) {
        compiler.hooks.thisCompilation.tap('sqljs-wasm', (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: 'sqljs-wasm',
              stage:
                compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
            },
            () => {
              if (compilation.getAsset('sql-wasm-browser.wasm')) return

              const {RawSource} = compiler.webpack.sources

              compilation.emitAsset(
                'sql-wasm-browser.wasm',
                new RawSource(fs.readFileSync(wasmFile))
              )
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
