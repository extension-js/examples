[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

[![Powered by Extension.js][powered-image]][powered-url]

# Special Folders (Scripts) Example

> Demonstrates scripts/ folder organization and how to run standalone scripts via the extension.

![screenshot](./public/screenshot.png)

**What you'll see**: Standalone scripts auto-bundled from `scripts/`, runnable via the action popup.

**How it works**: Files inside `scripts/` are bundled as standalone script entries, ready to be referenced from `manifest.json` or executed at runtime via `chrome.scripting.*`.

Demonstrates the **`scripts/`** convention: standalone scripts inside the project-root `scripts/` directory are bundled as separate entries, ready to be referenced from `manifest.json` (e.g. as `chrome_settings_overrides`) or executed at runtime via `chrome.scripting.*`.

## Try it locally

```bash
npx extension@latest create my-special-folders-scripts --template special-folders-scripts
cd my-special-folders-scripts
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
.
├── src/
│   ├── images/
│   │   ├── icon.png
│   │   └── javascript.png
│   ├── background.js
│   └── manifest.json
└── scripts/
    ├── script-one.js
    ├── script-three.js
    └── script-two.js
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
