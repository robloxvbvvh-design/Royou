// 6 карт «Копирки». Каждая собирается из блоков (один InstancedMesh на карту) + AABB-коллайдеры.
import * as THREE from 'three';
import { makeCollider } from './physics.js';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ───────────── текстуры пола ─────────────
function floorTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = rng(7);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  if (kind === 'stud') {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const cx = 32 + x * 64, cy = 32 + y * 64;
      g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.arc(cx + 2, cy + 3, 19, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(cx, cy, 18, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(cx - 4, cy - 4, 8, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128);
  } else if (kind === 'tile') {
    g.fillStyle = '#e6ecf5'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
    g.strokeStyle = 'rgba(70,90,120,.35)'; g.lineWidth = 3; g.strokeRect(1, 1, 126, 126); g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  } else if (kind === 'stone') {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const k = 0.9 + r() * 0.1; g.fillStyle = `rgb(${255 * k | 0},${255 * k | 0},${255 * k | 0})`; g.fillRect(x * 32, y * 32, 32, 32); }
    g.strokeStyle = 'rgba(40,40,50,.16)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke(); }
  } else if (kind === 'sand') {
    for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(120,80,20,.12)'; g.fillRect(r() * 128, r() * 128, 2, 2); }
  } else if (kind === 'asphalt') {
    for (let i = 0; i < 700; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.12)'; g.fillRect(r() * 128, r() * 128, 2, 2); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const texCache = {};
function getFloorTex(kind) { return texCache[kind] || (texCache[kind] = floorTexture(kind)); }

// ───────────── небо ─────────────
export function makeSky(top, bottom) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top;\nuniform vec3 bottom;\nvarying float h;\nvoid main(){\n float k = pow(clamp(h,0.0,1.0), 0.55);\n gl_FragColor = vec4(mix(bottom, top, k), 1.0);\n#include <colorspace_fragment>\n}\n',
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 14), m);
  mesh.renderOrder = -1; mesh.frustumCulled = false;
  return mesh;
}

// ───────────── построитель карт ─────────────
const UP = new THREE.Vector3(0, 1, 0);
class MB {
  constructor(seed) {
    this.group = new THREE.Group(); this.items = []; this.cols = []; this.glows = new Map(); this.upd = []; this.lights = []; this.rand = rng(seed);
    this.glassMat = new Map();
  }
  r(a = 0, b = 1) { return a + this.rand() * (b - a); }
  // x,z — центр; y — низ
  box(x, y, z, w, h, d, color, o = {}) {
    const { collide = true, walk = false, ry = 0 } = o;
    this.items.push({ x, y, z, w, h, d, color, ry });
    if (collide) this.cols.push(makeCollider(x, y, z, w, h, d, { walk }));
    return this;
  }
  glow(x, y, z, w, h, d, color, o = {}) {
    const arr = this.glows.get(color) || []; this.glows.set(color, arr);
    arr.push({ x, y, z, w, h, d, ry: o.ry || 0 });
    if (o.collide) this.cols.push(makeCollider(x, y, z, w, h, d));
    return this;
  }
  glass(x, y, z, w, h, d, color = '#9fd8ff', opacity = 0.32, collide = true) {
    const key = color + opacity;
    let mat = this.glassMat.get(key);
    if (!mat) { mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.1, metalness: 0.2, depthWrite: false }); this.glassMat.set(key, mat); }
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); this.group.add(m);
    if (collide) this.cols.push(makeCollider(x, y, z, w, h, d));
    return m;
  }
  floor(cx, cz, w, d, { y = 0, thick = 4, color = '#ffffff', tex = 'stud', tile = 8 } = {}) {
    const t = getFloorTex(tex).clone(); t.needsUpdate = true; t.repeat.set(w / tile, d / tile);
    const top = new THREE.MeshStandardMaterial({ map: t, color, roughness: 0.85 });
    const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.6), roughness: 0.9 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, thick, d), [side, side, top, side, side, side]);
    m.position.set(cx, y - thick / 2, cz); m.receiveShadow = true; this.group.add(m);
    this.cols.push(makeCollider(cx, y - thick, cz, w, thick, d, { walk: true }));
    return m;
  }
  water(cx, cz, w, d, y, color = '#3aa0e8') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.75, roughness: 0.15, metalness: 0.3 }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, y, cz); m.receiveShadow = true; this.group.add(m);
  }
  stairs(x, y, z, dir, n, w, rise, run, color, walk = false, drop = 0) {
    // dir: '+x' '-x' '+z' '-z' — куда поднимается лестница; (x,z) — начало подножия (центр по ширине)
    for (let i = 0; i < n; i++) {
      const h = rise * (i + 1), off = i * run + run / 2;
      let cx = x, cz = z, bw = w, bd = run;
      if (dir === '+x') { cx = x + off; bw = run; bd = w; } else if (dir === '-x') { cx = x - off; bw = run; bd = w; }
      else if (dir === '+z') { cz = z + off; } else { cz = z - off; }
      this.box(cx, y - drop, cz, bw, h + drop, bd, color, { walk });
    }
  }
  tree(x, z, h = 6, leaf = '#3f9a3c', y = 0) {
    this.box(x, y, z, 1.3, h, 1.3, '#7a4a24');
    this.box(x, y + h - 1.2, z, 5.6, 2.6, 5.6, leaf, { collide: false });
    this.box(x, y + h + 1.2, z, 3.8, 2.2, 3.8, this.shade(leaf, 1.12), { collide: false });
    this.box(x, y + h + 3.2, z, 2, 1.6, 2, this.shade(leaf, 1.25), { collide: false });
  }
  shade(hex, k) { return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString(); }
  crate(x, z, s = 3, color = '#a9743a', y = 0) {
    this.box(x, y, z, s, s, s, color);
    this.box(x, y + s * 0.88, z, s + 0.1, s * 0.12, s + 0.1, this.shade(color, 0.7), { collide: false });
    this.box(x, y, z, s + 0.1, s * 0.12, s + 0.1, this.shade(color, 0.7), { collide: false });
  }

  finish() {
    const dummy = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
    const unit = new THREE.BoxGeometry(1, 1, 1);
    if (this.items.length) {
      const mesh = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({ roughness: 0.82 }), this.items.length);
      this.items.forEach((it, i) => {
        q.setFromAxisAngle(UP, it.ry); p.set(it.x, it.y + it.h / 2, it.z); s.set(it.w, it.h, it.d); dummy.compose(p, q, s);
        mesh.setMatrixAt(i, dummy);
        col.set(it.color); const j = 1 + (this.rand() - 0.5) * 0.07; col.multiplyScalar(j); mesh.setColorAt(i, col);
      });
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; this.group.add(mesh);
    }
    for (const [color, arr] of this.glows) {
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4 });
      const mesh = new THREE.InstancedMesh(unit, mat, arr.length);
      arr.forEach((it, i) => { q.setFromAxisAngle(UP, it.ry); p.set(it.x, it.y + it.h / 2, it.z); s.set(it.w, it.h, it.d); dummy.compose(p, q, s); mesh.setMatrixAt(i, dummy); });
      mesh.frustumCulled = false; this.group.add(mesh);
    }
    return this;
  }
}

