[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

[![Powered by Extension.js][powered-image]][powered-url]

# JavaScript New Tab Example

> New tab page example styled with Sass. Renders a simple page and organizes styles with Sass.

![screenshot](./public/screenshot.png)

**What you'll see**: A custom new-tab page replacing the browser default.

**How it works**: The manifest overrides the new-tab page and loads a JavaScript entry bundled from `src/newtab/`. Styles flow through Sass.

## Try it locally

```bash
npx extension@latest create my-new-sass --template new-sass
cd my-new-sass
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── images/
│   └── icon.png
├── newtab/
│   ├── index.html
│   ├── scripts.js
│   └── styles.scss
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
