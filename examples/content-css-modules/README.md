[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# CSS Modules Content

What you’ll see: a small badge injected into the page with styles that don’t leak into the site.

How it works here: the content script uses CSS Modules to scope styles, keeping the UI predictable and easy to maintain.

## Installation

```bash
npx extension@latest create <project-name> --template content-css-modules
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
