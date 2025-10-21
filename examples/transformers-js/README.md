[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

[![Powered by Extension.js][powered-image]][powered-url]

# Transformers.js Sidebar

> Sidebar-only browser extension powered by 🤗 Transformers.js and Extension.js. The side panel UI sends text to the background service worker, which runs on-device inference and returns results.

## What this example shows

- A cross-browser sidebar panel (Chromium side panel / Firefox sidebar)
- Message-based inference with `@huggingface/transformers` in the background
- Simple model configuration persisted via `chrome.storage.sync`

## Commands

Run these from this folder.

### Dev

Start a development server and open the extension for live-reload development.

```bash
npx extension@latest dev
```

### Build

Create a production build.

```bash
npx extension@latest build
```

### Preview

Preview the built extension in a browser.

```bash
npx extension@latest preview
```

## Anatomy

- `background.js`: loads/caches the Transformers pipeline and responds to messages
- `sidebar/`: UI for the side panel (`index.html`, `scripts.js`, `SidebarApp.js`, `styles.css`)
- `constants.js`: shared message/action constants
- `manifest.json`: declares the side panel and minimal permissions

There are no content scripts or popup in this example; Extension.js handles bundling and serving.

## Permissions

Minimal, sidebar-focused permissions:

- `sidePanel` (Chromium)
- `storage`
- `unlimitedStorage`

## Notes

- Models are loaded from the Hugging Face Hub by default (`env.allowLocalModels = false`). You can change this in `background.js`.
- The sidebar UI allows selecting a curated model or entering a custom model ID.
