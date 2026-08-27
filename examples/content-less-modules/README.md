[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# JavaScript Content Script Example

> Injects a small styled badge into every web page you visit, with a Less modules options page that moves it to the left or right edge.

![screenshot](./screenshot.png)

**What you'll see**: A small UI injected into any web page, isolated in a Shadow DOM so site styles don't bleed through, carrying an **Open options** button. The options page has one checkbox, and ticking it sends the badge to the left edge of the page straight away.

**How it works**: A content script mounts a JavaScript UI inside a Shadow DOM and applies scoped styles so the host page can't bleed through. Styles flow through Less + CSS Modules.

Less-flavored CSS Modules. Combines `.module.less` files with class-name hashing for fully isolated styles.

The manifest also registers an `options_ui` page bundled from `src/options/`, and that page runs through the same pipeline: `src/options/styles.module.less` is imported from `src/options/scripts.js`, which applies the hashed class names to the page. Nothing in `src/options/index.html` carries a class name of its own, which is what CSS Modules buys you.

The page reads the setting with `chrome.storage.sync.get` on load and writes it with `chrome.storage.sync.set` on change. The content script reads the same key and subscribes to `chrome.storage.onChanged`, so the badge slides to the other edge live rather than waiting for the next page load. It removes that listener in the cleanup function Extension.js calls on teardown.

The move itself is a Less class. `.content_script_left` clears the `right` anchor and sets `left`, and the content script toggles the **imported** name on the badge inside the shadow root. Two details matter here. The build hashes every class in the module, so a literal `'content_script_left'` would match nothing, and the shadow host is hardened with `all: initial !important`, so it is the wrong element to write positions to.

A content script cannot open the options page itself, because `openOptionsPage` lives on the extension side. So the badge's button posts a message and the background worker opens the page. That relay is the part worth copying.

## Try it locally

```bash
npx extension@latest create my-content-less-modules --template content-less-modules
cd my-content-less-modules
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── content/
│   ├── scripts.js
│   └── styles.module.less
├── images/
│   └── icon.png
├── options/
│   ├── index.html
│   ├── scripts.js
│   └── styles.module.less
├── background.js
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
