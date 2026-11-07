// Проверка всех GLB официальным валидатором Khronos: node scripts/validate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import validator from 'gltf-validator';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'models');
const files = fs.readdirSync(root, { recursive: true }).filter((f) => f.endsWith('.glb')).sort();
let errors = 0, warnings = 0;
for (const f of files) {
  const bytes = new Uint8Array(fs.readFileSync(path.join(root, f)));
  const rep = await validator.validateBytes(bytes, { uri: f, maxIssues: 50 });
  const { numErrors: e, numWarnings: w, numInfos: i } = rep.issues;
  errors += e; warnings += w;
  const bad = rep.issues.messages.filter((m) => m.severity <= 1);
  console.log(`${e ? '✗' : '✓'} ${f.padEnd(38)} errors:${e} warnings:${w} info:${i}`);
  bad.slice(0, 4).forEach((m) => console.log(`    [${m.severity ? 'warn' : 'ERR'}] ${m.code}: ${m.message} @ ${m.pointer}`));
}
console.log(`\nФайлов: ${files.length}, ошибок: ${errors}, предупреждений: ${warnings}`);
process.exit(errors ? 1 : 0);