// ───────────── карты ─────────────
const DEFAULT_FLAGS = { A: [-56, 0, 0], B: [56, 0, 0] };

function sandbox() {
  const m = new MB(11);
  m.floor(0, 0, 170, 170, { color: '#62b84c', tex: 'stud' });
  // песочница
  m.box(0, 0, 0, 56, 0.3, 44, '#e8d28a', { walk: true });
  for (const [x, z, w, d] of [[0, -22.5, 58, 1], [0, 22.5, 58, 1], [-28.5, 0, 1, 46], [28.5, 0, 1, 46]]) m.box(x, 0, z, w, 1.0, d, '#8b5a2b');
  // игрушки
  [[-12, -8, '#e8454d'], [-8.5, -8, '#3d8bff'], [-10.2, -8, '#ffd23f', 3.1]].forEach(([x, z, c, y]) => m.box(x, y ? 3.3 : 0.3, z, 3, 3, 3, c));
  m.box(-10.2, 0.3, -11.5, 3, 3, 3, '#7cff6a'); m.box(-6, 0.3, -11.5, 3, 3, 3, '#c64dff');
  // замок из песка
  m.box(14, 0.3, 8, 10, 3, 10, '#d9bd6a'); for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) m.box(14 + dx, 0.3, 8 + dz, 3, 5, 3, '#cfae55');
  m.box(14, 3.3, 8, 4, 2, 4, '#e3c97a');
  // горка
  m.box(-15, 0.3, 12, 7, 9, 7, '#ff9b2a'); m.box(-15, 9.3, 12, 8, 0.6, 8, '#e8454d', { walk: true });
  m.stairs(-15, 0.3, 8.5, '-z', 9, 3, 1, 1.6, '#3d8bff', true);
  m.stairs(-15, 0.3, 15.5, '+z', 9, 3, 1, 1.6, '#7cff6a');
  // качели
  for (const x of [-4, 4]) { m.box(x, 0, -14, 0.8, 7, 0.8, '#d8dce6'); }
  m.box(0, 6.6, -14, 9, 0.8, 0.8, '#d8dce6', { collide: false }); m.box(-2, 2.4, -14, 1.8, 0.3, 1, '#e8454d', { collide: false }); m.box(2, 2.4, -14, 1.8, 0.3, 1, '#3d8bff', { collide: false });
  // холм
  [[30, 1.2], [22, 2.4], [14, 3.6], [7, 4.8]].forEach(([s, h]) => m.box(38, 0, -40, s, h, s, '#58a844', { walk: false }));
  m.tree(38, -40, 5, '#3f9a3c', 4.8);
  // пруд
  m.box(-38, 0, -36, 28, 0.25, 22, '#e8d28a', { walk: true }); m.water(-38, -36, 22, 16, 0.3);
  // столы и скамейки
  for (const [x, z] of [[-26, 46], [26, 46], [-26, -50], [30, -18]]) { m.box(x, 0, z, 6, 2.4, 3, '#a9743a'); m.box(x, 0, z + 3.6, 6, 1.2, 1, '#8f5f2e'); m.box(x, 0, z - 3.6, 6, 1.2, 1, '#8f5f2e'); }
  // деревья
  for (let i = 0, n = 0; i < 200 && n < 34; i++) {
    const x = m.r(-64, 64), z = m.r(-64, 64);
    if ((Math.abs(x) < 32 && Math.abs(z) < 28) || Math.hypot(Math.abs(x) - 56, z) < 12) continue;
    if (Math.hypot(x + 38, z + 36) < 18 || Math.hypot(x - 38, z + 40) < 20 || Math.hypot(x + 26, z - 46) < 8) continue;
    m.tree(x, z, m.r(5, 8), m.rand() > 0.5 ? '#3f9a3c' : '#4aa845'); n++;
  }
  // кусты и забор
  for (let i = 0; i < 18; i++) { const x = m.r(-66, 66), z = m.r(-66, 66); if (Math.abs(x) < 30 && Math.abs(z) < 26) continue; if (Math.hypot(Math.abs(x) - 56, z) < 10) continue; m.box(x, 0, z, 3, 2.2, 3, '#2f8a3a'); }
  for (const [x, z, w, d] of [[0, -69.5, 140, 1.2], [0, 69.5, 140, 1.2], [-69.5, 0, 1.2, 140], [69.5, 0, 1.2, 140]]) { m.box(x, 0, z, w, 3, d, '#c8964f'); m.box(x, 3, z, w, 0.6, d, '#a9743a', { collide: false }); }
  m.finish();
  return { m, bounds: { x: 67, z: 67 }, sky: ['#5db6ff', '#e4f4ff'], fog: ['#e4f4ff', 110, 330], sun: { color: '#fff1d0', intensity: 2.6, pos: [60, 90, 40] }, hemi: ['#bfe3ff', '#6a8a4a', 1.0] };
}

