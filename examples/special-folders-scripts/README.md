[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Special Folders Scripts Example

What you’ll see: background code that imports and runs scripts from `src/scripts/`.

How it works: files in `src/scripts/` are regular entry files that you import from the background to execute standalone logic.

## How scripts/ works

- Any JS-like file placed under `src/scripts/` is considered an entrypoint by Extension.js.
- The example’s background imports three files from `src/scripts/`:
  - `src/scripts/script-one.js`
  - `src/scripts/script-two.js`
  - `src/scripts/script-three.js`
- Importing them in `src/background.js` ensures they are executed when the background starts.
- Treat files inside `scripts/` just like any file referenced in `manifest.json`—they are compiled and available to be imported.

## Installation

```bash
npx extension@latest create <project-name> --template special-folders-scripts
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
