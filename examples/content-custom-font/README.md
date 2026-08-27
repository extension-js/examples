[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Custom Fonts Content Script Example

> Injects a badge rendered in a custom font into every web page you visit, with an options page that turns the custom font on and off.

![screenshot](./screenshot.png)

**What you'll see**: A small UI injected into any web page, isolated in a Shadow DOM so site styles don't bleed through, carrying an Open options button. The options page has one checkbox, and unticking it drops the badge back to the plain system font straight away.

**How it works**: A content script mounts a JavaScript UI inside a Shadow DOM and applies scoped styles so the host page can't bleed through. Styles flow through Tailwind.

Loads custom web fonts inside the injected Shadow DOM via `web_accessible_resources`, so the UI ships its own typography without depending on the host page's stylesheet.

The manifest also registers an `options_ui` page bundled from `src/options/`. The setting here is the typeface itself, because the typeface is what this template is for. The options page reads `useCustomFont` with `chrome.storage.sync.get` on load and writes it with `chrome.storage.sync.set` on change. The content script reads the same key and subscribes to `chrome.storage.onChanged`, so the badge swaps between the custom face and the system stack live rather than waiting for the next page load. It removes that listener in the cleanup function Extension.js calls on teardown.

A content script cannot open the options page itself, because `openOptionsPage` lives on the extension side. So the badge's button posts a message and the background worker opens the page. That relay is the part worth copying.

## How the font reaches the injected UI

The font ships in `public/fonts/`, so it lands at the extension root and `web_accessible_resources` makes it fetchable from any page. Momo Signature publishes one weight, 400, so there is a single `@font-face` block and the browser synthesises bold from it.

Getting that face into a Shadow DOM takes one extra step, and it is the part of this template worth copying. **Chrome does not apply an `@font-face` rule declared inside a shadow root**, and the root-absolute `url(/fonts/...)` in the injected stylesheet would resolve against the host page rather than the extension anyway. So the content script registers the face on the page's own font set with the `FontFace` API, pointing at `chrome.runtime.getURL('fonts/MomoSignature-Regular.woff2')`. The shadow tree can use it from there, and the cleanup function removes it again with `document.fonts.delete`.

The `@font-face` block in `src/content/styles.css` is kept for readability and for the options page, which is an ordinary document where it works as written. Without the `FontFace` registration the badge would silently fall back to the generic `cursive` face, and every style assertion would still pass, which is why the spec measures the rendered text rather than a class name.

## Try it locally

```bash
npx extension@latest create my-content-custom-font --template content-custom-font
cd my-content-custom-font
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── content/
│   ├── scripts.js
│   └── styles.css
├── images/
│   └── icon.png
├── options/
│   ├── index.html
│   ├── scripts.js
│   └── styles.css
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
