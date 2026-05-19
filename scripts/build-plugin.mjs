#!/usr/bin/env node
// Build dist/claude-like-plugin.html by inlining compiled SCSS and bundled JS into plugin/template.html.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as sass from 'sass';
import { build as esbuild } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function buildCSS() {
  const entry = resolve(root, 'scss/plugin.scss');
  if (!(await fileExists(entry))) {
    throw new Error(`[build-plugin] Required source missing: ${entry}`);
  }
  const { css } = await sass.compileAsync(entry, { style: 'compressed', loadPaths: [resolve(root, 'scss')] });
  return css;
}

async function buildJS() {
  const entry = resolve(root, 'js/_bootstrap.js');
  if (!(await fileExists(entry))) {
    throw new Error(`[build-plugin] Required source missing: ${entry}`);
  }
  const result = await esbuild({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    target: ['es2020'],
    legalComments: 'none',
  });
  return result.outputFiles[0].text;
}

async function readVersion() {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  return pkg.version || '0.0.0';
}

async function main() {
  const [css, js, version] = await Promise.all([buildCSS(), buildJS(), readVersion()]);
  const tpl = await readFile(resolve(root, 'plugin/template.html'), 'utf8');
  const out = tpl
    .replaceAll('{{PLUGIN_CSS}}', css)
    .replaceAll('{{PLUGIN_JS}}', js)
    .replaceAll('{{VERSION}}', version);

  const distDir = resolve(root, 'dist');
  await mkdir(distDir, { recursive: true });
  await writeFile(resolve(distDir, 'claude-like-plugin.html'), out, 'utf8');

  const bytes = Buffer.byteLength(out, 'utf8');
  const kb = (bytes / 1024).toFixed(1);
  console.log(`[build-plugin] dist/claude-like-plugin.html written: ${kb} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
