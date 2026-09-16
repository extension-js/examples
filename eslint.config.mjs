// ███████╗██╗  ██╗ █████╗ ███╗   ███╗██████╗ ██╗     ███████╗███████╗
// ██╔════╝╚██╗██╔╝██╔══██╗████╗ ████║██╔══██╗██║     ██╔════╝██╔════╝
// █████╗   ╚███╔╝ ███████║██╔████╔██║██████╔╝██║     █████╗  ███████╗
// ██╔══╝   ██╔██╗ ██╔══██║██║╚██╔╝██║██╔═══╝ ██║     ██╔══╝  ╚════██║
// ███████╗██╔╝ ██╗██║  ██║██║ ╚═╝ ██║██║     ███████╗███████╗███████║
// ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝     ╚══════╝╚══════╝╚══════╝

import babelParser from '@babel/eslint-parser'
import js from '@eslint/js'
import globals from 'globals'
import local from './scripts/lib/eslint-style-rules.mjs'

const babelTypeScript = (plugins) => ({
  parser: babelParser,
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {babelrc: false, configFile: false, parserOpts: {plugins}}
  }
})

const templateOnlyRules = {
  rules: {'ban-ts-comment': {create: () => ({})}}
}

const commentRules = (allowBanner) => ({
  'local/no-file-header-comment': ['error', {allowBanner}],
  'local/no-divider-comment': ['error', {allowBanner}],
  'local/no-jsdoc-description': 'error'
})

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
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...js.configs.recommended
  },
  {
    files: ['**/*.jsx'],
    languageOptions: {parserOptions: {ecmaFeatures: {jsx: true}}}
  },
  {
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: babelTypeScript([['typescript', {}]])
  },
  {
    files: ['**/*.d.ts'],
    languageOptions: babelTypeScript([['typescript', {dts: true}]])
  },
  {
    files: ['examples/*/**'],
    plugins: {'@typescript-eslint': templateOnlyRules},
    linterOptions: {reportUnusedDisableDirectives: 'off'}
  },
  {
    files: ['**/*.tsx'],
    languageOptions: babelTypeScript([['typescript', {}], 'jsx'])
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    plugins: {local},
    rules: {
      curly: ['error', 'multi-line'],
      'local/padding-line-between-statements': [
        'error',
        {blankLine: 'always', prev: '*', next: ['return', 'throw']},
        {blankLine: 'always', prev: 'if', next: '*'},
        {blankLine: 'any', prev: 'if', next: 'if'},
        {blankLine: 'always', prev: '*', next: 'block-like'},
        {blankLine: 'always', prev: 'block-like', next: '*'},
        {blankLine: 'always', prev: 'multiline-expression', next: '*'},
        {blankLine: 'any', prev: '*', next: 'empty'},
        {blankLine: 'any', prev: 'empty', next: '*'}
      ],
      'local/blank-line-after-shebang': 'error'
    }
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs,ts}', 'examples/*.ts'],
    rules: commentRules(false)
  },
  {
    files: ['*.{js,mjs,cjs,ts}'],
    rules: commentRules(true)
  },
  {
    ignores: [
      'templates-meta.d.ts',
      'templates/',
      'artifacts/',
      '.local-fixtures/',
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
