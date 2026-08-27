[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Vue Content Script Example

> Shows a small overlay UI on every web page, with a Vue options page that moves it from right to left.

![screenshot](./screenshot.png)

**What you'll see**: A small Vue UI injected into any web page, isolated in a Shadow DOM so site styles don't bleed through. The overlay has an **Open options** button, and the options page behind it has one checkbox that moves the overlay between the right and left edge of the page, live.

**How it works**: A content script mounts a Vue + TypeScript UI inside a Shadow DOM and applies scoped styles so the host page can't bleed through. Styles flow through Tailwind.

The manifest registers an `options_ui` page bundled from `src/options/`, a second Vue app that reads and writes one setting, `badgePosition`, with `chrome.storage.sync`. The value is `right` by default and `left` when the box is ticked. The content script reads the same key on load and subscribes to `chrome.storage.onChanged`, so ticking the checkbox slides the overlay to the other edge without reloading the page. A content script cannot open the options page itself, so the button sends a message to the background script, which calls `chrome.runtime.openOptionsPage`.

The manifest asks for the `storage` permission and nothing else beyond the content script match.

## Try it locally

```bash
npx extension@latest create my-content-vue --template content-vue
cd my-content-vue
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── content/
│   ├── ContentApp.vue
│   ├── scripts.ts
│   ├── shims-vue.d.ts
│   └── styles.css
├── images/
│   ├── chromeWindow.png
│   ├── icon.png
│   ├── logo.svg
│   ├── tailwind_bg.png
│   ├── tailwind.png
│   ├── typescript.png
│   └── vue.png
├── options/
│   ├── OptionsApp.vue
│   ├── index.html
│   ├── scripts.ts
│   └── styles.css
├── background.ts
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
