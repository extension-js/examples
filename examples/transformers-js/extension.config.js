/** @type {import('extension').FileConfig} */
// Extension.js uses a fresh profile on every run.
// Prefer that default? Remove the profile config below.
const profile = (name) => `./dist/extension-profile-${name}`

export default {
  // The production build ships the onnxruntime WebAssembly core (about 21 MiB)
  // at the output root and bundles the Transformers.js pipeline into background.
  perfBudgets: {
    runtime: 32 * 1024 * 1024,
    'service-worker': 1024 * 1024
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
