/**
 * @type {import('extension').FileConfig}
 *
 * All browsers in this example use the same configuration as Chrome,
 * with differences only in branding, profiles, or URL schemes where required.
 */
// Extension.js uses a fresh profile on every run.
// Prefer that default? Remove the profile config below.
const profile = (name) => `./dist/extension-profile-${name}`

const config = {
  browser: {
    chromium: {
      // Disable default browser flags made by Extension.js
      excludeBrowserFlags: [],
      // Use a stable dev profile (resolved relative to project dir)
      profile: profile('chromium'),
      // Kiosk mode so only the New Tab page is visible.
      browserFlags: ['--kiosk'],
      // Launch the overridden New Tab so your extension page shows immediately.
      startingUrl: 'chrome://newtab'
    },
    chrome: {
      // Disable default browser flags made by Extension.js
      excludeBrowserFlags: [],
      // Use a stable dev profile (resolved relative to project dir)
      profile: profile('chrome'),
      // Kiosk mode so only the New Tab page is visible.
      browserFlags: ['--kiosk'],
      // Launch the overridden New Tab so your extension page shows immediately.
      startingUrl: 'chrome://newtab'
    },
    edge: {
      // Edge follows Chrome config; only brand/profile differs.
      excludeBrowserFlags: [],
      profile: profile('edge'),
      // Kiosk mode so only the New Tab page is visible.
      browserFlags: ['--kiosk'],
      // Launch the overridden New Tab so your extension page shows immediately.
      startingUrl: 'chrome://newtab'
    },
    firefox: {
      // Firefox follows Chrome config; only brand/profile/URL differ.
      excludeBrowserFlags: [],
      profile: profile('firefox'),
      // Kiosk mode so only the New Tab page is visible.
      browserFlags: ['--kiosk'],
      // Launch the overridden New Tab so your extension page shows immediately.
      startingUrl: 'about:newtab'
    },
    'chromium-based': {profile: profile('chromium-based')},
    'gecko-based': {profile: profile('gecko-based')}
  }
}

export default config
