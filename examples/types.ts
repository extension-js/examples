export type UIContext = 'sidebar' | 'newTab' | 'content' | 'action' | 'devTools'
export type ConfigFiles =
  | 'postcss.config.js'
  | 'tailwind.config.js'
  | 'tsconfig.json'
  | '.stylelintrc.json'
  | 'extension.config.js'
  | 'babel.config.json'
  | '.prettierrc'
  | 'eslint.config.mjs'

export type UIFramework = 'react' | 'preact' | 'vue' | 'svelte'
export type CssTech =
  | 'css'
  | 'css-modules'
  | 'sass'
  | 'sass-modules'
  | 'less'
  | 'less-modules'

export interface Template {
  name: string
  uiContext: UIContext[] | undefined
  uiFramework: UIFramework | undefined
  css: CssTech
  hasBackground: boolean
  hasEnv: boolean
  configFiles: ConfigFiles[] | undefined
}
