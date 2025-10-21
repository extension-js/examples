export interface TemplatesMeta {
  version: string
  sourceRepo: string
  generatorVersion: string
  commit: string
  generatedAt: string
  templates: TemplateEntry[]
}

export interface IntegrityEntry {
  sha256: string
  size: number
}

export interface TemplateEntry {
  slug: string
  name: string
  version: string
  manifest_version: number
  description: string
  uiContext: string[]
  uiFramework: string
  css: string
  configFiles: string[]
  hasBackground: boolean
  hasEnv: boolean
  files: string[]
  browsers: string[]
  screenshot: string
  integrity?: Record<string, IntegrityEntry>
  tags?: string[]
  // enriched fields emitted by generator
  compat?: Record<string, {supported: boolean; minVersion?: string}>
  permissions?: string[]
  optional_permissions?: string[]
  host_permissions?: string[]
  contentScripts?: Array<{
    matches: string[]
    run_at?: string
    js?: string[]
    css?: string[]
  }>
  background?: {
    type: 'service_worker' | 'page' | 'event' | 'none'
    file?: string
  }
  webAccessible?: string[]
  i18n?: boolean
  icons?: Record<string, string>
  csp?: string
  sandbox?: {pages?: string[]}
  repositoryUrl?: string
  license?: string
  buildTool?: string
  packageManager?: string
}
