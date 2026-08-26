[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# JavaScript Options Page Example

> Adds an options page that saves a single setting with chrome.storage.sync.

![screenshot](./screenshot.png)

**What you'll see**: An options page with one checkbox. Toggle it, close the page, open it again, and the value is still there.

**How it works**: The manifest registers an `options_ui` page bundled from `src/options/`. The page reads the setting with `chrome.storage.sync.get` on load, writes it with `chrome.storage.sync.set` on change, and prints the saved state on screen. There is no background service worker, the page owns its own state.

The manifest asks for the `storage` permission and nothing else, no host permissions. That is the whole point of this template: request the least your feature needs.

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
