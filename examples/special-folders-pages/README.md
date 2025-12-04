[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Special Folders Pages Example

What you’ll see: a welcome page from `pages/welcome.html` that opens when the extension loads.

How it works: files in `pages/` are treated as entrypoints. The background opens the welcome page on install/startup.

Note: files inside `pages/` are entrypoints. They work just like any HTML you declare in `manifest.json`.

## Installation

```bash
npx extension@latest create <project-name> --template special-folders-pages
cd <project-name>
npm install
```

## Commands

### dev

Run the extension in development mode.

```bash
npm run dev
```

### build

Build the extension for production.

```bash
npm run build
```

### preview

Preview the extension in the browser.

```bash
npm run preview
```

## Browser targets

Chromium is the default. You can explicitly target Chrome, Edge, or Firefox:

```bash
# Chromium (default)
npm run dev

# Chrome
npm run dev -- --browser=chrome

# Edge
npm run dev -- --browser=edge

# Firefox
npm run dev -- --browser=firefox
```

## Learn more

Learn more in the [Extension.js docs](https://extension.js.org).
