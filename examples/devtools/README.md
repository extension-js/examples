[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# DevTools Panel Example

> Adds a devtools panel to the browser that reads the inspected page.

![screenshot](./screenshot.png)

**What you'll see**: A panel inside the browser DevTools, reading the inspected page.

**How it works**: The manifest registers a `devtools_page`, which has no UI of its own: its only job is to call `chrome.devtools.panels.create`. The panel it registers is a JavaScript page bundled from `src/panel/`.

A DevTools panel in two pages. The `devtools_page` is a registrar with no UI, and the panel it creates is where the UI lives. The panel reads the inspected page through `chrome.devtools.inspectedWindow.eval`, which works in every host, rather than through `chrome.devtools.network`, which an emulated or embedded host is unlikely to relay.

## Try it locally

```bash
npx extension@latest create my-devtools --template devtools
cd my-devtools
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── devtools/
│   ├── index.html
│   └── scripts.js
├── images/
│   ├── icon-128.png
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-64.png
│   └── icon.png
├── panel/
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
