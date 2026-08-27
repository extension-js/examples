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

This repository contains browser extension examples built with Extension.js. Each example demonstrates different patterns, frameworks, and use cases for building cross-browser extensions.

## Run an example from a clone

The examples ship without npm scripts, so run Extension.js directly from the example directory. Run `npm install` first when the example declares dependencies:

```bash
git clone https://github.com/extension-js/examples.git
cd examples/examples/javascript
npm install
npx extension@latest dev .
```

Prefer a fresh project instead? Every example doubles as a create template:

```bash
npx extension@latest create my-extension --template javascript
```

## Web standards and framework support

<div align="center">

| <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/a9e2541a-96f0-4caa-9fc9-5fc5c3e901c8" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/b42c5330-9e2a-4045-99c3-1f7d264dfaf4" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/f19edff3-9005-4f50-b05c-fba615896a7f" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/ff64721d-d145-4213-930d-e70193f8d57e" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/15f1314a-aa65-4ce2-a3f3-cf53c4f730cf" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/de1082fd-7cf6-4202-8c12-a5c3cd3e5b42" width="70"> | <img src="https://github.com/cezaraugusto/extension.js/assets/4672033/8807efd9-93e5-4db5-a1d2-9ac524f7ecc2" width="70"> |
| :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------: |
|                             ESNext<br>[Try out](https://templates.extension.dev/javascript)                             |                           TypeScript<br>[Try out](https://templates.extension.dev/typescript)                           |                           WASM<br>[Try out](https://templates.extension.dev/transformers-js)                            |                                React<br>[Try out](https://templates.extension.dev/react)                                |                                  Vue<br>[Try out](https://templates.extension.dev/vue)                                  |                               Svelte<br>[Try out](https://templates.extension.dev/svelte)                               |                               Preact<br>[Try out](https://templates.extension.dev/preact)                               |

</div>

## Examples

### Sidebar

<details>
  <summary><img src="./public/javascript/src/images/icon.png" alt="javascript example icon" width="22" /> JavaScript Example</summary>

> JavaScript-based extension with a sidebar panel. Adds a sidebar with a simple page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/javascript/README.md">examples/javascript</a></td>
      <td rowspan="5"><img src="./examples/javascript/screenshot.png" alt="javascript screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/javascript">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/react/src/images/icon.png" alt="react example icon" width="22" /> React Example</summary>

> React-based extension with a sidebar panel. Adds a sidebar with a simple page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/react/README.md">examples/react</a></td>
      <td rowspan="5"><img src="./examples/react/screenshot.png" alt="react screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">React</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/react">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/preact/src/images/icon.png" alt="preact example icon" width="22" /> Preact Example</summary>

> Preact-based extension with a sidebar panel. Adds a sidebar with a simple page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/preact/README.md">examples/preact</a></td>
      <td rowspan="5"><img src="./examples/preact/screenshot.png" alt="preact screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Preact</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/preact">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/svelte/src/images/icon.png" alt="svelte example icon" width="22" /> Svelte Example</summary>

> Svelte-based extension with a sidebar panel. Adds a sidebar with a simple page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/svelte/README.md">examples/svelte</a></td>
      <td rowspan="5"><img src="./examples/svelte/screenshot.png" alt="svelte screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Svelte</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/svelte">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/vue/src/images/icon.png" alt="vue example icon" width="22" /> Vue Example</summary>

> Vue.js-based extension with a sidebar panel. Adds a sidebar with a simple page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/vue/README.md">examples/vue</a></td>
      <td rowspan="5"><img src="./examples/vue/screenshot.png" alt="vue screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Vue</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/vue">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/typescript/src/images/icon.png" alt="typescript example icon" width="22" /> TypeScript Example</summary>

> TypeScript-based extension with a sidebar panel. Adds a sidebar with a simple page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/typescript/README.md">examples/typescript</a></td>
      <td rowspan="5"><img src="./examples/typescript/screenshot.png" alt="typescript screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/typescript">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/sidebar/src/images/icon.png" alt="sidebar example icon" width="22" /> Sidebar Example</summary>

> Sidebar panel example. Adds a sidebar to the browser with a simple page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/sidebar/README.md">examples/sidebar</a></td>
      <td rowspan="5"><img src="./examples/sidebar/screenshot.png" alt="sidebar screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/sidebar">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/sidebar-shadcn/src/images/icon.png" alt="sidebar-shadcn example icon" width="22" /> Sidebar Shadcn Example</summary>

> React sidebar example using shadcn/ui components. Adds a sidebar panel with a simple React page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/sidebar-shadcn/README.md">examples/sidebar-shadcn</a></td>
      <td rowspan="5"><img src="./examples/sidebar-shadcn/screenshot.png" alt="sidebar-shadcn screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">React</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/sidebar-shadcn">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/transformers-js/src/images/icon.png" alt="transformers-js example icon" width="22" /> Transformers JS Example</summary>

> Transformers.js demo with a sidebar and a content script: classify the active page or your selection on-device via WebGPU/WASM.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/transformers-js/README.md">examples/transformers-js</a></td>
      <td rowspan="5"><img src="./examples/transformers-js/screenshot.png" alt="transformers-js screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content, Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/transformers-js">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="https://avatars.githubusercontent.com/u/172809806?s=44" alt="extension.js icon" width="22" /> Sidebar Monorepo Turborepo Example</summary>

> Monorepo example with content script and sidebar.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/sidebar-monorepo-turborepo/README.md">examples/sidebar-monorepo-turborepo</a></td>
      <td rowspan="5"><img src="./examples/sidebar-monorepo-turborepo/screenshot.png" alt="sidebar-monorepo-turborepo screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/sidebar-monorepo-turborepo">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="https://avatars.githubusercontent.com/u/172809806?s=44" alt="extension.js icon" width="22" /> Sidebar Monorepo Nx Example</summary>

> Monorepo example with content script and sidebar.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/sidebar-monorepo-nx/README.md">examples/sidebar-monorepo-nx</a></td>
      <td rowspan="5"><img src="./examples/sidebar-monorepo-nx/screenshot.png" alt="sidebar-monorepo-nx screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/sidebar-monorepo-nx">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

### Action

<details>
  <summary><img src="./public/action/src/images/icon.png" alt="action example icon" width="22" /> Action Example</summary>

> Action popup example. Opens a toolbar popup with a simple page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/action/README.md">examples/action</a></td>
      <td rowspan="5"><img src="./examples/action/screenshot.png" alt="action screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Action, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/action">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/action-locales/src/images/icon.png" alt="action-locales example icon" width="22" /> Action Locales Example</summary>

> Action popup example demonstrating i18n with \_locales and message placeholders.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/action-locales/README.md">examples/action-locales</a></td>
      <td rowspan="5"><img src="./examples/action-locales/screenshot.png" alt="action-locales screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Action, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/action-locales">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

### DevTools

<details>
  <summary><img src="./public/devtools/src/images/icon.png" alt="devtools example icon" width="22" /> DevTools Panel Example</summary>

> Adds a devtools panel to the browser that reads the inspected page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/devtools/README.md">examples/devtools</a></td>
      <td rowspan="5"><img src="./examples/devtools/screenshot.png" alt="devtools screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">DevTools</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">No</td>
      <td align="center"><a href="https://templates.extension.dev/devtools">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/devtools-react/src/images/icon.png" alt="devtools-react example icon" width="22" /> React DevTools Panel Example</summary>

> Adds a React devtools panel to the browser that reads the inspected page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/devtools-react/README.md">examples/devtools-react</a></td>
      <td rowspan="5"><img src="./examples/devtools-react/screenshot.png" alt="devtools-react screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">DevTools</td></tr>
    <tr><td>JavaScript framework</td><td align="right">React</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">No</td>
      <td align="center"><a href="https://templates.extension.dev/devtools-react">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/devtools-preact/src/images/icon.png" alt="devtools-preact example icon" width="22" /> Preact DevTools Panel Example</summary>

> Adds a devtools panel written in Preact that reads the inspected page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/devtools-preact/README.md">examples/devtools-preact</a></td>
      <td rowspan="5"><img src="./examples/devtools-preact/screenshot.png" alt="devtools-preact screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">DevTools</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Preact</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">No</td>
      <td align="center"><a href="https://templates.extension.dev/devtools-preact">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/devtools-typescript/src/images/icon.png" alt="devtools-typescript example icon" width="22" /> TypeScript DevTools Panel Example</summary>

> Adds a devtools panel to the browser that reads the inspected page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/devtools-typescript/README.md">examples/devtools-typescript</a></td>
      <td rowspan="5"><img src="./examples/devtools-typescript/screenshot.png" alt="devtools-typescript screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">DevTools</td></tr>
    <tr><td>JavaScript framework</td><td align="right">TypeScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">No</td>
      <td align="center"><a href="https://templates.extension.dev/devtools-typescript">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/devtools-svelte/src/images/icon.png" alt="devtools-svelte example icon" width="22" /> Svelte DevTools Panel Example</summary>

> Adds a Svelte devtools panel to the browser that reads the inspected page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/devtools-svelte/README.md">examples/devtools-svelte</a></td>
      <td rowspan="5"><img src="./examples/devtools-svelte/screenshot.png" alt="devtools-svelte screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">DevTools</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Svelte</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">No</td>
      <td align="center"><a href="https://templates.extension.dev/devtools-svelte">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/devtools-vue/src/images/icon.png" alt="devtools-vue example icon" width="22" /> Vue DevTools Panel Example</summary>

> Adds a devtools panel built with Vue that reads the inspected page.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/devtools-vue/README.md">examples/devtools-vue</a></td>
      <td rowspan="5"><img src="./examples/devtools-vue/screenshot.png" alt="devtools-vue screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">DevTools</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Vue</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">No</td>
      <td align="center"><a href="https://templates.extension.dev/devtools-vue">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

### Content

<details>
  <summary><img src="./public/content/src/images/icon.png" alt="content example icon" width="22" /> Content Example</summary>

> Injects a small badge into every web page you visit, with an options page that moves it to the left or right edge.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content/README.md">examples/content</a></td>
      <td rowspan="5"><img src="./examples/content/screenshot.png" alt="content screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Options, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-css-modules/src/images/icon.png" alt="content-css-modules example icon" width="22" /> Content CSS Modules Example</summary>

> Injects a small styled badge into every web page you visit.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-css-modules/README.md">examples/content-css-modules</a></td>
      <td rowspan="5"><img src="./examples/content-css-modules/screenshot.png" alt="content-css-modules screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-css-modules">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-custom-font/src/images/icon.png" alt="content-custom-font example icon" width="22" /> Content Custom Font Example</summary>

> Injects a badge rendered in a custom font into every web page you visit.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-custom-font/README.md">examples/content-custom-font</a></td>
      <td rowspan="5"><img src="./examples/content-custom-font/screenshot.png" alt="content-custom-font screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-custom-font">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-env/src/images/icon.png" alt="content-env example icon" width="22" /> Content Env Example</summary>

> Injects a small panel showing the extension's environment values into every web page you visit.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-env/README.md">examples/content-env</a></td>
      <td rowspan="5"><img src="./examples/content-env/screenshot.png" alt="content-env screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-env">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-less/src/images/icon.png" alt="content-less example icon" width="22" /> Content Less Example</summary>

> Injects a small styled badge into every web page you visit.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-less/README.md">examples/content-less</a></td>
      <td rowspan="5"><img src="./examples/content-less/screenshot.png" alt="content-less screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">Less</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-less">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-less-modules/src/images/icon.png" alt="content-less-modules example icon" width="22" /> Content Less Modules Example</summary>

> Injects a small styled badge into every web page you visit.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-less-modules/README.md">examples/content-less-modules</a></td>
      <td rowspan="5"><img src="./examples/content-less-modules/screenshot.png" alt="content-less-modules screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">Less</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-less-modules">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-multi-one-entry/src/images/icon.png" alt="content-multi-one-entry example icon" width="22" /> Content Multi One Entry Example</summary>

> Injects four small elements into every web page you visit.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-multi-one-entry/README.md">examples/content-multi-one-entry</a></td>
      <td rowspan="5"><img src="./examples/content-multi-one-entry/screenshot.png" alt="content-multi-one-entry screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-multi-one-entry">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-multi-three-entries/src/images/icon.png" alt="content-multi-three-entries example icon" width="22" /> Content Multi Three Entries Example</summary>

> Injects four small elements into every web page you visit.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-multi-three-entries/README.md">examples/content-multi-three-entries</a></td>
      <td rowspan="5"><img src="./examples/content-multi-three-entries/screenshot.png" alt="content-multi-three-entries screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-multi-three-entries">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-preact/src/images/icon.png" alt="content-preact example icon" width="22" /> Content Preact Example</summary>

> Shows an overlay UI on web pages and an options page that moves it from right to left.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-preact/README.md">examples/content-preact</a></td>
      <td rowspan="5"><img src="./examples/content-preact/screenshot.png" alt="content-preact screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Options, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Preact</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-preact">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-react/src/images/icon.png" alt="content-react example icon" width="22" /> Content React Example</summary>

> Shows a small overlay UI on every web page, with a React options page that moves it from right to left.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-react/README.md">examples/content-react</a></td>
      <td rowspan="5"><img src="./examples/content-react/screenshot.png" alt="content-react screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Options, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">React</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-react">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-sass/src/images/icon.png" alt="content-sass example icon" width="22" /> Content Sass Example</summary>

> Injects a small styled badge into every web page you visit.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-sass/README.md">examples/content-sass</a></td>
      <td rowspan="5"><img src="./examples/content-sass/screenshot.png" alt="content-sass screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">Sass</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-sass">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-sass-modules/src/images/icon.png" alt="content-sass-modules example icon" width="22" /> Content Sass Modules Example</summary>

> Injects a small styled badge into every web page you visit.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-sass-modules/README.md">examples/content-sass-modules</a></td>
      <td rowspan="5"><img src="./examples/content-sass-modules/screenshot.png" alt="content-sass-modules screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">Sass</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-sass-modules">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-svelte/src/images/icon.png" alt="content-svelte example icon" width="22" /> Content Svelte Example</summary>

> Shows a Svelte overlay on every web page you visit, with an options page that moves it from right to left.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-svelte/README.md">examples/content-svelte</a></td>
      <td rowspan="5"><img src="./examples/content-svelte/screenshot.png" alt="content-svelte screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Options, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Svelte</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-svelte">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-typescript/src/images/icon.png" alt="content-typescript example icon" width="22" /> Content TypeScript Example</summary>

> Shows a small overlay UI on every web page, with an options page that moves it from right to left.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-typescript/README.md">examples/content-typescript</a></td>
      <td rowspan="5"><img src="./examples/content-typescript/screenshot.png" alt="content-typescript screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Options, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-typescript">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/content-vue/src/images/icon.png" alt="content-vue example icon" width="22" /> Content Vue Example</summary>

> Shows a small overlay UI on every web page, with a Vue options page that moves it from right to left.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/content-vue/README.md">examples/content-vue</a></td>
      <td rowspan="5"><img src="./examples/content-vue/screenshot.png" alt="content-vue screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, Options, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Vue</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/content-vue">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

### New

<details>
  <summary><img src="./public/newtab/src/images/icon.png" alt="newtab example icon" width="22" /> New Example</summary>

> New tab page example using plain JavaScript. Renders a simple page you can customize.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab/README.md">examples/newtab</a></td>
      <td rowspan="5"><img src="./examples/newtab/screenshot.png" alt="newtab screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-browser-flags/src/images/icon.png" alt="newtab-browser-flags example icon" width="22" /> New Browser Flags Example</summary>

> A browser extension example built with Extension.js demonstrating browser-specific features and flags. Shows how to handle browser differences across targets.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-browser-flags/README.md">examples/newtab-browser-flags</a></td>
      <td rowspan="5"><img src="./examples/newtab-browser-flags/screenshot.png" alt="newtab-browser-flags screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Content Script, New Tab, Sidebar, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-browser-flags">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-config-eslint/src/images/icon.png" alt="newtab-config-eslint example icon" width="22" /> New Config ESLint Example</summary>

> New tab page example with ESLint configured. Shows how linting is set up in an extension project.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-config-eslint/README.md">examples/newtab-config-eslint</a></td>
      <td rowspan="5"><img src="./examples/newtab-config-eslint/screenshot.png" alt="newtab-config-eslint screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-config-eslint">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-config-prettier/src/images/icon.png" alt="newtab-config-prettier example icon" width="22" /> New Config Prettier Example</summary>

> New tab page example with Prettier configured. Shows how formatting is set up in an extension project.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-config-prettier/README.md">examples/newtab-config-prettier</a></td>
      <td rowspan="5"><img src="./examples/newtab-config-prettier/screenshot.png" alt="newtab-config-prettier screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-config-prettier">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-config-stylelint/src/images/icon.png" alt="newtab-config-stylelint example icon" width="22" /> New Config Stylelint Example</summary>

> New tab page example with Stylelint configured. Shows how CSS linting is set up in an extension project.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-config-stylelint/README.md">examples/newtab-config-stylelint</a></td>
      <td rowspan="5"><img src="./examples/newtab-config-stylelint/screenshot.png" alt="newtab-config-stylelint screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">Sass</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-config-stylelint">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-crypto/src/images/icon.png" alt="newtab-crypto example icon" width="22" /> New Crypto Example</summary>

> New tab page example demonstrating basic crypto operations inside an extension.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-crypto/README.md">examples/newtab-crypto</a></td>
      <td rowspan="5"><img src="./examples/newtab-crypto/screenshot.png" alt="newtab-crypto screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-crypto">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-env/src/images/icon.png" alt="newtab-env example icon" width="22" /> New Env Example</summary>

> New tab page example demonstrating environment variables (.env) in an extension project.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-env/README.md">examples/newtab-env</a></td>
      <td rowspan="5"><img src="./examples/newtab-env/screenshot.png" alt="newtab-env screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-env">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-less/src/images/icon.png" alt="newtab-less example icon" width="22" /> New Less Example</summary>

> New tab page example styled with Less. Renders a simple page and organizes styles with Less.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-less/README.md">examples/newtab-less</a></td>
      <td rowspan="5"><img src="./examples/newtab-less/screenshot.png" alt="newtab-less screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">Less</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-less">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-preact/src/images/icon.png" alt="newtab-preact example icon" width="22" /> New Preact Example</summary>

> New tab page example rendered with Preact. Loads a small Preact app you can extend.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-preact/README.md">examples/newtab-preact</a></td>
      <td rowspan="5"><img src="./examples/newtab-preact/screenshot.png" alt="newtab-preact screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Preact</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-preact">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-react/src/images/icon.png" alt="newtab-react example icon" width="22" /> New React Example</summary>

> A browser extension new tab page example built with Extension.js and React. Demonstrates a React-based new tab page with a working build and preview flow.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-react/README.md">examples/newtab-react</a></td>
      <td rowspan="5"><img src="./examples/newtab-react/screenshot.png" alt="newtab-react screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">React</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-react">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-react-router/src/images/icon.png" alt="newtab-react-router example icon" width="22" /> New React Router Example</summary>

> New tab page example using React Router. Shows multiple routes inside the new tab app.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-react-router/README.md">examples/newtab-react-router</a></td>
      <td rowspan="5"><img src="./examples/newtab-react-router/screenshot.png" alt="newtab-react-router screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">React</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-react-router">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-sass/src/images/icon.png" alt="newtab-sass example icon" width="22" /> New Sass Example</summary>

> New tab page example styled with Sass. Renders a simple page and organizes styles with Sass.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-sass/README.md">examples/newtab-sass</a></td>
      <td rowspan="5"><img src="./examples/newtab-sass/screenshot.png" alt="newtab-sass screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">Sass</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-sass">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-svelte/src/images/icon.png" alt="newtab-svelte example icon" width="22" /> New Svelte Example</summary>

> New tab page example rendered with Svelte. Loads a small Svelte app you can extend.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-svelte/README.md">examples/newtab-svelte</a></td>
      <td rowspan="5"><img src="./examples/newtab-svelte/screenshot.png" alt="newtab-svelte screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Svelte</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-svelte">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-typescript/src/images/icon.png" alt="newtab-typescript example icon" width="22" /> New TypeScript Example</summary>

> A browser extension new tab page example built with Extension.js and TypeScript. Demonstrates a type-safe new tab page with a working build and preview flow.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-typescript/README.md">examples/newtab-typescript</a></td>
      <td rowspan="5"><img src="./examples/newtab-typescript/screenshot.png" alt="newtab-typescript screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-typescript">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/newtab-vue/src/images/icon.png" alt="newtab-vue example icon" width="22" /> New Vue Example</summary>

> New tab page example rendered with Vue. Loads a small Vue app you can extend.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/newtab-vue/README.md">examples/newtab-vue</a></td>
      <td rowspan="5"><img src="./examples/newtab-vue/screenshot.png" alt="newtab-vue screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">New Tab, Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">Vue</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/newtab-vue">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

### Special folders

<details>
  <summary><img src="./public/special-folders-pages/src/images/icon.png" alt="special-folders-pages example icon" width="22" /> Special Folders Pages Example</summary>

> Opens a welcome page on extension load, showcasing the pages/ folder.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/special-folders-pages/README.md">examples/special-folders-pages</a></td>
      <td rowspan="5"><img src="./examples/special-folders-pages/screenshot.png" alt="special-folders-pages screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/special-folders-pages">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

<details>
  <summary><img src="./public/special-folders-scripts/src/images/icon.png" alt="special-folders-scripts example icon" width="22" /> Special Folders Scripts Example</summary>

> Demonstrates scripts/ folder organization and how to run standalone scripts via the extension.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/special-folders-scripts/README.md">examples/special-folders-scripts</a></td>
      <td rowspan="5"><img src="./examples/special-folders-scripts/screenshot.png" alt="special-folders-scripts screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right">Background</td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">Yes</td>
      <td align="center"><a href="https://templates.extension.dev/special-folders-scripts">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

### Utilities

<details>
  <summary><img src="./public/init/src/images/icon.png" alt="init example icon" width="22" /> Init Example</summary>

> A basic browser extension example built with Extension.js. A starting point for developers learning current browser extension tooling.

  <table>
    <tr>
      <td>Repository</td>
      <td align="right"><a href="https://github.com/extension-js/examples/blob/main/examples/init/README.md">examples/init</a></td>
      <td rowspan="5"><img src="./examples/init/screenshot.png" alt="init screenshot" width="360" /></td>
    </tr>
    <tr><td>Version</td><td align="right">1.0.0</td></tr>
    <tr><td>Context</td><td align="right"></td></tr>
    <tr><td>JavaScript framework</td><td align="right">JavaScript</td></tr>
    <tr><td>CSS</td><td align="right">CSS</td></tr>
    <tr>
      <td>Background included</td>
      <td align="right">No</td>
      <td align="center"><a href="https://templates.extension.dev/init">Start with this template &#8599;</a></td>
    </tr>
  </table>
</details>

## License

MIT (c) Cezar Augusto and the Extension.js authors.
