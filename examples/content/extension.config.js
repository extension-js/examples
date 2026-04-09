/** @type {import('extension').FileConfig} */
// Extension.js uses a fresh profile on every run.
// Prefer that default? Remove the profile config below.
const profile = (name) => `./dist/extension-profile-${name}`
const startingUrl = 'https://example.com'
const ciFlags = process.env.CI ? ['--no-sandbox', '--disable-gpu'] : []

export default {
  browser: {
    chrome: {profile: profile('chrome'), startingUrl, browserFlags: ciFlags},
    chromium: {
      profile: profile('chromium'),
      startingUrl,
      browserFlags: ciFlags
    },
    edge: {profile: profile('edge'), startingUrl, browserFlags: ciFlags},
    firefox: {profile: profile('firefox'), startingUrl},
    'chromium-based': {
      profile: profile('chromium-based'),
      startingUrl,
      browserFlags: ciFlags
    },
    'gecko-based': {profile: profile('gecko-based'), startingUrl}
  }
}
