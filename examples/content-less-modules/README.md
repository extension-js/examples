[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Less Modules Content Example

What you’ll see: a small UI injected into any page, isolated in a Shadow DOM so site styles don’t interfere. Styled with Less and scoped via CSS Modules.

How it works: the content script mounts a UI inside a Shadow DOM and combines Less with CSS Modules to avoid style leaks and keep components modular.

## Installation

```bash
npx extension@latest create <project-name> --template content-less-modules
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

## Browser targets

Chromium is the default. You can explicitly target Chrome, Edge, or Firefox:

```bash
# Chromium (default)
npm run dev

# Chrome
npm run dev -- --browser=chrome

# Edge
npm run dev -- --browser=edge

# Firefox
npm run dev -- --browser=firefox
```

## Learn more

Learn more in the [Extension.js docs](https://extension.js.org).
