/** @type {import('extension').FileConfig} */
// Extension.js uses a fresh profile on every run.
// Prefer that default? Remove the profile config below.
const profile = (name) => `./dist/extension-profile-${name}`

export default {
  // Emscripten's zstd.wasm is a fetched binary, not a native wasm module.
  // Ship it as a static asset so `init()` can load the copy inside the package.
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
