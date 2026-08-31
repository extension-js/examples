[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# JavaScript Options Page Example

> Adds an options page to the browser that saves a setting with chrome.storage.

**What you'll see**: An **Options** entry on this extension in your browser's extensions page. Opening it shows one setting, and the setting survives a browser restart.

**How it works**: The manifest points `options_ui.page` at `src/options/index.html`, and that one key is what puts the Options entry on the extensions page. `open_in_tab` is set, so the page opens as a normal tab rather than the cramped embedded dialog; drop that key if you prefer the dialog.

The page reads and writes one boolean through `chrome.storage.sync`, which is why the manifest declares the `storage` permission and why the setting follows the signed-in profile between machines. Use `chrome.storage.local` instead when a setting belongs to one machine. Reading happens once on load with a default, so the first visit renders a real state rather than an empty control, and writing happens on `change`, so there is no Save button to forget to press.

The script guards on `chrome?.storage?.sync` before touching it. That namespace only exists when the page runs as part of an installed extension; opened as an ordinary file it disables the control and says so instead of throwing.

## Try it locally

```bash
npx extension@latest create my-options --template options
cd my-options
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded. Open your browser's extensions page and pick **Options** on this extension.

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
