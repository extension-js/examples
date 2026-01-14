[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# JavaScript Content (Multiple Scripts, Single Entry) Example

What you’ll see: four small boxes injected into the page corners, each isolated in a Shadow DOM to avoid style conflicts. Demonstrates multiple content scripts in one entry.

How it works: a single `content_scripts` entry lists four JS files. Each script mounts a simple UI in a different corner.

## Installation

```bash
npx extension@latest create <project-name> --template content-multi-one-entry
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
