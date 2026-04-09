/** @type {import('extension').FileConfig} */
// Extension.js uses a fresh profile on every run.
// Prefer that default? Remove the profile config below.
const profile = (name) => `./dist/extension-profile-${name}`
const startingUrl = 'https://example.com'

export default {
  browser: {
    chrome: {profile: profile('chrome'), startingUrl},
    chromium: {profile: profile('chromium'), startingUrl},
    edge: {profile: profile('edge'), startingUrl},
    firefox: {profile: profile('firefox'), startingUrl},
    'chromium-based': {profile: profile('chromium-based'), startingUrl},
    'gecko-based': {profile: profile('gecko-based'), startingUrl}
  }
}
