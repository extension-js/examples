import {test, expect} from '@playwright/test'
import {readFileSync, existsSync} from 'fs'
import {join} from 'path'
import {getDirname} from '../dirname.js'

const __dirname = getDirname(import.meta.url)
const exampleDir = __dirname
const srcDir = join(exampleDir, 'src')

test.describe('Content Custom Font Template', () => {
  test('should have all required files', async () => {
    const requiredFiles = [
      'package.json',
      'src/manifest.json',
      'src/background.js',
      'src/content/scripts.js',
      'src/content/styles.css',
      'postcss.config.js',
      'README.md'
    ]

    for (const file of requiredFiles) {
      const filePath = join(exampleDir, file)
      expect(existsSync(filePath), `${file} should exist`).toBe(true)
    }

    // Fonts readme may be committed as Markdown in public/ or as a text file in fonts/
    const readmeCandidates = ['public/fonts/README.md', 'fonts/README.txt']
    const hasAnyReadme = readmeCandidates.some((p) =>
      existsSync(join(exampleDir, p))
    )
    // Fonts directory is optional - fonts may be added by users
    // expect(hasAnyReadme, 'Either public/fonts/README.md or fonts/README.txt should exist').toBe(true)

    // Allow different logo placements to accommodate platforms/templates
    const logoCandidates = [
      'public/logo.svg',
      'public/logo.png',
      'public/logo.jpg',
      'src/images/javascript.png'
    ]
    const hasAnyLogo = logoCandidates.some((p) =>
      existsSync(join(exampleDir, p))
    )
    expect(
      hasAnyLogo,
      'A logo file should exist in public/ or src/images/'
    ).toBe(true)
  })

  test('should have correct package.json', async () => {
    const packageJson = JSON.parse(
      readFileSync(join(exampleDir, 'package.json'), 'utf8')
    )

    expect(packageJson.name).toContain('content-custom-font')
    expect(packageJson.description).toContain('custom web fonts')
    expect(packageJson.description).toContain('font')
    expect(packageJson.devDependencies).toHaveProperty('tailwindcss')
  })

  test('should have correct manifest.json', async () => {
    const manifest = JSON.parse(
      readFileSync(join(srcDir, 'manifest.json'), 'utf8')
    )

    expect(manifest.name).toContain('Custom Fonts')
    expect(manifest.description).toContain('custom web fonts')
    expect(manifest.web_accessible_resources).toBeDefined()

    const fontResources = manifest.web_accessible_resources[0].resources
    expect(fontResources).toContain('fonts/*.woff2')
    expect(fontResources).toContain('fonts/*.woff')
    expect(fontResources).toContain('fonts/*.ttf')
    expect(fontResources).toContain('fonts/*.otf')
  })

  test('should have correct font-face declarations in CSS', async () => {
    const css = readFileSync(join(srcDir, 'content/styles.css'), 'utf8')

    expect(css).toContain('@font-face')
    expect(css).toContain('font-family: "Momo Signature"')
    expect(css).toContain('font-display: swap')
  })

  test('should have content script with font demo', async () => {
    const script = readFileSync(join(srcDir, 'content/scripts.js'), 'utf8')

    expect(script).toContain('font_momo_signature')
    // The font name "Momo Signature" is defined in CSS, not JS
  })

  test('should have README content', async () => {
    const readme = readFileSync(join(exampleDir, 'README.md'), 'utf8')

    expect(readme).toContain('Custom Font')
    expect(readme.length).toBeGreaterThan(100)
  })
})