function city() {
  const m = new MB(22);
  m.floor(0, 0, 170, 170, { color: '#4a4d57', tex: 'asphalt', tile: 12 });
  // тротуары
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(sx * 41, 0, sz * 41, 66, 0.35, 66, '#a9adb8', { walk: true });
  // разметка
  for (let i = -72; i < 72; i += 8) { if (Math.abs(i) < 10) continue; m.box(i, 0.02, 0, 4, 0.05, 0.5, '#f2f2f2', { collide: false }); m.box(0, 0.02, i, 0.5, 0.05, 4, '#f2f2f2', { collide: false }); }
  for (let i = -6; i <= 6; i += 2) { m.box(i, 0.02, -9.5, 1, 0.05, 3, '#e8e8e8', { collide: false }); m.box(i, 0.02, 9.5, 1, 0.05, 3, '#e8e8e8', { collide: false }); m.box(-9.5, 0.02, i, 3, 0.05, 1, '#e8e8e8', { collide: false }); m.box(9.5, 0.02, i, 3, 0.05, 1, '#e8e8e8', { collide: false }); }
  const building = (x, z, w, d, h, color, roof = '#555b66') => {
    m.box(x, 0.35, z, w, h, d, color);
    m.box(x, 0.35 + h, z, w + 0.8, 0.8, d + 0.8, roof, { collide: false });
    const wc = '#2c3d55';
    const floors = Math.floor((h - 2) / 4);
    for (let f = 0; f < floors; f++) {
      const y = 0.35 + 2.2 + f * 4;
      for (let i = 0; i < Math.floor(w / 4) - 0; i++) { const wx = x - w / 2 + 2.5 + i * 4; if (wx > x + w / 2 - 1.5) break; m.box(wx, y, z - d / 2 - 0.05, 2.2, 2.2, 0.15, wc, { collide: false }); m.box(wx, y, z + d / 2 + 0.05, 2.2, 2.2, 0.15, wc, { collide: false }); }
      for (let i = 0; i < Math.floor(d / 4) - 0; i++) { const wz = z - d / 2 + 2.5 + i * 4; if (wz > z + d / 2 - 1.5) break; m.box(x - w / 2 - 0.05, y, wz, 0.15, 2.2, 2.2, wc, { collide: false }); m.box(x + w / 2 + 0.05, y, wz, 0.15, 2.2, 2.2, wc, { collide: false }); }
    }
  };
  building(32, 32, 16, 14, 9, '#c0714f'); building(58, 30, 14, 22, 24, '#6b86a6'); building(34, 60, 22, 14, 14, '#d0b878');
  building(-32, 34, 14, 16, 22, '#8a6aa8'); building(-58, 32, 14, 16, 12, '#5aa78a'); building(-34, 60, 20, 14, 18, '#d4806a');
  building(32, -34, 16, 14, 9, '#7a8ca8'); building(58, -34, 14, 18, 18, '#b8605a'); building(34, -62, 20, 12, 12, '#68a07a');
  building(-34, -34, 18, 14, 20, '#a08a6a'); building(-60, -32, 12, 16, 10, '#7a6aa0'); building(-32, -62, 22, 12, 16, '#c8a05a');
  // лестницы на низкие крыши
  m.stairs(32, 0.35, 9, '+z', 9, 4, 1, 1.5, '#8a8f9a', true);
  m.stairs(32, 0.35, -9, '-z', 9, 4, 1, 1.5, '#8a8f9a', true);
  // машины
  const car = (x, z, along, color) => {
    const L = 8, W = 4;
    const bw = along === 'x' ? L : W, bd = along === 'x' ? W : L;
    m.box(x, 0.5, z, bw, 1.6, bd, color); m.box(x, 2.1, z, along === 'x' ? 4 : 3.2, 1.4, along === 'x' ? 3.2 : 4, m.shade(color, 0.85));
    m.box(x, 2.3, z, along === 'x' ? 4.1 : 3.3, 0.9, along === 'x' ? 3.3 : 4.1, '#9fd0f0', { collide: false });
    for (const a of [-2.6, 2.6]) for (const b of [-1.9, 1.9]) m.box(along === 'x' ? x + a : x + b, 0, along === 'x' ? z + b : z + a, along === 'x' ? 1.6 : 0.5, 1.2, along === 'x' ? 0.5 : 1.6, '#1a1a1e', { collide: false });
  };
  car(-24, 4, 'x', '#e8454d'); car(22, -4, 'x', '#ffd23f'); car(-44, -4, 'x', '#3d8bff'); car(46, 4, 'x', '#f2f2f2');
  car(4, -26, 'z', '#7cff6a'); car(-4, 24, 'z', '#ff8a2a'); car(4, 48, 'z', '#c64dff'); car(-4, -46, 'z', '#2b2b30');
  // контейнеры и баррикады
  [[-14, 0, 12, 5, 5, '#e8454d', 0], [14, 0, 12, 5, 5, '#3d8bff', 0]].forEach(([x, z, w, h, d, c]) => m.box(x, 0, z + 14 * (x < 0 ? 1 : -1) * 0.0, w, h, d, c));
  m.box(0, 0, 0, 7, 3, 7, '#b0b4c0'); m.box(0, 3, 0, 4, 2, 4, '#c8ccd8');
  for (const [x, z] of [[-18, -16], [18, 16], [-18, 16], [18, -16]]) { m.box(x, 0, z, 6, 2.2, 1.4, '#e8a02a'); m.box(x, 0, z, 6, 0.6, 1.5, '#222', { collide: false, ry: 0 }); }
  // фонари
  for (let i = -56; i <= 56; i += 28) for (const s of [-1, 1]) { m.box(i, 0.35, s * 10.5, 0.4, 7, 0.4, '#3a3d46'); m.glow(i, 7.2, s * 10.5, 1.4, 0.4, 1.4, '#ffe9a0'); m.box(10.5 * s, 0.35, i, 0.4, 7, 0.4, '#3a3d46'); m.glow(10.5 * s, 7.2, i, 1.4, 0.4, 1.4, '#ffe9a0'); }
  // граница
  for (const [x, z, w, d] of [[0, -80, 170, 3], [0, 80, 170, 3], [-80, 0, 3, 170], [80, 0, 3, 170]]) m.box(x, 0, z, w, 8, d, '#6b6f7b');
  m.finish();
  return { m, bounds: { x: 76, z: 76 }, sky: ['#5aa8f0', '#cfe0f2'], fog: ['#cfe0f2', 90, 280], sun: { color: '#fff4dc', intensity: 2.4, pos: [-50, 100, 60] }, hemi: ['#b8d4f0', '#5a5a64', 0.95] };
}

