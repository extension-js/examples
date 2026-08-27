[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# React Content Script Example

> Shows a small overlay UI on every web page, with a React options page that moves it from right to left.

![screenshot](./screenshot.png)

**What you'll see**: A small React UI injected into any web page, isolated in a Shadow DOM so site styles don't bleed through. The overlay carries an **Open options** button, and the options page behind it has one checkbox that moves the overlay between the right and left edge of the page, live.

**How it works**: A content script mounts a React + TypeScript UI inside a Shadow DOM and applies scoped styles so the host page can't bleed through. Styles flow through Tailwind.

The options page is the same stack, a React component mounted into an `options_ui` page bundled from `src/options/`. It reads the `badgePosition` setting with `chrome.storage.sync.get` on load and writes it with `chrome.storage.sync.set` on change. The value is `right` by default and `left` when the box is ticked. The content script reads that same key on injection and subscribes to `chrome.storage.onChanged`, so ticking the checkbox slides the overlay to the other edge without a page reload. The subscription is removed in the cleanup function Extension.js calls on teardown.

A content script cannot open the options page itself, `chrome.runtime.openOptionsPage` lives on the extension side. The **Open options** button sends `{type: 'open-options'}` to the background script, which makes the call. The manifest asks for the `storage` permission for the setting and nothing else.

## Try it locally

```bash
npx extension@latest create my-content-react --template content-react
cd my-content-react
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── content/
│   ├── ContentApp.tsx
│   ├── scripts.tsx
│   └── styles.css
├── images/
│   ├── chromeWindow.png
│   ├── icon.png
│   ├── react.png
│   ├── tailwind_bg.png
│   ├── tailwind.png
│   └── typescript.png
├── options/
│   ├── OptionsApp.tsx
│   ├── index.html
│   ├── scripts.tsx
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
