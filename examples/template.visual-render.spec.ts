// On-screen render verification for CSS-pipeline content templates
// (plain CSS, sass, less, and their *-modules variants).
//
// Motivation: the assets/spec suites assert computed styles on the shadow
// wrapper <div>, which can pass while the widget is not actually visible on
// screen (image failed to load, inner elements unstyled, panel off-viewport
// or zero-painted). This spec closes that gap by verifying what the user
// sees, not what the CSSOM reports:
//   1. Panel bounding box is sane (expected ~347px content+padding box) and
//      fully inside the viewport.
//   2. The logo <img> actually decoded (naturalWidth > 0, complete).
//   3. h1 title and description <p> paint non-zero boxes inside the panel.
//   4. Real pixels: a patch of the rendered screenshot inside the panel
//      matches the stylesheet background color (dark templates), proving the
//      compositor painted the styled panel — not just that CSSOM matched.
//
// Uses pre-built extensions (dist/chrome), same as template.assets.spec.ts.

import {expect} from '@playwright/test'
import path from 'path'
import fs from 'fs'
import {
  extensionFixtures,
  resolveBuiltExtensionPath
} from './extension-fixtures.js'
import {getDirname} from './dirname.js'

const __dirname = getDirname(import.meta.url)

// Playwright bundles pngjs — reuse it instead of adding a dependency.
import {createRequire} from 'module'
const nodeRequire = createRequire(import.meta.url)
const {PNG} = nodeRequire('playwright-core/lib/utilsBundle') as {
  PNG: any
}

const HOST_SELECTOR = '#extension-root, [data-extension-root="true"]'

interface VisualTemplate {
  name: string
  // Expected panel background from the stylesheet.
  bg: {r: number; g: number; b: number}
  // Whether the pixel-patch check is meaningful (dark panel on white page).
  pixelCheck: boolean
}

const TEMPLATES: VisualTemplate[] = [
  {name: 'content', bg: {r: 10, g: 12, b: 16}, pixelCheck: true},
  // Light theme: white panel — distinguishable from example.com's #eee body
  // as long as the tolerance stays below 17.
  {name: 'content-css-modules', bg: {r: 255, g: 255, b: 255}, pixelCheck: true},
  {name: 'content-sass', bg: {r: 10, g: 12, b: 16}, pixelCheck: true},
  {name: 'content-sass-modules', bg: {r: 10, g: 12, b: 16}, pixelCheck: true},
  {name: 'content-less', bg: {r: 10, g: 12, b: 16}, pixelCheck: true},
  {name: 'content-less-modules', bg: {r: 10, g: 12, b: 16}, pixelCheck: true}
]

interface PanelInfo {
  panel: {x: number; y: number; w: number; h: number}
  img: {
    found: boolean
    complete: boolean
    naturalWidth: number
    w: number
    h: number
  }
  title: {found: boolean; text: string; w: number; h: number; inPanel: boolean}
  desc: {found: boolean; w: number; h: number; inPanel: boolean}
  classNames: {
    panel: string
    img: string
    title: string
  }
}

