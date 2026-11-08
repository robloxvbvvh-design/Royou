// Собирает игру в ОДИН файл dist/kopirka.html — его можно открыть двойным кликом, без сервера.
// Запуск: npm install && npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = (p) => join(root, p);

const result = await build({
  entryPoints: [r('src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  alias: { three: r('vendor/three.module.min.js') },
  legalComments: 'inline',
  logLevel: 'info',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

let html = readFileSync(r('index.html'), 'utf8');
const css = readFileSync(r('styles.css'), 'utf8');
html = html
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/, () => `<script>${js}</script>`);

mkdirSync(r('dist'), { recursive: true });
writeFileSync(r('dist/kopirka.html'), html);
console.log(`dist/kopirka.html — ${(html.length / 1024).toFixed(0)} КБ`);
