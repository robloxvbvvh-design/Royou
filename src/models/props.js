// Предметы, валюта, питомцы и значки «Копирки».
import * as THREE from 'three';
import { stdMat } from './characters.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function add(parent, mesh, x = 0, y = 0, z = 0) { mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; }
const box = (p, w, h, d, c, x, y, z, o) => add(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stdMat(c, o)), x, y, z);
const cyl = (p, rt, rb, h, c, x, y, z, o, seg = 20) => add(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), stdMat(c, o)), x, y, z);
const cone = (p, r, h, c, x, y, z, o, seg = 4) => add(p, new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), stdMat(c, o)), x, y, z);

const GOLD = { rough: 0.25, metal: 0.9, emissive: '#6b4a00', ei: 0.5 };

// ───────────── валюта ─────────────
export function buildCoin() {
  const g = new THREE.Group();
  const face = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#ffc928'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d99a00'; c.lineWidth = 8; c.beginPath(); c.arc(64, 64, 52, 0, 7); c.stroke();
    c.fillStyle = '#b87a00'; c.font = 'bold 82px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 66, 70);
    c.fillStyle = '#fff3a6'; c.fillText('$', 62, 66);
  });
  const sideM = stdMat('#e8a800', GOLD);
  const faceM = new THREE.MeshStandardMaterial({ map: face, roughness: 0.3, metalness: 0.7 });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.22, 36), [sideM, faceM, faceM]);
  coin.rotation.x = Math.PI / 2; coin.castShadow = true; g.add(coin);
  return g;
}

export function buildCoinStack() {
  const g = new THREE.Group();
  [[0, 0, 0], [1.7, 0, 0.4], [0.7, 0, 1.6]].forEach(([x, , z], k) => {
    for (let i = 0; i < 4 - k; i++) {
      const c = cyl(g, 0.8, 0.8, 0.22, i % 2 ? '#f5b800' : '#ffd23f', x, 0.12 + i * 0.24, z, GOLD, 24);
      c.rotation.y = i * 0.5;
    }
  });
  return g;
}

export function buildGem() {
  const g = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(1, 0);
  geo.scale(0.9, 1.25, 0.9);
  const m = new THREE.MeshStandardMaterial({ color: '#a54dff', flatShading: true, roughness: 0.15, metalness: 0.25, emissive: '#5a14b8', emissiveIntensity: 0.7 });
  const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; g.add(mesh);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: '#e0b8ff', flatShading: true, emissive: '#c88cff', emissiveIntensity: 1.1 }));
  core.scale.set(0.9, 1.25, 0.9); g.add(core);
  return g;
}

export function buildCrown() {
  const g = new THREE.Group();
  cyl(g, 1.0, 1.1, 0.7, '#ffcc22', 0, 0.35, 0, GOLD, 5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
    const c = cone(g, 0.32, 1.0, '#ffd84a', Math.sin(a) * 0.95, 1.1, Math.cos(a) * 0.95, GOLD, 4);
    cyl(g, 0.16, 0.16, 0.16, i % 2 ? '#ff4a6a' : '#46c8ff', Math.sin(a) * 0.95, 1.7, Math.cos(a) * 0.95, { emissive: i % 2 ? '#ff2a4a' : '#1aa0e8', ei: 1.0 }, 8);
  }
  return g;
}

// ───────────── предметы коллекции ─────────────
export function buildGift() {
  const g = new THREE.Group();
  box(g, 2.2, 1.7, 2.2, '#e8344c', 0, 0.85, 0);
  box(g, 2.4, 0.5, 2.4, '#ff4560', 0, 1.9, 0);
  box(g, 0.5, 1.8, 2.24, '#ffd23f', 0, 0.9, 0); box(g, 2.24, 1.8, 0.5, '#ffd23f', 0, 0.9, 0);
  box(g, 0.5, 0.52, 2.44, '#ffd23f', 0, 1.9, 0); box(g, 2.44, 0.52, 0.5, '#ffd23f', 0, 1.9, 0);
  for (const s of [-1, 1]) { const b = box(g, 0.9, 0.5, 0.5, '#ffd23f', s * 0.55, 2.35, 0); b.rotation.z = s * -0.5; }
  box(g, 0.5, 0.5, 0.5, '#ffb800', 0, 2.3, 0);
  return g;
}

export function buildTrophy() {
  const g = new THREE.Group();
  box(g, 2.0, 0.4, 2.0, '#3a2a1a', 0, 0.2, 0); box(g, 1.5, 0.35, 1.5, '#5a3e24', 0, 0.55, 0);
  cyl(g, 0.3, 0.45, 1.3, '#ffcc22', 0, 1.35, 0, GOLD);
  cyl(g, 1.25, 0.55, 1.5, '#ffd84a', 0, 2.7, 0, GOLD, 28);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 8, 18), stdMat('#ffcc22', GOLD));
    h.position.set(s * 1.3, 2.8, 0); h.rotation.y = 0; h.rotation.z = s * 0.2; h.castShadow = true; g.add(h);
  }
  cone(g, 0.3, 0.5, '#fff1a0', 0, 3.7, 0, { emissive: '#ffcc00', ei: 0.6 }, 5).rotation.x = Math.PI;
  return g;
}