function castle() {
  const m = new MB(33);
  m.floor(0, 0, 170, 170, { color: '#8b8d96', tex: 'stone', tile: 20 });
  const S = '#8f929c', D = '#7a7d88';
  // внешние стены
  for (const [x, z, w, d] of [[0, -78, 160, 4], [0, 78, 160, 4], [-78, 0, 4, 160], [78, 0, 4, 160]]) {
    m.box(x, 0, z, w, 14, d, S);
    const along = w > d;
    for (let k = -76; k <= 76; k += 6) m.box(along ? k : x, 14, along ? z : k, along ? 3 : w, 2, along ? d : 3, D, { collide: false });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.box(sx * 70, 0, sz * 70, 14, 22, 14, '#85888f');
    for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5], [0, -6], [0, 6], [-6, 0], [6, 0]]) m.box(sx * 70 + dx, 22, sz * 70 + dz, 3, 2.5, 3, D, { collide: false });
    m.box(sx * 70, 22, sz * 70, 9, 6, 9, '#c0393f', { collide: false });
  }
  // донжон (полый, с четырьмя входами)
  const K = 14, T = 2, H = 18, DW = 4;
  const wallZ = (z) => { m.box(-(K + DW) / 2 + 0, 0, z, K - DW, H, T, S); m.box((K + DW) / 2, 0, z, K - DW, H, T, S); m.box(0, 9, z, DW * 2, H - 9, T, '#7d808b'); };
  const wallX = (x) => { m.box(x, 0, -(K + DW) / 2, T, H, K - DW, S); m.box(x, 0, (K + DW) / 2, T, H, K - DW, S); m.box(x, 9, 0, T, H - 9, DW * 2, '#7d808b'); };
  wallZ(-K + 1); wallZ(K - 1); wallX(-K + 1); wallX(K - 1);
  // крыша-кольцо с отверстием, лестница внутри вдоль западной стены
  m.box(-10, 18, 0, 8, 1, 28, '#6e717c', { walk: true }); m.box(10, 18, 0, 8, 1, 28, '#6e717c'); m.box(0, 18, -10, 12, 1, 8, '#6e717c'); m.box(0, 18, 10, 12, 1, 8, '#6e717c');
  m.stairs(-10.5, 0, -12, '+z', 18, 3, 1, 1.25, '#9a9ca6', true);
  for (let k = -13; k <= 13; k += 4) { for (const e of [-14, 14]) { m.box(k, 19, e, 2.4, 1.6, 1, D, { collide: false }); m.box(e, 19, k, 1, 1.6, 2.4, D, { collide: false }); } }
  m.glow(0, 12, -K, 1, 1, 1, '#ffb347', { collide: false });
  // флаг-баннеры на стенах
  for (const [x, z, ry] of [[-10, -K - 0.3, 0], [10, -K - 0.3, 0], [-10, K + 0.3, 0], [10, K + 0.3, 0]]) m.box(x, 8, z, 2.4, 8, 0.2, '#c0393f', { collide: false, ry });
  // внутренние укрытия
  for (const [x, z, s] of [[-28, -26, 4], [28, 26, 4], [-30, 24, 3], [30, -24, 3], [-48, 14, 3.5], [48, -14, 3.5], [-18, 44, 4], [18, -44, 4], [-52, -38, 3], [52, 38, 3], [0, 52, 3.4], [0, -52, 3.4]]) m.crate(x, z, s, '#9b6a3a');
  for (const [x, z, w, d] of [[-34, 0, 2, 14], [34, 0, 2, 14], [0, 36, 16, 2], [0, -36, 16, 2], [-46, -26, 12, 2], [46, 26, 12, 2]]) { m.box(x, 0, z, w, 5, d, '#8b8e98'); m.box(x, 5, z, w, 1.2, d, D, { collide: false }); }
  for (const [x, z] of [[-24, 36], [24, -36], [-40, -50], [40, 50], [-60, 20], [60, -20]]) { m.box(x, 0, z, 3, 3.4, 3, '#8a5a2a'); m.box(x, 3.4, z, 3.2, 0.3, 3.2, '#c9a05a', { collide: false }); }
  // факелы
  for (const [x, z] of [[-20, -20], [20, 20], [-20, 20], [20, -20], [-56, -8], [-56, 8], [56, -8], [56, 8]]) { m.box(x, 0, z, 0.6, 5, 0.6, '#3a2a1a'); m.glow(x, 5, z, 1.1, 1.4, 1.1, '#ff9a2a'); m.lights.push({ x, y: 6.5, z, color: '#ff9a3a', i: 60, d: 28 }); }
  // стены баз
  for (const s of [-1, 1]) { m.box(s * 70, 0, -22, 12, 7, 2, D); m.box(s * 70, 0, 22, 12, 7, 2, D); m.box(s * 64, 0, 0, 1, 0.2, 14, s < 0 ? '#3d8bff' : '#ff4d6d', { collide: false }); }
  m.finish();
  m.lights.length = 4;
  return { m, bounds: { x: 74, z: 74 }, sky: ['#6aa8e0', '#e8d9c0'], fog: ['#e8d9c0', 90, 300], sun: { color: '#ffe8c0', intensity: 2.5, pos: [40, 100, -50] }, hemi: ['#c8d8f0', '#6a5a4a', 0.95] };
}

