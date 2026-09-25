/** @type {import('extension').FileConfig} */
// Extension.js uses a fresh profile on every run.
// Prefer that default? Remove the profile config below.
const profile = (name) => `./dist/extension-profile-${name}`

export default {
  // The production build ships the ImageMagick WebAssembly runtime (about
  // 14 MiB) at the output root; the new tab reads its bytes from there.
  perfBudgets: {
    runtime: 16 * 1024 * 1024
  },
  // @imagemagick/magick-wasm exports magick.wasm, but initializeImageMagick()
  // only accepts an http(s) URL or raw bytes. Emit the binary as a static
  // asset so the page can read those bytes from inside the extension.
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
