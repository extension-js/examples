[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# React Sidebar (Transformers.js) Example

> Sidebar example that runs a small Transformers.js demo inside a side panel.

![screenshot](./public/screenshot.png)

**What you'll see**: A browser side panel that loads when you open the sidebar.

**How it works**: The manifest registers a side panel (`chromium:side_panel` / `firefox:sidebar_action`) that loads a JavaScript page bundled from `src/sidebar/`. UI is composed with Transformers.js.

Sidebar that runs [Transformers.js](https://huggingface.co/docs/transformers.js) models in the browser via WebGPU/WASM. No server, no API key — the model and tokenizer are loaded from the Hugging Face Hub on first run.

## Try it locally

```bash
npx extension@latest create my-sidebar-transformers-js --template sidebar-transformers-js
cd my-sidebar-transformers-js
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── images/
│   └── icon.png
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