function lab() {
  const m = new MB(44);
  m.floor(0, 0, 170, 170, { color: '#c9d3e2', tex: 'tile', tile: 14 });
  const W = '#dfe6f0', W2 = '#c3cede';
  for (const [x, z, w, d] of [[0, -66, 140, 3], [0, 66, 140, 3], [-66, 0, 3, 140], [66, 0, 3, 140]]) {
    m.box(x, 0, z, w, 16, d, W); m.glow(x, 6, z + (d > w ? 0 : (z < 0 ? 1.55 : -1.55)), d > w ? 0.2 : w, 0.5, d > w ? w : 0.2, '#38d6ff', { collide: false });
  }
  // реактор
  m.box(0, 0, 0, 14, 1, 14, '#56627a'); m.box(0, 1, 0, 11, 0.6, 11, '#3f4a60');
  m.glass(0, 1.6, 0, 8, 13, 8, '#7fffd0', 0.28); m.glow(0, 2, 0, 3.6, 12, 3.6, '#41ff9a', { collide: true });
  m.box(0, 14.6, 0, 9, 1.4, 9, '#56627a', { collide: false });
  for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) { m.box(x, 0, z, 4, 3, 2, '#2c3446'); m.glow(x, 3, z - 0.2, 3.2, 1.6, 0.2, '#38d6ff', { ry: 0 }); }
  // лабораторные столы
  for (const [x, z, ry] of [[-34, -26, 0], [-34, 26, 0], [34, -26, 0], [34, 26, 0], [-18, 42, 1], [18, -42, 1], [-18, -42, 1], [18, 42, 1]]) {
    const w = ry ? 3 : 10, d = ry ? 10 : 3;
    m.box(x, 0, z, w, 3, d, '#eef2f8'); m.box(x, 0, z, w - 0.4, 2.6, d - 0.4, '#5d6d88', { collide: false }); m.box(x, 3, z, w + 0.2, 0.3, d + 0.2, '#2c3446', { collide: false });
    m.glow(x, 3.3, z, 0.8, 0.9, 0.8, ['#ff4d6d', '#41ff9a', '#c64dff', '#ffd23f'][(Math.abs(x + z) | 0) % 4], { collide: false });
  }
  // серверные стойки
  for (let i = -3; i <= 3; i++) { const x = i * 8; m.box(x, 0, -61, 5, 9, 3, '#242b3a'); m.glow(x, 2 + ((i + 3) % 3) * 2, -59.4, 3.6, 0.35, 0.1, i % 2 ? '#41ff9a' : '#38d6ff', { collide: false }); m.glow(x, 6.5, -59.4, 3.6, 0.35, 0.1, '#ffd23f', { collide: false }); }
  // стеклянные перегородки
  for (const [x, z, w, d] of [[-24, 0, 0.6, 18], [24, 0, 0.6, 18], [-48, -42, 16, 0.6], [48, 42, 16, 0.6], [-48, 42, 16, 0.6], [48, -42, 16, 0.6]]) { m.glass(x, 0, z, w, 9, d, '#9fd8ff', 0.3); m.box(x, 0, z, w + (d > w ? 0.2 : 0.4), 0.6, d + (w > d ? 0.2 : 0.4), '#56627a', { collide: false }); }
  // мостик
  m.box(0, 6, 54, 40, 1, 8, '#7a8499', { walk: false });
  for (const sx of [-1, 1]) m.box(sx * 19.5, 7, 54, 1, 1.4, 8, '#4a5468', { collide: false });
  m.box(0, 7, 58, 40, 1.4, 0.5, '#4a5468', { collide: true }); m.box(0, 7, 50.2, 40, 1.4, 0.5, '#4a5468');
  m.stairs(-22.5, 0, 54, '-x', 6, 6, 1, 3.2, '#8a94a8', true); m.stairs(22.5, 0, 54, '+x', 6, 6, 1, 3.2, '#8a94a8', true);
  // потолок
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(136, 1, 136), new THREE.MeshStandardMaterial({ color: '#b6c2d4', roughness: 0.8 }));
  ceil.position.set(0, 16.5, 0); ceil.userData.ceiling = true; m.group.add(ceil);
  for (let x = -48; x <= 48; x += 24) for (let z = -48; z <= 48; z += 24) m.glow(x, 15.8, z, 8, 0.3, 8, '#f4fbff', { collide: false });
  // трубы по потолку
  for (const x of [-56, 56]) m.box(x, 13, 0, 1.2, 1.2, 130, '#8a94a8', { collide: false });
  m.finish();
  return { m, bounds: { x: 63, z: 63 }, sky: ['#222a3a', '#222a3a'], fog: ['#202838', 120, 320], sun: { color: '#e8f2ff', intensity: 1.0, pos: [20, 80, 30] }, hemi: ['#e6f0ff', '#8a96aa', 1.0], noSky: true, indoor: true };
}

