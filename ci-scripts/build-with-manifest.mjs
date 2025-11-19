#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CWD = process.cwd();
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

function loadEnvValue(envKey, defaultValue) {
  if (process.env[envKey]) return process.env[envKey];

  const envFilesToTry = ['.env', '.env.example'];

  for (const envFile of envFilesToTry) {
    try {
      const envFilePath = path.join(REPO_ROOT, envFile);

      if (!fs.existsSync(envFilePath)) continue;

      const envFileText = fs.readFileSync(envFilePath, 'utf8');

      for (const line of envFileText.split(/\r?\n/)) {
        const keyValueMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

        if (!keyValueMatch) continue;

        const parsedKey = keyValueMatch[1];
        let parsedValue = keyValueMatch[2];
        if (parsedValue?.startsWith('"') && parsedValue?.endsWith('"')) parsedValue = parsedValue.slice(1, -1);
        if (parsedValue?.startsWith("'") && parsedValue?.endsWith("'")) parsedValue = parsedValue.slice(1, -1);
        if (parsedKey === envKey) return parsedValue;
      }
    } catch {
      // ignore
    }
  }

  return defaultValue;
}

const EXT_VERSION = loadEnvValue('EXTENSION_CLI_VERSION', 'next');

function run(cmd, args, opts = {}) {
  const mergedEnv = { ...(opts.env || process.env) };
  if (mergedEnv.FORCE_COLOR) delete mergedEnv.NO_COLOR;
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts, env: mergedEnv });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status);
}

function prefixSrc(p) {
  if (typeof p !== 'string') return p;
  if (p.startsWith('src/') || p.startsWith('/') || /^https?:\/\//.test(p)) return p;
  return `src/${p}`;
}

function transformManifestPaths(manifest) {
  const m = { ...manifest };
  if (m.icons && typeof m.icons === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(m.icons)) out[k] = prefixSrc(String(v));
    m.icons = out;
  }
  if (m.action && m.action.default_popup) m.action.default_popup = prefixSrc(m.action.default_popup);
  if (m.page_action && m.page_action.default_popup) m.page_action.default_popup = prefixSrc(m.page_action.default_popup);
  if (m.browser_action && m.browser_action.default_popup) m.browser_action.default_popup = prefixSrc(m.browser_action.default_popup);
  if (m.options_ui && m.options_ui.page) m.options_ui.page = prefixSrc(m.options_ui.page);
  if (m.devtools_page) m.devtools_page = prefixSrc(m.devtools_page);
  if (m.background && m.background.service_worker) m.background.service_worker = prefixSrc(m.background.service_worker);
  // vendor-prefixed fields
  if (m['chromium:action'] && m['chromium:action'].default_popup) m['chromium:action'].default_popup = prefixSrc(m['chromium:action'].default_popup);
  if (m['firefox:browser_action'] && m['firefox:browser_action'].default_popup) m['firefox:browser_action'].default_popup = prefixSrc(m['firefox:browser_action'].default_popup);
  if (m['chromium:side_panel'] && m['chromium:side_panel'].default_path) m['chromium:side_panel'].default_path = prefixSrc(m['chromium:side_panel'].default_path);
  if (m['firefox:sidebar_action'] && m['firefox:sidebar_action'].default_panel) m['firefox:sidebar_action'].default_panel = prefixSrc(m['firefox:sidebar_action'].default_panel);
  if (m.background && m.background['chromium:service_worker']) m.background['chromium:service_worker'] = prefixSrc(m.background['chromium:service_worker']);
  if (m.background && Array.isArray(m.background['firefox:scripts'])) m.background['firefox:scripts'] = m.background['firefox:scripts'].map(prefixSrc);
  if (Array.isArray(m.content_scripts)) {
    m.content_scripts = m.content_scripts.map((cs) => ({
      ...cs,
      js: Array.isArray(cs.js) ? cs.js.map(prefixSrc) : cs.js,
      css: Array.isArray(cs.css) ? cs.css.map(prefixSrc) : cs.css,
    }));
  }
  if (Array.isArray(m.web_accessible_resources)) {
    m.web_accessible_resources = m.web_accessible_resources.map((war) => ({
      ...war,
      resources: Array.isArray(war.resources) ? war.resources.map(prefixSrc) : war.resources,
    }));
  }
  if (m.chrome_url_overrides && typeof m.chrome_url_overrides === 'object') {
    for (const k of ['newtab', 'history', 'bookmarks']) if (m.chrome_url_overrides[k]) m.chrome_url_overrides[k] = prefixSrc(m.chrome_url_overrides[k]);
  }
  if (m.side_panel && m.side_panel.default_path) m.side_panel.default_path = prefixSrc(m.side_panel.default_path);
  // sandbox pages
  if (m.sandbox && Array.isArray(m.sandbox.pages)) m.sandbox.pages = m.sandbox.pages.map(prefixSrc);
  if (m.sandbox && typeof m.sandbox.page === 'string') m.sandbox.page = prefixSrc(m.sandbox.page);
  return m;
}

function main() {
  const mode = process.argv[2] || 'build'; // build | dev | preview
  const extraArgs = process.argv.slice(3);
  const rootManifest = path.join(CWD, 'manifest.json');
  const srcDir = path.join(CWD, 'src');
  const srcManifest = path.join(srcDir, 'manifest.json');
  let wroteTempManifest = false;

  try {
    if (fs.existsSync(srcManifest)) {
      const src = JSON.parse(fs.readFileSync(srcManifest, 'utf-8'));
      const patched = transformManifestPaths(src);
      fs.writeFileSync(rootManifest, JSON.stringify(patched, null, 2) + '\n');
      wroteTempManifest = true;
    }
    // Ensure we generate a distributable artifact we can load later:
    const args = [...extraArgs];
    const ZIP_NAME = 'extension-build.zip';
    if (!args.some((a) => String(a).startsWith('--zip'))) args.push('--zip');
    if (!args.some((a, i) => a === '--zip-filename' || String(a).startsWith('--zip-filename'))) {
      args.push('--zip-filename', ZIP_NAME);
    }
    if (!args.some((a) => a === '--silent')) args.push('--silent');

    // Always use npx with version defined via EXTENSION_CLI_VERSION (defaults to "next")
    run('npx', ['-y', `extension@${EXT_VERSION}`, mode, '.', ...args], {
      cwd: CWD,
      env: { ...process.env, EXTENSION_SKIP_INSTALL: '1' }
    });

    // If a zip was produced, extract it to a stable output directory (dist/chromium)
    try {
      const zipPath = path.join(CWD, ZIP_NAME);
      if (fs.existsSync(zipPath)) {
        const outDir = path.join(CWD, 'dist', 'chromium');
        fs.mkdirSync(outDir, { recursive: true });
        // Use system unzip
        run('unzip', ['-o', zipPath, '-d', outDir], { cwd: CWD });
        try { fs.unlinkSync(zipPath); } catch {}
      }
    } catch {}
  } finally {
    if (wroteTempManifest && fs.existsSync(rootManifest)) {
      try { fs.unlinkSync(rootManifest); } catch {}
    }
  }
}

main();