export function buildPodium() {
  const g = new THREE.Group();
  const num = (n, c) => new THREE.MeshStandardMaterial({
    map: canvasTex(64, 64, (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = 'bold 44px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n, 32, 34); }), roughness: 0.5,
  });
  const col = [['2', '#aab2c0', -1.6, 1.2], ['1', '#f2b81c', 0, 1.9], ['3', '#c47a3a', 1.6, 0.8]];
  col.forEach(([n, c, x, h]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 1.5), [stdMat(c), stdMat(c), stdMat(c), stdMat(c), stdMat(c), num(n, c)]);
    add(g, m, x, h / 2, 0);
  });
  const star = cone(g, 0.45, 0.9, '#ffd23f', 0, 2.5, 0, { ...GOLD }, 5); star.rotation.x = Math.PI;
  return g;
}

export function buildScroll() {
  const g = new THREE.Group();
  const paper = canvasTex(128, 192, (c, w, h) => {
    c.fillStyle = '#f2dfae'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#8a6a30'; c.lineWidth = 4;
    for (let y = 30; y < 170; y += 24) { c.beginPath(); c.moveTo(22, y); c.lineTo(106 - (y % 3) * 10, y); c.stroke(); }
    c.fillStyle = '#c0282d'; c.beginPath(); c.arc(96, 160, 12, 0, 7); c.fill();
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.08), new THREE.MeshStandardMaterial({ map: paper, roughness: 0.9 }));
  add(g, m, 0, 1.4, 0);
  for (const y of [0.15, 2.65]) { const c = cyl(g, 0.22, 0.22, 2.2, '#8a4a22', 0, y, 0); c.rotation.z = Math.PI / 2; cyl(g, 0.3, 0.3, 0.12, '#e8c04a', 1.12, y, 0, GOLD).rotation.z = Math.PI / 2; cyl(g, 0.3, 0.3, 0.12, '#e8c04a', -1.12, y, 0, GOLD).rotation.z = Math.PI / 2; }
  return g;
}

export function buildFlag(color = '#3d8bff') {
  const g = new THREE.Group();
  cyl(g, 0.12, 0.12, 8, '#d8dce6', 0, 4, 0, { metal: 0.7, rough: 0.3 }, 10);
  add(g, new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), stdMat('#ffd23f', GOLD)), 0, 8.1, 0);
  const cloth = new THREE.Group(); cloth.position.set(0, 7.2, 0); g.add(cloth);
  const segs = [];
  for (let i = 0; i < 6; i++) {
    const s = box(cloth, 0.45, 2.2, 0.08, color, 0.3 + i * 0.44, 0, 0, { emissive: color, ei: 0.25, side: THREE.DoubleSide });
    segs.push(s);
  }
  g.userData.segs = segs;
  box(g, 1.4, 0.3, 1.4, '#333a48', 0, 0.15, 0);
  return g;
}
export function waveFlag(flag, t) {
  const segs = flag.userData.segs; if (!segs) return;
  segs.forEach((s, i) => { s.position.z = Math.sin(t * 5 - i * 0.9) * 0.12 * (i + 1) * 0.5; s.rotation.y = Math.sin(t * 5 - i * 0.9) * 0.18; });
}

export function buildMedkit() {
  const g = new THREE.Group();
  box(g, 1.6, 1.1, 1.1, '#f5f5f5', 0, 0.55, 0);
  box(g, 0.34, 0.8, 1.14, '#e83a4a', 0, 0.58, 0); box(g, 0.8, 0.34, 1.14, '#e83a4a', 0, 0.58, 0);
  box(g, 0.7, 0.14, 0.4, '#bdbdbd', 0, 1.14, 0);
  return g;
}
export function buildAmmoBox() {
  const g = new THREE.Group();
  box(g, 1.7, 1.0, 1.1, '#4a6b34', 0, 0.5, 0);
  box(g, 1.76, 0.18, 1.16, '#38502a', 0, 1.0, 0);
  for (let i = 0; i < 3; i++) { box(g, 0.16, 0.5, 0.06, '#ffcc33', -0.4 + i * 0.4, 0.5, -0.58, { metal: 0.6 }); }
  return g;
}

