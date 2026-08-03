[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Special Folders (Pages) Example

> Opens a welcome page in a new tab when the extension loads.

![screenshot](./screenshot.png)

**What you'll see**: A welcome page that opens on install / startup, served from `pages/`.

**How it works**: Files inside `pages/` are treated as auto-discovered entrypoints , with no `manifest.json` wiring required. The background script opens one of them on install / startup.

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
