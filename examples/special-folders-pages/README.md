[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Welcome page (special folders)

> A welcome page in `pages/` that opens when the extension loads.

Opens `pages/welcome.html` automatically on install/startup. Uses an opinionated folder structure for extension pages and shows how the tooling resolves them.

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

## Learn more

Learn more about creating cross-browser extensions at https://extension.js.org
