[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

[![Powered by Extension.js][powered-image]][powered-url]

# Transformers.js Example

> Transformers.js demo with a sidebar and a content script: classify the active page or your selection on-device via WebGPU/WASM.

![screenshot](./public/screenshot.png)

**What you'll see**: A side panel where you can type text, pull the active page's text, or use your current selection — and run a Transformers.js pipeline on it. A right-click context menu also exposes "Classify selection with Transformers.js".

**How it works**: The manifest registers a side panel (`chromium:side_panel` / `firefox:sidebar_action`) and a content script that listens for `getPageContext` / `getSelection` messages. The background service worker relays those requests to the active tab and runs the pipeline; results stream back to the sidebar.

Runs [Transformers.js](https://huggingface.co/docs/transformers.js) models in the browser via WebGPU/WASM. No server, no API key — the model and tokenizer are loaded from the Hugging Face Hub on first run.

## Try it locally

```bash
npx extension@latest create my-transformers-js --template transformers-js
cd my-transformers-js
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── images/
│   └── icon.png
├── content/
│   └── scripts.js
├── sidebar/
│   ├── index.html
│   ├── sakura.css
│   ├── scripts.js
│   ├── SidebarApp.js
│   └── styles.css
├── background.js
├── constants.js
└── manifest.json
```

## Commands

### dev

Run the extension in development mode. Target a browser with `--browser`:

```bash
npm run dev                 # Chromium (default)
npm run dev -- --browser=chrome
npm run dev -- --browser=edge
npm run dev -- --browser=firefox
```

### build

Build for production. Convenience scripts cover each browser:

```bash
npm run build           # Chrome (default)
npm run build:firefox
npm run build:edge
```

### preview

Preview the production build with the bundled browser:

```bash
npm run preview
```

## Tests

This template ships an end-to-end check (`template.spec.ts`) validated by the examples-repo CI on every commit.

## Learn more

- [Extension.js docs](https://extension.js.org)
- [Templates index](https://extension.js.org/docs/getting-started/templates)
- [GitHub: extension-js/extension.js](https://github.com/extension-js/extension.js)