// ───────────── питомцы ─────────────
export function buildPet(id) {
  const g = new THREE.Group();
  const pet = { root: g, tail: [], parts: {} };
  const eye = (p, x, y, z) => box(p, 0.14, 0.18, 0.06, '#111', x, y, z);
  if (id === 'cat') {
    const c = '#f0a040', w = '#ffffff';
    box(g, 0.95, 0.8, 1.7, c, 0, 1.0, 0); box(g, 0.7, 0.5, 1.2, w, 0, 0.78, -0.05);
    const head = new THREE.Group(); head.position.set(0, 1.45, -1.0); g.add(head);
    box(head, 1.05, 0.9, 0.9, c, 0, 0, 0);
    for (const s of [-1, 1]) {
      cone(head, 0.26, 0.5, c, s * 0.34, 0.65, 0, undefined, 3);
      cone(head, 0.14, 0.34, '#ffb5cc', s * 0.34, 0.62, -0.08, undefined, 3);
      eye(head, s * 0.25, 0.1, -0.46);
      box(head, 0.5, 0.02, 0.02, '#d88a30', s * 0.5, -0.1, -0.46).rotation.z = s * 0.12; // усы
    }
    box(head, 0.2, 0.14, 0.06, '#ff7aa0', 0, -0.08, -0.46);
    for (const [x, z] of [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.55], [0.3, 0.55]]) box(g, 0.28, 0.7, 0.28, z < 0 ? w : c, x, 0.35, z);
    let cur = g; const tg = new THREE.Group(); tg.position.set(0, 1.2, 0.85); g.add(tg); cur = tg;
    for (let i = 0; i < 4; i++) { const s = new THREE.Group(); s.position.y = i ? 0.38 : 0; cur.add(s); box(s, 0.22, 0.5, 0.22, i === 3 ? w : c, 0, 0.2, 0); s.rotation.x = 0.3; cur = s; pet.tail.push(s); }
    tg.rotation.x = 0.5;
    pet.parts.head = head;
  } else if (id === 'dog') {
    const c = '#b9824a', d = '#7a4a22';
    box(g, 1.0, 0.9, 1.9, c, 0, 1.05, 0); box(g, 1.04, 0.5, 0.8, '#f2e2c8', 0, 0.85, -0.3);
    const head = new THREE.Group(); head.position.set(0, 1.65, -1.1); g.add(head);
    box(head, 1.0, 0.9, 0.9, c, 0, 0, 0); box(head, 0.56, 0.4, 0.5, '#f2e2c8', 0, -0.18, -0.6); box(head, 0.2, 0.16, 0.1, '#111', 0, -0.05, -0.86);
    box(head, 0.2, 0.06, 0.3, '#ff7a90', 0, -0.4, -0.7);
    for (const s of [-1, 1]) { box(head, 0.2, 0.75, 0.5, d, s * 0.6, 0.0, 0.1).rotation.z = s * 0.15; eye(head, s * 0.25, 0.15, -0.46); }
    for (const [x, z] of [[-0.32, -0.7], [0.32, -0.7], [-0.32, 0.7], [0.32, 0.7]]) box(g, 0.3, 0.75, 0.3, c, x, 0.37, z);
    const tg = new THREE.Group(); tg.position.set(0, 1.35, 0.95); g.add(tg); box(tg, 0.22, 0.8, 0.22, c, 0, 0.35, 0); tg.rotation.x = 0.7; pet.tail.push(tg);
    pet.parts.head = head;
  } else { // dragon
    const c = '#e8483a', y = '#ffd47a', d = '#8a1a14';
    box(g, 1.0, 0.9, 1.7, c, 0, 1.1, 0); box(g, 0.7, 0.5, 1.4, y, 0, 0.9, -0.1);
    const head = new THREE.Group(); head.position.set(0, 1.75, -1.0); g.add(head);
    box(head, 0.95, 0.85, 0.9, c, 0, 0, 0); box(head, 0.6, 0.4, 0.5, c, 0, -0.18, -0.6);
    for (const s of [-1, 1]) { eye(head, s * 0.26, 0.12, -0.46); cone(head, 0.1, 0.5, '#ffe9b0', s * 0.3, 0.65, 0.1, undefined, 4).rotation.z = -s * 0.3; }
    for (let i = 0; i < 4; i++) cone(g, 0.18, 0.4, d, 0, 1.7, 0.5 - i * 0.45, undefined, 4);
    for (const [x, z] of [[-0.34, -0.55], [0.34, -0.55], [-0.34, 0.55], [0.34, 0.55]]) box(g, 0.3, 0.7, 0.3, c, x, 0.35, z);
    let cur = new THREE.Group(); cur.position.set(0, 1.0, 0.8); g.add(cur);
    for (let i = 0; i < 4; i++) { const s = new THREE.Group(); s.position.z = i ? 0.45 : 0; cur.add(s); box(s, 0.5 - i * 0.08, 0.45 - i * 0.05, 0.55, c, 0, 0, 0.2); s.rotation.x = -0.15; cur = s; pet.tail.push(s); }
    cone(cur, 0.22, 0.45, d, 0, 0, 0.7, undefined, 3).rotation.x = Math.PI / 2;
    pet.wings = [];
    for (const s of [-1, 1]) {
      const wg = new THREE.Group(); wg.position.set(s * 0.45, 1.6, 0.1); g.add(wg);
      const sh = new THREE.Shape(); [[0, 0], [1.2, 0.9], [1.9, 0.3], [1.5, -0.2], [1.1, -0.45], [0.6, -0.3]].forEach(([x, yy], i) => (i ? sh.lineTo(x * s, yy) : sh.moveTo(x * s, yy)));
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false }), stdMat('#c02a22', { side: THREE.DoubleSide }));
      m.castShadow = true; wg.add(m); pet.wings.push({ g: wg, s });
    }
    pet.parts.head = head;
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return pet;
}
export function updatePet(pet, t, moving) {
  pet.tail.forEach((s, i) => { s.rotation.z = Math.sin(t * (moving ? 9 : 4) + i * 0.8) * (moving ? 0.35 : 0.2); });
  if (pet.wings) pet.wings.forEach(w => { w.g.rotation.z = w.s * (0.35 + Math.sin(t * (moving ? 12 : 5)) * 0.35); });
  if (pet.parts.head) pet.parts.head.rotation.x = Math.sin(t * 2) * 0.05;
}

