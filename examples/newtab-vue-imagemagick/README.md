[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

![Powered by Extension.js][powered-image]

# Vue New Tab Example

> Replaces your new tab page with a Vue page that blurs, rotates, and charcoals a picture using ImageMagick.

![screenshot](./screenshot.png)

**What you'll see**: A custom new-tab page replacing the browser default.

**How it works**: The manifest overrides the new-tab page and loads a Vue + TypeScript entry bundled from `src/newtab/`.

Blurs, rotates, and charcoals a picture with [@imagemagick/magick-wasm](https://www.npmjs.com/package/@imagemagick/magick-wasm) across in-page routes. The WebAssembly runtime and the Hack font are bundled into the extension, so opening a new tab does not fetch them from the network. Routes use hash history so they work on the extension new-tab page.

## Try it locally

```bash
npx extension@latest create my-newtab-vue-imagemagick --template newtab-vue-imagemagick
cd my-newtab-vue-imagemagick
npm install
npm run dev
```

A fresh browser window opens with the extension already loaded.

## Project layout

```
src/
├── images/
│   └── icon.png
├── newtab/
│   ├── assets/
│   │   ├── fonts/
│   │   ├── github.svg
│   │   └── imagemagick.svg
│   ├── components/
│   │   ├── ChannelSelection.vue
│   │   ├── CodeSample.vue
│   │   └── ImageCanvas.vue
│   ├── router/
│   │   └── index.ts
│   ├── views/
│   │   ├── classes/
│   │   ├── HomeView.vue
│   │   └── NotFoundView.vue
│   ├── index.html
│   ├── magick-assets.d.ts
│   ├── NewTabApp.vue
│   ├── scripts.ts
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
