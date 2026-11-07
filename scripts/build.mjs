// Сборка всех моделей в GLB: node scripts/build.mjs [id-фильтр]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { CATEGORIES } from '../src/registry.js';
import { finalize, stats } from '../src/lib.js';

// GLTFExporter ожидает браузерный FileReader — подставляем минимальную реализацию для Node.
globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); }
  readAsDataURL(b) {
    b.arrayBuffer().then((r) => {
      this.result = `data:${b.type || 'application/octet-stream'};base64,${Buffer.from(r).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'models');
const only = process.argv[2];
const manifestPath = path.join(outDir, 'manifest.json');
const prev = fs.existsSync(manifestPath) && only ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;

const manifest = { generated: new Date().toISOString(), up: 'Y', forward: '+Z', unit: 'metre', categories: [] };
let total = 0, bytes = 0;

for (const cat of CATEGORIES) {
  const entries = [];
  for (const [id, title, build] of cat.list) {
    if (only && !id.includes(only)) {
      const old = prev?.categories.find((c) => c.id === cat.id)?.models.find((m) => m.id === id);
      if (old) entries.push(old);
      continue;
    }
    const t0 = performance.now();
    const { object, animations = [] } = build();
    finalize(object);
    const st = stats(object);
    const glb = await new GLTFExporter().parseAsync(object, { binary: true, animations, onlyVisible: false });
    const dir = path.join(outDir, cat.id);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${id}.glb`);
    fs.writeFileSync(file, Buffer.from(glb));
    total++; bytes += glb.byteLength;
    entries.push({
      id, title, file: `${cat.id}/${id}.glb`, bytes: glb.byteLength, ...st,
      animations: animations.map((a) => a.name),
    });
    console.log(`${cat.id}/${id}.glb`.padEnd(40), `${String(st.triangles).padStart(7)} tris`, `${(glb.byteLength / 1024).toFixed(0).padStart(6)} KB`,
      `${(performance.now() - t0).toFixed(0)}ms`, animations.length ? `[${animations.map((a) => a.name).join(', ')}]` : '');
  }
  manifest.categories.push({ id: cat.id, title: cat.title, models: entries });
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nГотово: ${total} моделей, ${(bytes / 1024 / 1024).toFixed(2)} МБ`);