// ───────────── значки-наклейки (векторные, без эмодзи) ─────────────
export function stickerCanvas(id, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const s = size / 128;
  g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
  const poly = (pts, fill, stroke) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 6; g.stroke(); } };
  if (id === 'crown') {
    poly([[14, 100], [8, 40], [36, 66], [64, 26], [92, 66], [120, 40], [114, 100]], '#ffcc22', '#a87400');
    [[36, 66], [64, 26], [92, 66]].forEach(([x, y], i) => { g.fillStyle = ['#ff4a6a', '#46c8ff', '#ff4a6a'][i]; g.beginPath(); g.arc(x, y + (i === 1 ? -2 : 0), 7, 0, 7); g.fill(); });
  } else if (id === 'skull') {
    g.fillStyle = '#f2f2f2'; g.strokeStyle = '#222'; g.lineWidth = 6;
    g.beginPath(); g.arc(64, 54, 40, Math.PI, 0); g.lineTo(100, 82); g.lineTo(84, 82); g.lineTo(84, 104); g.lineTo(44, 104); g.lineTo(44, 82); g.lineTo(28, 82); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#222'; g.beginPath(); g.arc(48, 62, 10, 0, 7); g.arc(80, 62, 10, 0, 7); g.fill(); poly([[64, 74], [58, 86], [70, 86]], '#222');
  } else if (id === 'heart') {
    g.fillStyle = '#ff4a6a'; g.strokeStyle = '#a01834'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(64, 108); g.bezierCurveTo(8, 70, 18, 20, 64, 46); g.bezierCurveTo(110, 20, 120, 70, 64, 108); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(40, 44, 8, 5, -0.6, 0, 7); g.fill();
  } else if (id === 'star') {
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 26 : 56; pts.push([64 + Math.cos(a) * r, 68 + Math.sin(a) * r]); }
    poly(pts, '#ffd23f', '#b38600');
  } else if (id === 'fire') {
    g.fillStyle = '#ff7a1a'; g.strokeStyle = '#b83a00'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(64, 10); g.bezierCurveTo(70, 40, 108, 54, 100, 88); g.bezierCurveTo(96, 112, 74, 120, 64, 120); g.bezierCurveTo(40, 120, 20, 104, 26, 76); g.bezierCurveTo(30, 60, 48, 56, 50, 36); g.bezierCurveTo(58, 44, 60, 30, 64, 10); g.fill(); g.stroke();
    g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(64, 92, 20, 24, 0, 0, 7); g.fill();
  }
  return c;
}

export function buildStickerSprite(id) {
  const t = new THREE.CanvasTexture(stickerCanvas(id, 128)); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.6, 1.6, 1);
  return s;
}

// Цвета эффектов убийства
export const EFFECT_STYLE = {
  confetti: { colors: ['#ff4a6a', '#ffd23f', '#46c8ff', '#7cff6a', '#c64dff'], gravity: 24, speed: 14, size: 0.28, count: 32 },
  fire: { colors: ['#ff3b1f', '#ff7a1a', '#ffd23f'], gravity: -10, speed: 8, size: 0.4, count: 30 },
  hearts: { colors: ['#ff4a6a', '#ff8aa8', '#ffb3c6'], gravity: -6, speed: 7, size: 0.36, count: 22 },
  stars: { colors: ['#ffd23f', '#fff1a0', '#ffffff'], gravity: 4, speed: 12, size: 0.3, count: 28 },
};