function skyIslands() {
  const m = new MB(55);
  const island = (cx, cy, cz, w, d, grass = '#62b84c') => {
    m.box(cx, cy - 1.2, cz, w, 1.2, d, grass, { walk: true });
    m.box(cx, cy - 1.2, cz, w + 0.1, 0.5, d + 0.1, '#58a844', { collide: false });
    let ww = w - 2, dd = d - 2, y = cy - 1.2;
    const cols = ['#8a5a30', '#7a4f2a', '#74747e', '#66666f', '#5a5a64', '#4e4e58'];
    for (let i = 0; i < 6; i++) { const h = 3 - i * 0.3; y -= h; m.box(cx + m.r(-1, 1), y, cz + m.r(-1, 1), Math.max(3, ww), h, Math.max(3, dd), cols[i], { collide: false }); ww *= 0.72; dd *= 0.72; }
  };
  island(-50, 0, 0, 36, 44); island(50, 0, 0, 36, 44); island(0, 0, 0, 32, 32);
  island(-20, 8, -52, 22, 22, '#6cc255'); island(22, 8, 52, 22, 22, '#6cc255');
  // мосты
  for (const sx of [-1, 1]) {
    m.box(sx * 25.5, -0.9, 0, 18, 0.9, 6, '#a9743a', { walk: true });
    for (let k = 0; k < 6; k++) m.box(sx * (17.5 + k * 3.4), -0.95, 0, 0.5, 1, 6.2, '#7a4a24', { collide: false });
    for (const z of [-3, 3]) { m.box(sx * 25.5, 0, z, 18, 1.1, 0.4, '#7a4a24', { collide: false }); }
  }
  // лестница на северный остров, батут на южный
  m.stairs(-12, 0, -15.5, '-z', 8, 5, 1, 4.2, '#a8a8b4', true, 8);
  // руины в центре
  for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) { m.box(x, 0, z, 2.4, 9, 2.4, '#b8b8c4'); m.box(x, 9, z, 3, 0.8, 3, '#9a9aa6', { collide: false }); }
  m.box(0, 9, -8, 16, 1, 2.4, '#b8b8c4', { collide: false });
  m.crate(0, 0, 3, '#9b6a3a'); m.crate(-12, 10, 2.6, '#9b6a3a'); m.crate(12, -10, 2.6, '#9b6a3a');
  // острова армий: укрытия и деревья
  for (const sx of [-1, 1]) { m.crate(sx * 44, -12, 3, '#9b6a3a'); m.crate(sx * 40, 14, 3.4, '#9b6a3a'); m.box(sx * 38, 0, 0, 2, 4, 12, '#a8a8b4'); m.tree(sx * 62, -16, 6); m.tree(sx * 62, 16, 7); m.tree(sx * 46, 18, 5); m.tree(sx * 66, 0, 6); }
  m.tree(-20, -52, 6, '#4aa845', 8); m.tree(30, 50, 6, '#4aa845', 8); m.crate(-24, -48, 3, '#9b6a3a', 8); m.crate(14.5, 57, 3, '#9b6a3a', 8);
  // облака
  const cl = [];
  for (let i = 0; i < 16; i++) { const g = new THREE.Group(); const x = m.r(-110, 110), y = m.r(-25, 25), z = m.r(-110, 110); if (Math.abs(x) < 80 && Math.abs(z) < 80 && y > -8) continue; for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(m.r(10, 20), m.r(4, 7), m.r(8, 14)), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#cfe6ff', emissiveIntensity: 0.35 })); b.position.set(j * 8 - 12, m.r(-1, 2), m.r(-3, 3)); g.add(b); } g.position.set(x, y, z); m.group.add(g); cl.push(g); }
  m.upd.push(t => cl.forEach((g, i) => { g.position.x += Math.sin(t * 0.05 + i) * 0.01; }));
  m.finish();
  const pads = [{ x: 12, y: 0, z: 12, r: 2.6, vx: 11.6, vy: 74, vz: 41.7 }, { x: 22, y: 8, z: 59, r: 2.6, vx: -26, vy: 60, vz: -50 }];
  const padMeshes = pads.map(p => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.3, 20), new THREE.MeshStandardMaterial({ color: '#41ff9a', emissive: '#41ff9a', emissiveIntensity: 1.4 })); b.position.y = 0.15; g.add(b); g.position.set(p.x, p.y, p.z); m.group.add(g); return b; });
  m.upd.push(t => padMeshes.forEach((b, i) => { b.scale.y = 1 + Math.sin(t * 6 + i) * 0.4; }));
  return { m, bounds: { x: 72, z: 72 }, sky: ['#3a8ee8', '#bfe4ff'], fog: ['#bfe4ff', 120, 400], sun: { color: '#fff8e0', intensity: 2.8, pos: [50, 120, 30] }, hemi: ['#c8e6ff', '#7a9a5a', 1.1], killY: -40, pads, floating: true, waypoints: [{ x: -50, z: 0 }, { x: -26, z: 0 }, { x: -12, z: 0 }, { x: 0, z: 0 }, { x: 12, z: 0 }, { x: 26, z: 0 }, { x: 50, z: 0 }] };
}

