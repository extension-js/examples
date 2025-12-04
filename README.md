[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe?logo=extension.js&logoColor=white&style=flat
[powered-url]: https://extension.js.org
[action-image]: https://img.shields.io/github/actions/workflow/status/extension-js/examples/ci.yml?branch=main&label=CI&logo=github&color=2ecc40&style=flat
[action-url]: https://github.com/extension-js/examples/actions
[chromium-image]: https://img.shields.io/badge/Chromium-Compatible-4285F4?logo=googlechrome&logoColor=white&style=flat
[chromium-url]: https://www.chromium.org
[firefox-image]: https://img.shields.io/badge/Firefox-Compatible-FF7139?logo=firefox-browser&logoColor=white&style=flat
[firefox-url]: https://www.mozilla.org/firefox/
[discord-image]: https://img.shields.io/discord/1253608412890271755?label=Discord&logo=discord&style=flat&color=2ecc40
[discord-url]: https://discord.gg/v9h2RgeTSN

[![Powered by Extension.js][powered-image]][powered-url] [![CI][action-image]][action-url] [![chromium][chromium-image]][chromium-url] [![firefox][firefox-image]][firefox-url] [![discord][discord-image]][discord-url]

# Extension.js Examples

> A collection of browser extension examples

- [Available Examples](#available-examples) — Browse all available examples.
- [Framework Support](#framework-support) — See what frameworks are supported.

This repository contains browser extension examples built with Extension.js. Each example demonstrates different patterns, frameworks, and use cases for building cross-browser extensions.

## Public metadata contracts

This repo produces public metadata consumed by other apps:

### templates-meta.json (v2)

- Output: `templates-meta.json`
- Schema: `schemas/templates/v2/templates-meta.schema.json`
- Example payload: `schemas/templates/v2/examples/templates-meta.example.json`

### Curated template meta (optional)

- File: `examples/<slug>/template.meta.json` (optional, curated fields only)
- Schema: `schemas/templates/v2/template-meta.schema.json`

### Rules (AI-friendly)

- Prefer **inferred facts** (manifest/package.json/tree scanning) for structural fields.
- Only allow curated overrides for user-facing fields (tags/difficulty/firstSteps/useCases/docsUrl).
- Everything here is public: do not include secrets, private URLs, or internal notes in generated metadata.

## License

MIT (c) Cezar Augusto and the Extension.js Authors.
