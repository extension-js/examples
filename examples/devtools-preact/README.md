[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Preact DevTools Panel Example

> Adds a devtools panel written in Preact that reads the inspected page.

![screenshot](./screenshot.png)

**What you'll see**: A panel inside the browser DevTools, reading the inspected page.

**How it works**: The manifest registers a `devtools_page`, which has no UI of its own: its only job is to call `chrome.devtools.panels.create`. The panel it registers is a Preact + TypeScript page bundled from `src/panel/`.

## Try it locally

```bash
npx extension@latest create my-devtools-preact --template devtools-preact
cd my-devtools-preact
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── devtools/
│   ├── index.html
│   └── scripts.ts
├── images/
│   ├── icon-128.png
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-64.png
│   ├── icon.png
│   └── preact.png
├── panel/
│   ├── index.html
│   ├── PanelApp.tsx
│   ├── scripts.tsx
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