function arena() {
  const m = new MB(66);
  m.floor(0, 0, 170, 170, { color: '#dcc17e', tex: 'sand', tile: 12 });
  // стены арены с четырьмя воротами
  const R = 70, WH = 11;
  for (const s of [-1, 1]) {
    for (const o of [-1, 1]) {
      m.box(o * 41, 0, s * R, 58, WH, 3, '#b59255'); m.box(s * R, 0, o * 41, 3, WH, 58, '#b59255');
      m.box(o * 41, WH, s * R, 58, 1, 4, '#a07e45', { collide: false }); m.box(s * R, WH, o * 41, 4, 1, 58, '#a07e45', { collide: false });
    }
    m.box(0, 8, s * R, 12, 3, 3, '#a07e45'); m.box(s * R, 8, 0, 3, 3, 12, '#a07e45');
  }
  for (let k = -66; k <= 66; k += 8) for (const s of [-1, 1]) { if (Math.abs(k) < 8) continue; m.box(k, WH + 1, s * R, 4, 2, 3.2, '#8d6f3c', { collide: false }); m.box(s * R, WH + 1, k, 3.2, 2, 4, '#8d6f3c', { collide: false }); }
  // трибуны (за стенами)
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const o = R + 3 + i * 2.6; m.box(0, 0, s * o, 150 - i * 2, 5 + i * 1.6, 2.6, i % 2 ? '#8a6a3a' : '#a07e45', { collide: false }); m.box(s * o, 0, 0, 2.6, 5 + i * 1.6, 150 - i * 2, i % 2 ? '#8a6a3a' : '#a07e45', { collide: false }); }
  // колонны
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; m.box(Math.cos(a) * 40, 0, Math.sin(a) * 40, 4, 12, 4, '#d8c8a0'); m.box(Math.cos(a) * 40, 12, Math.sin(a) * 40, 5, 1.2, 5, '#b8a880', { collide: false }); }
  // костёр
  m.box(0, 0, 0, 14, 1.4, 14, '#6a6258'); m.box(0, 1.4, 0, 10, 0.6, 10, '#4a4238');
  const fl = []; for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2 - i * 0.2, 4 + i * 0.5, 2 - i * 0.2), new THREE.MeshStandardMaterial({ color: ['#ff3b1f', '#ff7a1a', '#ffb02a', '#ffd23f', '#fff1a0'][i], emissive: ['#ff3b1f', '#ff7a1a', '#ffb02a', '#ffd23f', '#fff1a0'][i], emissiveIntensity: 1.8 })); b.position.set((i - 2) * 1.3, 3.5, (i % 2 ? 1 : -1) * 1.2); m.group.add(b); fl.push(b); }
  m.upd.push(t => fl.forEach((b, i) => { b.scale.y = 1 + Math.sin(t * 8 + i * 1.7) * 0.25; b.rotation.y = t * 2 + i; }));
  m.lights.push({ x: 0, y: 6, z: 0, color: '#ff8a2a', i: 120, d: 60 });
  // платформы с лестницами и укрытия
  for (const [x, z, st] of [[-30, -30, '+x'], [30, 30, '-x'], [-30, 30, '+z'], [30, -30, '-z']]) {
    m.box(x, 0, z, 14, 2.4, 14, '#c8a868', { walk: false });
    const off = 7 + 4 * 1.4 + 0.7;
    const sx = st === '+x' ? x - 7 : st === '-x' ? x + 7 : x, sz = st === '+z' ? z - 7 : st === '-z' ? z + 7 : z;
    m.stairs(sx - (st === '+x' ? 4 * 1.4 : st === '-x' ? -4 * 1.4 : 0), 0, sz - (st === '+z' ? 4 * 1.4 : st === '-z' ? -4 * 1.4 : 0), st, 3, 5, 0.8, 1.4, '#c8a868', true);
  }
  for (const [x, z, w, d] of [[-16, -50, 10, 2], [16, 50, 10, 2], [-50, 18, 2, 10], [50, -18, 2, 10], [20, 20, 6, 2], [-20, -20, 6, 2], [22, -22, 2, 6], [-22, 22, 2, 6], [0, 24, 3, 3], [0, -24, 3, 3]]) m.box(x, 0, z, w, 4.5, d, '#bfa066');
  for (const [x, z] of [[-60, -40], [60, 40], [-60, 40], [60, -40]]) m.crate(x, z, 3, '#a9743a');
  // знамёна
  for (const [x, z, ry] of [[-20, -R + 1.6, 0], [20, -R + 1.6, 0], [-20, R - 1.6, 0], [20, R - 1.6, 0], [-R + 1.6, -20, 1], [-R + 1.6, 20, 1], [R - 1.6, -20, 1], [R - 1.6, 20, 1]]) m.box(x, 4, z, ry ? 0.2 : 3, 7, ry ? 3 : 0.2, '#c0393f', { collide: false });
  m.finish();
  return { m, bounds: { x: 67, z: 67 }, sky: ['#f0a050', '#ffe6b8'], fog: ['#ffe6b8', 90, 300], sun: { color: '#ffd9a0', intensity: 2.6, pos: [-60, 70, 50] }, hemi: ['#ffe4c0', '#8a6a3a', 0.95] };
}

