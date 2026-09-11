// ███████╗██╗  ██╗ █████╗ ███╗   ███╗██████╗ ██╗     ███████╗███████╗
// ██╔════╝╚██╗██╔╝██╔══██╗████╗ ████║██╔══██╗██║     ██╔════╝██╔════╝
// █████╗   ╚███╔╝ ███████║██╔████╔██║██████╔╝██║     █████╗  ███████╗
// ██╔══╝   ██╔██╗ ██╔══██║██║╚██╔╝██║██╔═══╝ ██║     ██╔══╝  ╚════██║
// ███████╗██╔╝ ██╗██║  ██║██║ ╚═╝ ██║██║     ███████╗███████╗███████║
// ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝     ╚══════╝╚══════╝╚══════╝

import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.node
      }
    }
  },
  js.configs.recommended,
  {
    ignores: [
      '**/dist/',
      '.prod-dist/',
      '.source-guard/',
      '**/e2e-report/',
      '**/coverage/',
      '**/webpack.config.js',
      '**/postcss.config.js',
      '**/tailwind.config.js',
      '**/stylelint.config.json'
    ]
  }
]
