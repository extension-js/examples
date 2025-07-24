[action-image]: https://github.com/extension-js/examples/actions/workflows/ci.yml/badge.svg?branch=main&color=2ecc40
[action-url]: https://github.com/extension-js/examples/actions
[chrome-image]: https://img.shields.io/badge/Chrome-Compatible-0971fe?logo=googlechrome&logoColor=white&style=flat
[chrome-url]: https://www.google.com/chrome/
[firefox-image]: https://img.shields.io/badge/Firefox-Compatible-0971fe?logo=firefox-browser&logoColor=white&style=flat
[firefox-url]: https://www.mozilla.org/firefox/
[discord-image]: https://img.shields.io/discord/1253608412890271755?label=Discord&logo=discord&style=flat&color=2ecc40
[discord-url]: https://discord.gg/v9h2RgeTSN

# Examples [![chrome][chrome-image]][chrome-url] [![firefox][firefox-image]][firefox-url] [![workflow][action-image]][action-url] [![discord][discord-image]][discord-url]

> A comprehensive collection of browser extension examples

- [Quick Start](#quick-start) — Create your first extension in seconds.
- [Available Examples](#available-examples) — Browse all available examples.
- [Framework Support](#framework-support) — See what frameworks are supported.

This repository contains a curated collection of browser extension examples built with Extension.js. Each example demonstrates different patterns, frameworks, and use cases for building cross-browser extensions.

## Quick Start

Create your first extension in seconds using any example:

```bash
# Create a basic extension (just a manifest.json file)
npx extension@latest create <extension-name> --template=<sample>
```

### Examples

```
# Create a content script extension with React
# Loads https://github.com/extension-js/examples/tree/main/examples/content-react
npx extension@latest create my-content-extension --template=content-react

# Create a content script extension with Vue
# Loads https://github.com/extension-js/examples/tree/main/examples/content-vue
npx extension@latest create my-action-extension --template=content-vue

# Create a content script extension with Svelte
# Loads https://github.com/extension-js/examples/tree/main/examples/content-svelte
npx extension@latest create my-action-extension --template=content-svelte

# Create a content script extension with TypeScript
# Loads https://github.com/extension-js/examples/tree/main/examples/content-typescript
npx extension@latest create my-action-extension --template=content-typescript

# Create a content script extension with JavaScript
# Loads https://github.com/extension-js/examples/tree/main/examples/content
npx extension@latest create my-action-extension --template=content

```

## Available Examples

See [./examples](https://github.com/extension-js/examples/tree/main/examples) for a full list.

## Framework Support

| <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/a9e2541a-96f0-4caa-9fc9-5fc5c3e901c8" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/b42c5330-9e2a-4045-99c3-1f7d264dfaf4" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/f19edff3-9005-4f50-b05c-fba615896a7f" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/ff64721d-d145-4213-930d-e70193f8d57e" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/15f1314a-aa65-4ce2-a3f3-cf53c4f730cf" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/de1082fd-7cf6-4202-8c12-a5c3cd3e5b42" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/8807efd9-93e5-4db5-a1d2-9ac524f7ecc2" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/c5f8a127-3c2a-4ceb-bb46-948cf2c8bd89" width="70"> |
| :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: |
|                                                    ESNext<br>latest                                                     |                                                  TypeScript<br>latest                                                   |                                                      React<br>18+                                                       |                                                        Vue<br>3+                                                        |                                                      Svelte<br>5+                                                       |                                                      Preact<br>10+                                                      |                                                      Angular<br>👋                                                      |                                                       Solid<br>👋                                                       |

## License

MIT (c) Cezar Augusto and the Extension.js Authors.
