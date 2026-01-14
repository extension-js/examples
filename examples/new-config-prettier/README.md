[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Prettier Config New Tab Example

What you’ll see: a custom new tab page with Prettier formatting configured out of the box.
How it works: the extension overrides the new tab and the project includes a Prettier configuration and scripts for consistent formatting.

Prettier setup for consistent formatting and frictionless collaboration.

## Installation

```bash
npx extension@latest create <project-name> --template new-config-prettier
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
