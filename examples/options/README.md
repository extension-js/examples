[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# JavaScript Options Page Example

> Adds an options page a content script can open, sharing one saved setting.

![screenshot](./screenshot.png)

**What you'll see**: A badge on every page you visit, carrying an Open options button. The options page has one checkbox, and unticking it hides the badge straight away.

**How it works**: Three surfaces share one setting. The manifest registers an `options_ui` page bundled from `src/options/`, a content script that injects the badge, and a background service worker.

The options page reads the setting with `chrome.storage.sync.get` on load and writes it with `chrome.storage.sync.set` on change. The content script reads the same key and subscribes to `chrome.storage.onChanged`, so the badge follows the setting live rather than waiting for the next page load. It removes that listener in the cleanup function Extension.js calls on teardown.

A content script cannot open the options page itself, because `openOptionsPage` lives on the extension side. So the badge's button posts a message and the background worker opens the page. That relay is the part worth copying.

The manifest asks for the `storage` permission and nothing else, no host permissions. Request the least your feature needs.

## Try it locally

```bash
npx extension@latest create my-options --template options
cd my-options
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── background.js
├── content/
│   ├── scripts.js
│   └── styles.css
├── images/
│   └── icon.png
├── options/
│   ├── index.html
│   ├── scripts.js
│   └── styles.css
└── manifest.json
```

## Commands

Cloned this repo instead? The examples ship without npm scripts, so run Extension.js directly from the example directory. Run `npm install` first when the example declares dependencies.

### dev

Run the extension in development mode. Target a browser with `--browser`:

```bash
npx extension@latest dev .                  # Chromium (default)
npx extension@latest dev . --browser=chrome
npx extension@latest dev . --browser=edge
npx extension@latest dev . --browser=firefox
```

### build

Build for production:

```bash
npx extension@latest build .                # Chromium (default)
npx extension@latest build . --browser=firefox
npx extension@latest build . --browser=edge
```

### preview

Preview the production build with the bundled browser:

```bash
npx extension@latest preview .
```

## Tests

This template ships an end-to-end check (`template.spec.ts`) validated by the examples-repo CI on every commit.

## Learn more

- [Extension.js docs](https://extension.js.org)
- [Templates index](https://extension.js.org/docs/getting-started/templates)
- [GitHub: extension-js/extension.js](https://github.com/extension-js/extension.js)
