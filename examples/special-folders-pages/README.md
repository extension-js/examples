[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

[![Powered by Extension.js][powered-image]][powered-url]

# Special Folders (Pages) Example

> Opens a welcome page on extension load, showcasing the pages/ folder.

![screenshot](./public/screenshot.png)

**What you'll see**: A welcome page that opens on install / startup, served from `pages/`.

**How it works**: Files inside `pages/` are treated as auto-discovered entrypoints — no `manifest.json` wiring required. The background script opens one of them on install / startup.

Demonstrates Extension.js's **`pages/`** convention: every HTML file inside the project-root `pages/` directory becomes an entrypoint without manifest wiring. The background script opens `pages/welcome.html` on install / startup.

## Try it locally

```bash
npx extension@latest create my-special-folders-pages --template special-folders-pages
cd my-special-folders-pages
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
│   ├── sandbox/
│   │   ├── index.html
│   │   ├── scripts.js
│   │   └── styles.css
│   ├── background.js
│   └── manifest.json
└── pages/
    ├── custom.html
    ├── main.html
    ├── main.js
    └── welcome.html
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