for (const tmpl of TEMPLATES) {
  const exampleDir = path.join(__dirname, tmpl.name)
  if (!fs.existsSync(path.join(exampleDir, 'src', 'manifest.json'))) continue

  const pathToExtension = resolveBuiltExtensionPath(exampleDir)
  const test = extensionFixtures(pathToExtension)

  test.describe(`${tmpl.name}: on-screen render`, () => {
    test('content panel is visibly rendered with real pixels', async ({
      page
    }) => {
      await page.goto('https://example.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })

      // Wait until the panel reports a styled, non-zero box.
      await expect
        .poll(
          async () =>
            page.evaluate((sel) => {
              const sr = document.querySelector(sel)?.shadowRoot
              const panel = sr?.querySelector('div')
              if (!panel) return null
              const r = panel.getBoundingClientRect()
              return r.width > 0 && r.height > 0 ? true : null
            }, HOST_SELECTOR),
          {
            timeout: 30000,
            message: `${tmpl.name}: panel never painted a non-zero box`
          }
        )
        .toBe(true)

      const info: PanelInfo | null = await page.evaluate((sel) => {
        const host = document.querySelector(sel)
        const sr = host?.shadowRoot
        if (!sr) return null
        const panel = sr.querySelector('div')
        if (!panel) return null
        const pr = panel.getBoundingClientRect()
        const img = sr.querySelector('img') as HTMLImageElement | null
        const ir = img?.getBoundingClientRect()
        const title = sr.querySelector('h1, h2') as HTMLElement | null
        const tr = title?.getBoundingClientRect()
        const desc = sr.querySelector('p') as HTMLElement | null
        const dr = desc?.getBoundingClientRect()
        const inside = (r?: DOMRect) =>
          !!r &&
          r.width > 0 &&
          r.height > 0 &&
          r.left >= pr.left - 1 &&
          r.right <= pr.right + 1 &&
          r.top >= pr.top - 1 &&
          r.bottom <= pr.bottom + 1
        return {
          panel: {x: pr.x, y: pr.y, w: pr.width, h: pr.height},
          img: {
            found: !!img,
            complete: !!img && img.complete,
            naturalWidth: img ? img.naturalWidth : 0,
            w: ir?.width ?? 0,
            h: ir?.height ?? 0
          },
          title: {
            found: !!title,
            text: title?.textContent ?? '',
            w: tr?.width ?? 0,
            h: tr?.height ?? 0,
            inPanel: inside(tr as DOMRect)
          },
          desc: {
            found: !!desc,
            w: dr?.width ?? 0,
            h: dr?.height ?? 0,
            inPanel: inside(dr as DOMRect)
          },
          classNames: {
            panel: panel.className || '',
            img: img?.className || '',
            title: title?.className || ''
          }
        }
      }, HOST_SELECTOR)

      test.expect(info, `${tmpl.name}: shadow panel not found`).not.toBeNull()
      const {panel, img, title, desc, classNames} = info!

      // CSS modules must resolve to real generated class names — an
      // `undefined` className means the module export didn't resolve.
      for (const [k, v] of Object.entries(classNames)) {
        test
          .expect(
            v.includes('undefined'),
            `${tmpl.name}: ${k} className is "${v}" — CSS module export did not resolve`
          )
          .toBe(false)
      }

      // Geometry: stylesheet says width: 315px + 2rem horizontal padding
      // (content-box) → ~347px border box. Give slack for font/scrollbar
      // differences but reject collapsed (unstyled) or full-width boxes.
      test
        .expect(
          panel.w,
          `${tmpl.name}: panel width ${panel.w}px — expected ~347px styled box (unstyled block would be full-width, broken module would collapse)`
        )
        .toBeGreaterThanOrEqual(300)
      test.expect(panel.w, `${tmpl.name}: panel too wide`).toBeLessThanOrEqual(420)
      test
        .expect(panel.h, `${tmpl.name}: panel height collapsed`)
        .toBeGreaterThanOrEqual(120)

      const vp = page.viewportSize() || {width: 1280, height: 720}
      test
        .expect(
          panel.x >= 0 &&
            panel.y >= 0 &&
            panel.x + panel.w <= vp.width + 1 &&
            panel.y + panel.h <= vp.height + 1,
          `${tmpl.name}: panel not fully inside viewport: ${JSON.stringify(panel)} vs ${vp.width}x${vp.height}`
        )
        .toBe(true)

      // Logo must have decoded — a broken chrome-extension:// URL renders a
      // 0-size or broken-image placeholder with naturalWidth 0.
      test.expect(img.found, `${tmpl.name}: logo <img> missing`).toBe(true)
      test
        .expect(
          img.complete && img.naturalWidth > 0,
          `${tmpl.name}: logo image did not load (complete=${img.complete}, naturalWidth=${img.naturalWidth})`
        )
        .toBe(true)
      test
        .expect(
          img.w,
          `${tmpl.name}: logo rendered width ${img.w}px — expected 72px from .content_logo`
        )
        .toBeGreaterThanOrEqual(60)
      test.expect(img.w).toBeLessThanOrEqual(90)

      // Title + description paint inside the panel.
      test
        .expect(title.found && title.text.includes('Content Template'), `${tmpl.name}: title missing or wrong: "${title.text}"`)
        .toBe(true)
      test
        .expect(
          title.inPanel,
          `${tmpl.name}: title does not paint inside the panel box`
        )
        .toBe(true)
      test
        .expect(desc.found && desc.inPanel, `${tmpl.name}: description missing or outside panel`)
        .toBe(true)

      // Real-pixel check: sample an 8x8 patch just inside the panel's
      // top-right corner (padding area — always background, never text/img)
      // from an actual screenshot and compare to the stylesheet background.
      if (tmpl.pixelCheck) {
        const px = Math.round(panel.x + panel.w - 14)
        const py = Math.round(panel.y + 6)
        const shot = await page.screenshot({
          clip: {x: px, y: py, width: 8, height: 8}
        })
        const png = PNG.sync.read(shot)
        let r = 0
        let g = 0
        let b = 0
        const n = png.width * png.height
        for (let i = 0; i < n; i++) {
          r += png.data[i * 4]
          g += png.data[i * 4 + 1]
          b += png.data[i * 4 + 2]
        }
        r /= n
        g /= n
        b /= n
        const dist = Math.max(
          Math.abs(r - tmpl.bg.r),
          Math.abs(g - tmpl.bg.g),
          Math.abs(b - tmpl.bg.b)
        )
        test
          .expect(
            dist,
            `${tmpl.name}: screenshot patch at (${px},${py}) averages rgb(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}) — expected rgb(${tmpl.bg.r}, ${tmpl.bg.g}, ${tmpl.bg.b}); the styled panel is not actually painted on screen`
          )
          // Tight on purpose: the host is hardened with `all: initial`, so
          // the panel must paint the exact stylesheet color. The historical
          // failure mode this guards (page CSS fading the host — example.com
          // ships div{opacity:.8}) shifts the patch by ~46/channel.
          .toBeLessThanOrEqual(12)
      }

      // Persist a full-page screenshot for human review.
      const outDir = path.join(__dirname, '..', 'test-results', 'visual-render')
      fs.mkdirSync(outDir, {recursive: true})
      await page.screenshot({
        path: path.join(outDir, `${tmpl.name}.png`)
      })
    })
  })
}
