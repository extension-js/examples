[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Custom Fonts Content

What you’ll see: a small UI injected into the page that uses custom web fonts.

How it works here: the content script loads font files and exposes them via `web_accessible_resources`, then applies them in CSS.

## Installation

```bash
npx extension@latest create <project-name> --template content-custom-font
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
