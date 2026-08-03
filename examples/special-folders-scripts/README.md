[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Special Folders (Scripts) Example

> Shows a small overlay on web pages and a toolbar popup that runs the extension's bundled scripts.

![screenshot](./screenshot.png)

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
│   ├── content/
│   │   ├── scripts.js
│   │   └── styles.css
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
