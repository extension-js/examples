[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# JavaScript Main World Content Example

What you'll see: a small badge injected into web pages from a MAIN world content script.

How it works: the extension injects UI in the page MAIN world, mounts into a Shadow DOM, and keeps styles isolated from host page CSS.

## Installation

```bash
pnpm install
```

## Commands

Run from the monorepo root:

```bash
# Development
pnpm extension dev "./extensions/staging/content-main-world"

# Production build
pnpm extension build "./extensions/staging/content-main-world"
```

## Browser targets

Chromium is the default. You can target specific browsers:

```bash
pnpm extension dev "./extensions/staging/content-main-world" --browser=chrome
pnpm extension dev "./extensions/staging/content-main-world" --browser=edge
pnpm extension dev "./extensions/staging/content-main-world" --browser=firefox
```

## WASM bundle

- This example does not use WebAssembly.

## Learn more

Learn more in the [Extension.js docs](https://extension.js.org).