const BUILDERS = { sandbox, city, castle, lab, sky: skyIslands, arena };

export function buildMap(id) {
  const raw = (BUILDERS[id] || sandbox)();
  const { m } = raw;
  const b = raw.bounds;
  const map = {
    id, group: m.group, colliders: m.cols, bounds: b, killY: raw.killY ?? -60, sky: raw.sky, fog: raw.fog, sun: raw.sun, hemi: raw.hemi,
    lights: m.lights, update: t => m.upd.forEach(f => f(t)), pads: raw.pads || [], noSky: !!raw.noSky, indoor: !!raw.indoor, floating: !!raw.floating, waypoints: raw.waypoints || null,
    flags: { A: new THREE.Vector3(...DEFAULT_FLAGS.A), B: new THREE.Vector3(...DEFAULT_FLAGS.B) },
    zones: {
      A: { x0: -b.x + 4, x1: -b.x * 0.55, z0: -b.z * 0.7, z1: b.z * 0.7 },
      B: { x0: b.x * 0.55, x1: b.x - 4, z0: -b.z * 0.7, z1: b.z * 0.7 },
      ALL: { x0: -b.x + 6, x1: b.x - 6, z0: -b.z + 6, z1: b.z - 6 },
    },
  };
  if (id === 'sky') { map.flags.A.set(-56, 0, 0); map.flags.B.set(56, 0, 0); map.zones.A = { x0: -66, x1: -38, z0: -18, z1: 18 }; map.zones.B = { x0: 38, x1: 66, z0: -18, z1: 18 }; }
  return map;
}
