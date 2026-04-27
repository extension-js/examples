[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Starter Extension (init)

> A basic browser extension example built with Extension.js. A starting point for developers learning current browser extension tooling.

![screenshot](./public/screenshot.png)

**What you'll see**: A minimal extension wired with dev / build / preview scripts.

**How it works**: A JavaScript extension scaffold ready for `extension dev` / `extension build`.

The default starter — what `npx extension@latest create <name>` produces when no `--template` is passed. A small sidebar panel wired with dev / build / preview scripts.

## Try it locally

```bash
npx extension@latest create my-init --template init
cd my-init
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── images/
│   ├── icon.png
│   └── javascript.png
├── index.js
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
