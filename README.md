[empowering-image]: https://img.shields.io/badge/Empowering-Extension.js-0971fe?logo=extension.js&logoColor=white&style=flat
[empowering-url]: https://extension.js.org
[action-image]: https://img.shields.io/github/actions/workflow/status/extension-js/examples/ci.yml?branch=main&label=CI&logo=github&color=2ecc40&style=flat
[action-url]: https://github.com/extension-js/examples/actions
[chromium-image]: https://img.shields.io/badge/Chromium-Compatible-4285F4?logo=googlechrome&logoColor=white&style=flat
[chromium-url]: https://www.chromium.org
[firefox-image]: https://img.shields.io/badge/Firefox-Compatible-FF7139?logo=firefox-browser&logoColor=white&style=flat
[firefox-url]: https://www.mozilla.org/firefox/
[discord-image]: https://img.shields.io/discord/1253608412890271755?label=Discord&logo=discord&style=flat&color=2ecc40
[discord-url]: https://discord.gg/v9h2RgeTSN

[![Empowering Extension.js][empowering-image]][empowering-url] [![CI][action-image]][action-url] [![chromium][chromium-image]][chromium-url] [![firefox][firefox-image]][firefox-url] [![discord][discord-image]][discord-url]

# Extension.js Examples

> A comprehensive collection of browser extension examples

- [Available Examples](#available-examples) — Browse all available examples.
- [Framework Support](#framework-support) — See what frameworks are supported.

This repository contains a curated collection of browser extension examples built with Extension.js. Each example demonstrates different patterns, frameworks, and use cases for building cross-browser extensions.

## Available Examples

<details>
<summary><strong>Content Script with React</strong> — Inject React components into web pages</summary>

<table>
<tr>
<td width="50%">

| Component | Technology   |
| --------- | ------------ |
| Framework | React        |
| Language  | TypeScript   |
| Styling   | CSS          |
| Build     | Extension.js |

```bash
npx extension@latest create my-content-script \
  --template content-react
```

</td>
<td width="50%">

![Extension Screenshot](screenshot.png) <!-- tbd -->

Inject React-powered components directly into web pages. Perfect for building rich UI overlays, widgets, or page enhancements.

</td>
</tr>
</table>

</details>

## License

MIT (c) Cezar Augusto and the Extension.js Authors.
