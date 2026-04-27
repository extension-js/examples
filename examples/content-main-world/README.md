[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Content Script in MAIN World Example

> Main world content script with multiple groups. ISOLATED entries precede the MAIN world entry so bridge injection exercises canonical-index vs array-position resolution.

![screenshot](./public/screenshot.png)

**What you'll see**: A small UI injected into any web page, isolated in a Shadow DOM so site styles don't bleed through.

**How it works**: A content script mounts a JavaScript UI inside a Shadow DOM and applies scoped styles so the host page can't bleed through.

Loads the content script in the page's **MAIN world** (Chromium-only). Useful when your script needs direct access to page-side globals or classes that the isolated world cannot reach. Firefox does not support MAIN-world content scripts, so this template is gated to Chromium targets.

## Try it locally

```bash
npx extension@latest create my-content-main-world --template content-main-world
cd my-content-main-world
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── content/
│   ├── utils/
│   │   ├── constants.js
│   │   └── create-badge.js
│   ├── isolated-one.js
│   ├── isolated-two.js
│   ├── scripts.js
│   └── styles.css
├── images/
│   └── icon.png
├── background.js
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
