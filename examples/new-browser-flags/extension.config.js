/**
 * @type {import('extension').FileConfig}
 *
 * All browsers in this example use the same configuration as Chrome,
 * with differences only in branding, profiles, or URL schemes where required.
 */
const config = {
  browser: {
    chromium: {
      // Disable default browser flags made by Extension.js
      excludeBrowserFlags: [],
      // Use a stable dev profile (resolved relative to project dir)
      profile: './dist/dedicated-profile-chromium',
      // App-like flags
      browserFlags: ['--kiosk'],
      // Open a specific URL when launching
      // Launch the overridden New Tab so your extension page shows immediately.
      startingUrl: 'https://extension.js.org'
    },
    chrome: {
      // Disable default browser flags made by Extension.js
      excludeBrowserFlags: [],
      // Use a stable dev profile (resolved relative to project dir)
      profile: './dist/dedicated-profile-chrome',
      // App-like flags
      browserFlags: ['--kiosk'],
      // Open a specific URL when launching
      // Launch the overridden New Tab so your extension page shows immediately.
      startingUrl: 'https://extension.js.org'
    },
    edge: {
      // Edge follows Chrome config; only brand/profile differs.
      excludeBrowserFlags: [],
      profile: './dist/dedicated-profile-edge',
      browserFlags: ['--kiosk'],
      startingUrl: 'https://extension.js.org'
    },
    firefox: {
      // Firefox follows Chrome config; only brand/profile/URL differ.
      excludeBrowserFlags: [],
      profile: './dist/dedicated-profile-firefox',
      browserFlags: ['--kiosk'],
      startingUrl: 'https://extension.js.org'
    }
  }
}

export default config
