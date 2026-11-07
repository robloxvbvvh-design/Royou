// Пять локаций-диорам (≈36×36 м). Рельеф с плоскими гранями и вершинными цветами, объекты объединены по материалам.
// Пустые узлы-якоря для гейм-дизайна: PlayerStart, EnemySpawn_##, ChestSpot_##, CampfireSpot, ExitPortal, BossSpot.
import {
  THREE, P, mat, M, G, rbox, cyl, cone, sph, tor, oct, tube, flat, flameGeo, mergeGeometries, makeNoise, rng, finalize, clip, track, lathe, makeCrown,
} from './lib.js';

const V3 = THREE.Vector3;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// материалы с вершинными цветами
const ENV = mat('Env', 0xffffff, { rough: 0.95, vc: true });
const ENV_GLOSS = mat('EnvGloss', 0xffffff, { rough: 0.22, metal: 0.05, vc: true });
const ENV_METAL = mat('EnvMetal', 0xffffff, { rough: 0.4, metal: 0.8, vc: true });

class Batch {
  constructor() { this.map = new Map(); }
  add(material, geo, { p = [0, 0, 0], r = [0, 0, 0], s = 1, color = 0xffffff } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    const sc = typeof s === 'number' ? new V3(s, s, s) : new V3(...s);
    g.applyMatrix4(new THREE.Matrix4().compose(new V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), sc));
    g.computeVertexNormals();
    if (material.vertexColors) {
      const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    if (!this.map.has(material)) this.map.set(material, []);
    this.map.get(material).push(g);
  }
  build(parent, prefix) {
    for (const [m, list] of this.map) {
      const geo = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(geo, m); mesh.name = `${prefix}_${m.name}`;
      parent.add(mesh);
    }
  }
}

/** Лёгкая вариация цвета. */
function tint(hex, rnd, amt = 0.08) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h + (rnd() - 0.5) * amt * 0.4, hsl.s, Math.min(1, Math.max(0, hsl.l + (rnd() - 0.5) * amt)));
  return c.getHex();
}

// ─────────────── базовые формы ───────────────
const gIco0 = new THREE.IcosahedronGeometry(1, 0);
const gIco1 = new THREE.IcosahedronGeometry(1, 1);
const gDode = new THREE.DodecahedronGeometry(1, 0);
const gOct = new THREE.OctahedronGeometry(1, 0);
const gCone = (seg) => new THREE.ConeGeometry(1, 1, seg);
const gCyl = (seg) => new THREE.CylinderGeometry(1, 1, 1, seg);
const gBox = new THREE.BoxGeometry(1, 1, 1);
const gCone5 = gCone(5), gCone6 = gCone(6), gCone7 = gCone(7), gCone8 = gCone(8), gCone3 = gCone(3), gCone4 = gCone(4);
const gCyl6 = gCyl(6), gCyl8 = gCyl(8), gCyl10 = gCyl(10), gCyl14 = gCyl(14);

function jitterGeo(base, rnd, amt = 0.2) {
  const g = base.index ? base.toNonIndexed() : base.clone();
  const p = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(k)) seen.set(k, [(rnd() - 0.5) * amt, (rnd() - 0.5) * amt, (rnd() - 0.5) * amt]);
    const j = seen.get(k);
    p.setXYZ(i, p.getX(i) + j[0], p.getY(i) + j[1], p.getZ(i) + j[2]);
  }
  return g;
}

// ─────────────── рельеф ───────────────
/**
 * @param height (x,z)→y   @param colorAt (x,z,y,slope)→hex
 */
function makeTerrain({ size = 36, seg = 72, height, colorAt, skirtColor = 0x3a2a1e, skirtDepth = 1.4 }) {
  const half = size / 2, step = size / seg;
  const H = [];
  for (let j = 0; j <= seg; j++) { H.push([]); for (let i = 0; i <= seg; i++) H[j].push(height(-half + i * step, -half + j * step)); }
  const pos = [], col = [];
  const tmp = new THREE.Color();
  const pushTri = (a, b, c, hex) => {
    tmp.set(hex);
    [a, b, c].forEach((v) => { pos.push(v[0], v[1], v[2]); col.push(tmp.r, tmp.g, tmp.b); });
  };
  const slopeAt = (i, j) => {
    const h = H[j][i];
    return Math.max(Math.abs(h - H[j][Math.min(seg, i + 1)]), Math.abs(h - H[Math.min(seg, j + 1)][i])) / step;
  };
  for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
    const x0 = -half + i * step, z0 = -half + j * step;
    const a = [x0, H[j][i], z0], b = [x0 + step, H[j][i + 1], z0], c = [x0, H[j + 1][i], z0 + step], d = [x0 + step, H[j + 1][i + 1], z0 + step];
    // диагональ выбираем по неровности для более естественной огранки
    const flip = (i + j) % 2 === 0;
    const sl = slopeAt(i, j);
    if (flip) {
      pushTri(a, c, b, colorAt((x0 + step * 0.33), (z0 + step * 0.33), (a[1] + b[1] + c[1]) / 3, sl));
      pushTri(b, c, d, colorAt((x0 + step * 0.66), (z0 + step * 0.66), (b[1] + c[1] + d[1]) / 3, sl));
    } else {
      pushTri(a, c, d, colorAt((x0 + step * 0.33), (z0 + step * 0.66), (a[1] + c[1] + d[1]) / 3, sl));
      pushTri(a, d, b, colorAt((x0 + step * 0.66), (z0 + step * 0.33), (a[1] + d[1] + b[1]) / 3, sl));
    }
  }
  // юбка по периметру
  const bottom = -skirtDepth;
  const sk = new THREE.Color(skirtColor);
  const wall = (p0, p1, h0, h1) => {
    const A = [p0[0], h0, p0[1]], B = [p1[0], h1, p1[1]], C = [p0[0], bottom, p0[1]], D = [p1[0], bottom, p1[1]];
    pushTri(A, B, C, skirtColor); pushTri(B, D, C, skirtColor);
  };
  for (let i = 0; i < seg; i++) {
    const x0 = -half + i * step;
    wall([x0 + step, -half], [x0, -half], H[0][i + 1], H[0][i]);          // север (−Z)
    wall([x0, half], [x0 + step, half], H[seg][i], H[seg][i + 1]);         // юг (+Z)
    wall([-half, x0], [-half, x0 + step], H[i][0], H[i + 1][0]);           // запад
    wall([half, x0 + step], [half, x0], H[i + 1][seg], H[i][seg]);         // восток
  }
  // дно
  const bc = [[-half, bottom, -half], [half, bottom, -half], [half, bottom, half], [-half, bottom, half]];
  pushTri(bc[0], bc[1], bc[2], skirtColor); pushTri(bc[0], bc[2], bc[3], skirtColor);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

const edgeRise = (x, z, amt = 3, from = 0.55) => {
  const d = Math.max(Math.abs(x), Math.abs(z)) / 18;
  return sstep(from, 1.05, d) * amt;
};

/** Точки по сетке с отбором: ok(x,z)→bool, минимальное расстояние между точками. */
function scatter(n, rnd, ok, minDist = 1.2, tries = 400, range = 17) {
  const pts = [];
  let t = 0;
  while (pts.length < n && t++ < n * tries) {
    const x = (rnd() * 2 - 1) * range, z = (rnd() * 2 - 1) * range;
    if (!ok(x, z)) continue;
    if (pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < minDist)) continue;
    pts.push([x, z]);
  }
  return pts;
}

// ─────────────── растительность и прочее ───────────────
function addDecidTree(b, x, y, z, s, rnd, pal) {
  const trunk = tint(pal.trunk, rnd, 0.1);
  b.add(ENV, gCyl8, { p: [x, y + 0.7 * s, z], s: [0.16 * s, 1.5 * s, 0.16 * s], color: trunk });
  b.add(ENV, gCone8, { p: [x, y + 0.05 * s, z], s: [0.26 * s, 0.4 * s, 0.26 * s], color: trunk });
  const n = 3;
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, rr = i === 0 ? 0 : 0.5 * s;
    const R = (1.0 - i * 0.12) * s * (0.9 + rnd() * 0.3);
    b.add(ENV, jitterGeo(gIco1, rnd, 0.35), { p: [x + Math.cos(a) * rr, y + (1.9 + i * 0.35) * s, z + Math.sin(a) * rr], s: R, r: [rnd() * 3, rnd() * 3, 0], color: tint(pal.leaf[i % pal.leaf.length], rnd, 0.12) });
  }
}
function addPine(b, x, y, z, s, rnd, pal) {
  b.add(ENV, gCyl6, { p: [x, y + 0.35 * s, z], s: [0.14 * s, 0.9 * s, 0.14 * s], color: pal.trunk });
  for (let i = 0; i < 4; i++) {
    const r = (1.05 - i * 0.22) * s, h = (1.0 - i * 0.08) * s;
    const yy = y + (0.7 + i * 0.62) * s;
    b.add(ENV, gCone7, { p: [x, yy + h / 2, z], s: [r, h, r], r: [0, rnd() * 3, 0], color: tint(pal.leaf, rnd, 0.1) });
    if (pal.snow) b.add(ENV, gCone7, { p: [x, yy + h * 0.72 + 0.02 * s, z], s: [r * 0.62, h * 0.5, r * 0.62], r: [0, 0, 0], color: pal.snow });
  }
}
function addRock(b, x, y, z, s, rnd, c1, c2 = null) {
  const g = jitterGeo(gDode, rnd, 0.35);
  b.add(ENV, g, { p: [x, y + s * 0.25, z], s: [s * (1 + rnd() * 0.5), s * (0.6 + rnd() * 0.4), s * (1 + rnd() * 0.4)], r: [rnd(), rnd() * 6, rnd()], color: tint(c1, rnd, 0.14) });
  if (c2 !== null) b.add(ENV, jitterGeo(gIco0, rnd, 0.2), { p: [x, y + s * 0.62, z], s: [s * 0.75, s * 0.28, s * 0.75], color: c2 });
}
function addBush(b, x, y, z, s, rnd, c) {
  for (let i = 0; i < 3; i++) b.add(ENV, jitterGeo(gIco1, rnd, 0.3), { p: [x + (rnd() - 0.5) * s, y + s * 0.35, z + (rnd() - 0.5) * s], s: s * (0.55 + rnd() * 0.3), color: tint(c, rnd, 0.12) });
}
function addFlower(b, x, y, z, s, rnd, c) {
  b.add(ENV, gCyl6, { p: [x, y + 0.12 * s, z], s: [0.012 * s, 0.26 * s, 0.012 * s], color: 0x3c8a3c });
  b.add(ENV, gIco0, { p: [x, y + 0.27 * s, z], s: 0.07 * s, color: c });
}
function addMushroom(b, x, y, z, s, capColor, spots = true) {
  b.add(ENV, gCyl6, { p: [x, y + 0.12 * s, z], s: [0.06 * s, 0.24 * s, 0.06 * s], color: 0xf1e6cf });
  b.add(ENV, gCone8, { p: [x, y + 0.3 * s, z], s: [0.2 * s, 0.2 * s, 0.2 * s], color: capColor });
  if (spots) for (let i = 0; i < 3; i++) { const a = i * 2.1; b.add(ENV, gIco0, { p: [x + Math.cos(a) * 0.08 * s, y + 0.36 * s, z + Math.sin(a) * 0.08 * s], s: 0.03 * s, color: 0xffffff }); }
}
function addGrassTufts(b, x, y, z, s, rnd, c) {
  for (let i = 0; i < 3; i++) b.add(ENV, gCone3, { p: [x + (rnd() - 0.5) * 0.2, y + 0.14 * s, z + (rnd() - 0.5) * 0.2], s: [0.05 * s, 0.3 * s * (0.7 + rnd() * 0.6), 0.05 * s], r: [(rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4], color: tint(c, rnd, 0.1) });
}
function addCrystals(b, mat0, x, y, z, s, rnd, n = 4) {
  for (let i = 0; i < n; i++) {
    const h = (0.6 + rnd() * 0.9) * s, r = 0.12 * s * (0.7 + rnd() * 0.6);
    const a = rnd() * 6.28, d = i === 0 ? 0 : 0.2 * s;
    b.add(mat0, gCone6, { p: [x + Math.cos(a) * d, y + h / 2 + 0.05, z + Math.sin(a) * d], s: [r, h, r], r: [(rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.5], color: 0xffffff });
  }
}
function addGravestone(b, x, y, z, s, rnd, c) {
  const rot = (rnd() - 0.5) * 0.4;
  b.add(ENV, gBox, { p: [x, y + 0.3 * s, z], s: [0.4 * s, 0.6 * s, 0.1 * s], r: [0, rot, (rnd() - 0.5) * 0.2], color: tint(c, rnd, 0.1) });
  b.add(ENV, gCyl8, { p: [x, y + 0.6 * s, z], s: [0.2 * s, 0.1 * s, 0.2 * s], r: [Math.PI / 2, 0, rot], color: tint(c, rnd, 0.1) });
  b.add(ENV, gBox, { p: [x, y + 0.04, z], s: [0.55 * s, 0.08, 0.3 * s], r: [0, rot, 0], color: 0x4a4a5c });
}
function addDeadTree(b, x, y, z, s, rnd, c) {
  const lean = (rnd() - 0.5) * 0.8;
  const pts = [[0, 0, 0], [lean * 0.4, 0.8 * s, 0.1], [lean * 0.8, 1.6 * s, -0.1], [lean * 1.1, 2.4 * s, 0.1]];
  b.add(ENV, tube(pts, [0.2 * s, 0.14 * s, 0.1 * s, 0.03 * s], { radial: 5, segs: 8 }), { p: [x, y, z], r: [0, rnd() * 6, 0], color: c });
  for (let i = 0; i < 3; i++) {
    const a = rnd() * 6.28, h = (1.0 + i * 0.5) * s, L = (0.8 + rnd() * 0.5) * s;
    const bp = [[lean * (h / 2.4) * 1.0, h, 0], [lean * (h / 2.4) + Math.cos(a) * L * 0.5, h + 0.3 * s, Math.sin(a) * L * 0.5], [lean * (h / 2.4) + Math.cos(a) * L, h + 0.5 * s + rnd() * 0.3, Math.sin(a) * L]];
    b.add(ENV, tube(bp, [0.07 * s, 0.045 * s, 0.01], { radial: 4, segs: 5 }), { p: [x, y, z], color: c });
  }
}

/** Лента вдоль кривой (лава, дорога, ручей): points — [[x,z],...], width, y. */
function ribbon(points, width, y, subdiv = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new V3(x, 0, z)));
  const n = points.length * subdiv;
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
    const nx = -tg.z, nz = tg.x;
    const w = typeof width === 'function' ? width(t) : width;
    pos.push(p.x + nx * w / 2, y, p.z + nz * w / 2, p.x - nx * w / 2, y, p.z - nz * w / 2);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return { geo: g, curve };
}
function distToPolyline(curve, x, z, samples = 80) {
  let best = 1e9, bt = 0;
  for (let i = 0; i <= samples; i++) {
    const p = curve.getPointAt(i / samples);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) { best = d; bt = i / samples; }
  }
  return [best, bt];
}

function anchors(root, hFn, spec) {
  const g = G('Anchors'); root.add(g);
  for (const [name, x, z, extraY = 0] of spec) g.add(G(name, [x, hFn(x, z) + extraY, z]));
  return g;
}
const lineup = (n, f) => Array.from({ length: n }, (_, i) => f(i));

// ═══════════════════════════ 1. Зелёный лес ═══════════════════════════
export function locGreenForest() {
  const root = G('Loc_GreenForest');
  const noise = makeNoise(11), rnd = rng(101);
  const pathPts = [[-1, -18], [3, -11], [-1, -4], [-4, 3], [1, 9], [3, 18]];
  const pathCurve = new THREE.CatmullRomCurve3(pathPts.map(([x, z]) => new V3(x, 0, z)));
  const pond = { x: 9, z: 4, r: 4.2 };
  const baseH = (x, z) => (noise(x * 0.07 + 3, z * 0.07 + 5) - 0.5) * 4.0 + edgeRise(x, z, 3.2);
  const height = (x, z) => {
    let h = baseH(x, z);
    const [d] = distToPolyline(pathCurve, x, z, 60);
    h = lerp(0.1, h, sstep(1.6, 4.2, d));
    const pd = Math.hypot(x - pond.x, z - pond.z);
    h = lerp(-0.55, h, sstep(pond.r * 0.5, pond.r * 1.25, pd));
    return h;
  };
  const grass = [0x52b043, 0x479d3b, 0x5fbf50];
  const colorAt = (x, z, y, sl) => {
    const [d] = distToPolyline(pathCurve, x, z, 60);
    if (d < 1.55) return 0xb98b58;
    if (d < 2.0) return 0x9ab05a;
    if (Math.hypot(x - pond.x, z - pond.z) < pond.r * 0.95) return 0xcdb882;
    if (sl > 0.9) return 0x8a8a7a;
    const n = noise(x * 0.5, z * 0.5, 2);
    return grass[Math.min(2, Math.floor(n * 3))];
  };
  const terrain = makeTerrain({ height, colorAt, skirtColor: 0x5a3d26 });
  root.add(new THREE.Mesh(terrain, ENV)); root.children[0].name = 'Terrain';
  const b = new Batch();
  const pal = { trunk: 0x7a4e2a, leaf: [0x2f9a3a, 0x3fb049, 0x58c653] };
  const okForest = (x, z) => {
    const [d] = distToPolyline(pathCurve, x, z, 40);
    return d > 2.6 && Math.hypot(x - pond.x, z - pond.z) > pond.r * 1.15;
  };
  scatter(42, rnd, okForest, 2.4).forEach(([x, z]) => addDecidTree(b, x, height(x, z), z, 0.9 + rnd() * 0.7, rnd, pal));
  scatter(10, rnd, (x, z) => okForest(x, z) && Math.abs(x) > 8, 2.4).forEach(([x, z]) => addPine(b, x, height(x, z), z, 1.2 + rnd() * 0.5, rnd, { trunk: 0x6a4426, leaf: 0x2a7a3a }));
  scatter(24, rnd, (x, z) => okForest(x, z) || distToPolyline(pathCurve, x, z, 40)[0] > 1.9, 1.6).forEach(([x, z]) => addBush(b, x, height(x, z), z, 0.7 + rnd() * 0.5, rnd, 0x3f9f3c));
  scatter(14, rnd, okForest, 1.8).forEach(([x, z]) => addRock(b, x, height(x, z), z, 0.35 + rnd() * 0.5, rnd, 0x8a909c));
  const fcols = [0xff6b9a, 0xffd84a, 0xffffff, 0x6aa8ff, 0xff9a3a];
  scatter(90, rnd, (x, z) => distToPolyline(pathCurve, x, z, 40)[0] > 2.1 && Math.hypot(x - pond.x, z - pond.z) > pond.r, 0.5).forEach(([x, z]) => addFlower(b, x, height(x, z), z, 1 + rnd() * 0.6, rnd, fcols[Math.floor(rnd() * 5)]));
  scatter(120, rnd, (x, z) => distToPolyline(pathCurve, x, z, 40)[0] > 1.7, 0.7).forEach(([x, z]) => addGrassTufts(b, x, height(x, z), z, 1.1, rnd, 0x3f9f3c));
  scatter(9, rnd, okForest, 2.0).forEach(([x, z]) => addMushroom(b, x, height(x, z), z, 1 + rnd() * 0.5, 0xd8352b));
  // кувшинки/камыш у пруда
  for (let i = 0; i < 12; i++) { const a = rnd() * 6.28, d = pond.r * (0.9 + rnd() * 0.15); addGrassTufts(b, pond.x + Math.cos(a) * d, height(pond.x + Math.cos(a) * d, pond.z + Math.sin(a) * d) - 0.1, pond.z + Math.sin(a) * d, 1.6, rnd, 0x6aa84a); }
  // указатель и пень в начале тропы
  b.add(ENV, gCyl6, { p: [1.8, height(1.8, -16) + 0.6, -16], s: [0.07, 1.2, 0.07], color: 0x6a4426 });
  b.add(ENV, gBox, { p: [1.8, height(1.8, -16) + 1.1, -16], s: [0.9, 0.28, 0.06], r: [0, 0.2, 0.05], color: 0xc89860 });
  b.build(root, 'Props');
  // вода
  const water = M(new THREE.CircleGeometry(pond.r * 1.05, 28), mat('WaterPond', 0x3a9ad8, { rough: 0.08, metal: 0.1, glow: 0x0a2a50, opacity: 0.82, double: true }), 'Water', [pond.x, -0.18, pond.z], [-Math.PI / 2, 0, 0]);
  root.add(water);
  anchors(root, height, [
    ['PlayerStart', -1, -16.5], ['ExitPortal', 3, 17],
    ...lineup(6, (i) => [`EnemySpawn_${String(i + 1).padStart(2, '0')}`, ...[[-4, -6], [4, -2], [-6, 4], [2, 6], [-3, 12], [6, 11]][i]]),
    ['ChestSpot_01', -9, -4], ['ChestSpot_02', 10, -10], ['CampfireSpot', -3, -14],
  ]);
  return { object: root };
}

// ═══════════════════════════ 2. Ледяные горы ═══════════════════════════
export function locIceMountains() {
  const root = G('Loc_IceMountains');
  const noise = makeNoise(21), rnd = rng(202);
  const lake = { x: 5, z: 5, r: 5.5 };
  const peaks = [[-10, -11, 8.5, 6], [0, -14, 10.5, 7], [11, -10, 8, 5.5], [-15, 2, 6.5, 4.5], [15, 4, 7, 5], [-5, -5, 3.2, 3.5]];
  const pathCurve = new THREE.CatmullRomCurve3([[-2, 17], [-5, 9], [-1, 3], [-6, -3], [-3, -8]].map(([x, z]) => new V3(x, 0, z)));
  const height = (x, z) => {
    let h = (noise(x * 0.09, z * 0.09) - 0.5) * 2.0 + edgeRise(x, z, 2.2);
    for (const [px, pz, ph, pr] of peaks) { const d = Math.hypot(x - px, z - pz) / pr; h += ph * Math.max(0, 1 - d) ** 1.5 * (0.85 + noise(x * 0.5, z * 0.5, 2) * 0.3); }
    const [dp] = distToPolyline(pathCurve, x, z, 50);
    h = lerp(Math.min(h, 0.3), h, sstep(1.3, 3.2, dp));
    const ld = Math.hypot(x - lake.x, z - lake.z);
    h = lerp(-0.15, h, sstep(lake.r * 0.8, lake.r * 1.15, ld));
    return h;
  };
  const colorAt = (x, z, y, sl) => {
    if (Math.hypot(x - lake.x, z - lake.z) < lake.r * 0.95) return 0xcdeeff;
    if (y > 5.5) return 0xffffff;
    if (sl > 1.1 && y > 1.5) return noise(x, z) > 0.5 ? 0x7488b0 : 0x6677a0;
    if (y > 3.2) return 0xe9f2ff;
    return noise(x * 0.6, z * 0.6, 2) > 0.5 ? 0xf2f8ff : 0xdceaff;
  };
  const terrain = makeTerrain({ height, colorAt, skirtColor: 0x46547a });
  root.add(new THREE.Mesh(terrain, ENV)); root.children[0].name = 'Terrain';
  const b = new Batch();
  const iceM = mat('IceGlow', 0x7fe0ff, { rough: 0.1, metal: 0.1, glow: 0x1a5a9a, vc: false });
  const okFlat = (x, z) => height(x, z) < 2.5 && Math.hypot(x - lake.x, z - lake.z) > lake.r * 1.1 && distToPolyline(pathCurve, x, z, 40)[0] > 2.4;
  scatter(26, rnd, okFlat, 2.2).forEach(([x, z]) => addPine(b, x, height(x, z), z, 0.9 + rnd() * 0.7, rnd, { trunk: 0x5a4030, leaf: 0x2c6a5c, snow: 0xf4faff }));
  scatter(16, rnd, okFlat, 1.6).forEach(([x, z]) => addRock(b, x, height(x, z), z, 0.4 + rnd() * 0.6, rnd, 0x7d8db0, 0xffffff));
  scatter(10, rnd, okFlat, 2.5).forEach(([x, z]) => addCrystals(b, iceM, x, height(x, z), z, 0.8 + rnd() * 0.8, rnd, 4));
  // сугробы
  scatter(26, rnd, okFlat, 1.5).forEach(([x, z]) => b.add(ENV, jitterGeo(gIco1, rnd, 0.2), { p: [x, height(x, z) + 0.05, z], s: [0.6 + rnd() * 0.7, 0.25 + rnd() * 0.15, 0.6 + rnd() * 0.7], color: 0xffffff }));
  // острые ледяные шипы на пиках
  peaks.slice(0, 3).forEach(([px, pz, ph]) => addCrystals(b, iceM, px + 0.5, height(px, pz) - 0.4, pz, 1.4, rnd, 5));
  // ледяные арки на тропе
  [[-4.7, 6.5], [-3.2, -5.4]].forEach(([x, z], i) => {
    const y = height(x, z);
    b.add(ENV_GLOSS, gCone6, { p: [x - 1.1, y + 1.1, z], s: [0.35, 2.2, 0.35], color: 0xa7e6ff });
    b.add(ENV_GLOSS, gCone6, { p: [x + 1.1, y + 1.1, z], s: [0.35, 2.2, 0.35], color: 0xa7e6ff });
    b.add(ENV_GLOSS, gBox, { p: [x, y + 2.2, z], s: [2.9, 0.3, 0.4], color: 0xc4f0ff });
  });
  b.build(root, 'Props');
  root.add(M(new THREE.CircleGeometry(lake.r * 1.02, 36), mat('FrozenLake', 0xa8e4ff, { rough: 0.05, metal: 0.2, glow: 0x0a3a70, opacity: 0.92, double: true }), 'FrozenLake', [lake.x, -0.08, lake.z], [-Math.PI / 2, 0, 0]));
  anchors(root, height, [
    ['PlayerStart', -2, 16.5], ['ExitPortal', -3, -8],
    ...lineup(6, (i) => [`EnemySpawn_${String(i + 1).padStart(2, '0')}`, ...[[-6, 8], [-1, 2], [-7, -2], [10, -2], [-12, 8], [12, 12]][i]]),
    ['ChestSpot_01', 11, 14], ['ChestSpot_02', -13, -6], ['CampfireSpot', -3, 14],
  ]);
  return { object: root };
}

// ═══════════════════════════ 3. Огненная долина ═══════════════════════════
export function locFireValley() {
  const root = G('Loc_FireValley');
  const noise = makeNoise(31), rnd = rng(303);
  const lavaPts = [[-14, -18], [-8, -9], [-6, 0], [0, 6], [8, 9], [14, 18]];
  const lavaCurve = new THREE.CatmullRomCurve3(lavaPts.map(([x, z]) => new V3(x, 0, z)));
  const crater = { x: 9, z: -12, r: 8, h: 8.5 };
  const bridgeT = 0.5;
  const height = (x, z) => {
    let h = (noise(x * 0.1 + 9, z * 0.1) - 0.5) * 2.6 + edgeRise(x, z, 3.4, 0.5);
    const vd = Math.hypot(x - crater.x, z - crater.z);
    h += crater.h * Math.max(0, 1 - vd / crater.r) ** 1.3;
    if (vd < 1.8) h = Math.min(h, crater.h * 0.82 - (1.8 - vd) * 0.9);
    const [dl] = distToPolyline(lavaCurve, x, z, 80);
    h -= 1.0 * (1 - sstep(0.8, 3.6, dl));
    return h;
  };
  const colorAt = (x, z, y, sl) => {
    const [dl] = distToPolyline(lavaCurve, x, z, 60);
    if (dl < 2.1) return 0x8a2a12;
    if (dl < 3.0) return 0x5a2a20;
    const vd = Math.hypot(x - crater.x, z - crater.z);
    if (vd < 2.4) return 0x8a2a12;
    if (sl > 1.0) return 0x5a3a30;
    return noise(x * 0.6, z * 0.6, 2) > 0.5 ? 0x3e2a27 : 0x4a322c;
  };
  const terrain = makeTerrain({ height, colorAt, skirtColor: 0x2a1a18 });
  root.add(new THREE.Mesh(terrain, ENV)); root.children[0].name = 'Terrain';
  const b = new Batch();
  const lavaGlow = mat('LavaGlow', 0xb83800, { rough: 1, glow: 0x9a2e00 });
  const craterFire = mat('CraterFire', 0xd04800, { rough: 1, glow: 0x9a3400 });
  const emberM = mat('EmberGlow', 0xffa03a, { rough: 0.6, glow: 0xd07018 });
  const ok = (x, z) => distToPolyline(lavaCurve, x, z, 50)[0] > 3.4 && Math.hypot(x - crater.x, z - crater.z) > crater.r * 0.95;
  scatter(22, rnd, ok, 1.8).forEach(([x, z]) => addRock(b, x, height(x, z), z, 0.5 + rnd() * 0.9, rnd, 0x6a463a));
  // каменные шпили
  scatter(14, rnd, ok, 2.6).forEach(([x, z]) => { const h = 1.4 + rnd() * 2.6; b.add(ENV, jitterGeo(gCone5, rnd, 0.15), { p: [x, height(x, z) + h / 2 - 0.2, z], s: [0.5 + rnd() * 0.4, h, 0.5 + rnd() * 0.4], r: [(rnd() - 0.5) * 0.2, rnd() * 3, (rnd() - 0.5) * 0.2], color: tint(0x4a3028, rnd, 0.1) }); });
  // обугленные деревья
  scatter(12, rnd, ok, 2.4).forEach(([x, z]) => addDeadTree(b, x, height(x, z), z, 0.8 + rnd() * 0.6, rnd, 0x1e1514));
  // светящиеся угли
  scatter(40, rnd, ok, 0.8).forEach(([x, z]) => b.add(emberM, gOct, { p: [x, height(x, z) + 0.12, z], s: 0.07 + rnd() * 0.06, r: [rnd(), rnd(), rnd()] }));
  // потоки лавы со склонов вулкана
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.28 + 0.5;
    const pts = [[crater.x + Math.cos(a) * 1.4, crater.z + Math.sin(a) * 1.4], [crater.x + Math.cos(a + 0.1) * 3.5, crater.z + Math.sin(a + 0.1) * 3.5], [crater.x + Math.cos(a - 0.1) * 5.6, crater.z + Math.sin(a - 0.1) * 5.6]];
    const rb = ribbon(pts, 0.7, 0, 6);
    const p = rb.geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, height(p.getX(k), p.getZ(k)) + 0.08);
    rb.geo.computeVertexNormals();
    b.add(lavaGlow, rb.geo);
  }
  // каменный мост через реку лавы
  const bp = lavaCurve.getPointAt(bridgeT), bt = lavaCurve.getTangentAt(bridgeT);
  const ang = Math.atan2(bt.x, bt.z) + Math.PI / 2;
  b.add(ENV, gBox, { p: [bp.x, 0.15, bp.z], s: [7, 0.35, 1.8], r: [0, ang, 0], color: 0x6a5a52 });
  [-1, 1].forEach((s) => { b.add(ENV, gBox, { p: [bp.x - Math.sin(ang) * 0 + Math.cos(ang) * 0 + s * 0.0, 0.5, bp.z], s: [7, 0.25, 0.15], r: [0, ang, 0], color: 0x504038 }); });
  b.build(root, 'Props');
  // лава
  const lava = ribbon(lavaPts, 3.6, -0.55, 10);
  root.add(M(lava.geo, lavaGlow, 'LavaRiver'));
  // кратер
  root.add(M(new THREE.CircleGeometry(2.2, 18), lavaGlow, 'LavaCrater', [crater.x, crater.h * 0.82 - 1.0, crater.z], [-Math.PI / 2, 0, 0]));
  const glow = G('Fire', [crater.x, crater.h * 0.82 - 0.9, crater.z]);
  [0, 1, 2].forEach((i) => glow.add(M(flameGeo(2.6 + i * 0.8, 0.7, 8, 0.1), craterFire, `CraterFlame${i}`, [Math.cos(i * 2.1) * 0.8, 0, Math.sin(i * 2.1) * 0.8])));
  root.add(glow);
  anchors(root, height, [
    ['PlayerStart', -14, -16], ['ExitPortal', 14, 16], ['BossSpot', crater.x - 4, crater.z + 6],
    ...lineup(6, (i) => [`EnemySpawn_${String(i + 1).padStart(2, '0')}`, ...[[-11, -8], [-2, -6], [-12, 4], [3, 10], [8, 2], [-4, 11]][i]]),
    ['ChestSpot_01', 13, -2], ['ChestSpot_02', -13, 12], ['CampfireSpot', -12, -13],
  ]);
  return { object: root };
}

// ═══════════════════════════ 4. Проклятое болото ═══════════════════════════
export function locCursedSwamp() {
  const root = G('Loc_CursedSwamp');
  const noise = makeNoise(41), rnd = rng(404);
  const height = (x, z) => {
    let h = (noise(x * 0.12 + 7, z * 0.12 + 2) - 0.5) * 3.2 - 0.25 + edgeRise(x, z, 2.6, 0.6);
    const tw = Math.hypot(x + 9, z + 10);
    h += 2.8 * Math.max(0, 1 - tw / 4.5);
    return h;
  };
  const waterY = 0.0;
  const colorAt = (x, z, y, sl) => {
    if (y < waterY - 0.2) return 0x241c34;
    if (y < waterY + 0.35) return 0x3a3050;
    if (sl > 1.0) return 0x4a4258;
    return noise(x * 0.7, z * 0.7, 2) > 0.5 ? 0x46386a : 0x3b3260;
  };
  const terrain = makeTerrain({ height, colorAt, skirtColor: 0x1d1628 });
  root.add(new THREE.Mesh(terrain, ENV)); root.children[0].name = 'Terrain';
  const b = new Batch();
  const gMush = mat('SwampMushPurple', 0xb04dff, { rough: 0.5, glow: 0x6a28b0 });
  const gMushG = mat('SwampMushGreen', 0x45ff6a, { rough: 0.5, glow: 0x1e8a38 });
  const wisp = mat('Wisp', 0x9dffb0, { rough: 0.4, glow: 0x52b868 });
  const dry = (x, z) => height(x, z) > waterY + 0.25;
  scatter(22, rnd, dry, 2.4).forEach(([x, z]) => addDeadTree(b, x, height(x, z), z, 0.9 + rnd() * 0.9, rnd, 0x2a2133));
  scatter(14, rnd, dry, 1.6).forEach(([x, z]) => addGravestone(b, x, height(x, z), z, 0.8 + rnd() * 0.5, rnd, 0x8a8a9c));
  scatter(26, rnd, dry, 1.0).forEach(([x, z]) => { const s = 0.9 + rnd() * 1.3; const gm = rnd() > 0.5 ? gMush : gMushG, y = height(x, z);
    b.add(ENV, gCyl6, { p: [x, y + 0.12 * s, z], s: [0.05 * s, 0.24 * s, 0.05 * s], color: 0xd8d0e8 });
    b.add(gm, gCone8, { p: [x, y + 0.3 * s, z], s: [0.2 * s, 0.2 * s, 0.2 * s] }); });
  scatter(20, rnd, dry, 0.9).forEach(([x, z]) => b.add(wisp, gIco0, { p: [x, height(x, z) + 0.8 + rnd() * 1.4, z], s: 0.07 + rnd() * 0.05 }));
  scatter(14, rnd, dry, 1.8).forEach(([x, z]) => addRock(b, x, height(x, z), z, 0.35 + rnd() * 0.5, rnd, 0x5a5070));
  scatter(60, rnd, (x, z) => height(x, z) > waterY, 0.6).forEach(([x, z]) => addGrassTufts(b, x, height(x, z), z, 1.3, rnd, 0x5a4a8a));
  // руины башни
  const tx = -9, tz = -10, ty = height(tx, tz);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const h = 2.2 + (i % 3) * 1.2 * (i === 4 ? 0.2 : 1); b.add(ENV, gBox, { p: [tx + Math.cos(a) * 1.9, ty + h / 2, tz + Math.sin(a) * 1.9], s: [1.0, h, 0.7], r: [0, -a, 0], color: tint(0x5a5070, rnd, 0.1) }); }
  b.add(ENV, gBox, { p: [tx, ty + 0.2, tz], s: [3.2, 0.4, 3.2], color: 0x403858 });
  b.add(gMush, gCone6, { p: [tx, ty + 0.9, tz], s: [0.3, 1.2, 0.3] });
  // покосившийся причал
  b.add(ENV, gBox, { p: [9, 0.1, 8], s: [5, 0.12, 1.1], r: [0, 0.4, 0.04], color: 0x5a3f2a });
  for (let i = 0; i < 4; i++) b.add(ENV, gCyl6, { p: [7.2 + i * 1.3, -0.1, 7.3 + i * 0.55], s: [0.08, 1.2, 0.08], color: 0x3a2a1e });
  b.build(root, 'Props');
  root.add(M(new THREE.PlaneGeometry(36, 36), mat('SwampWater', 0x2a2e4a, { rough: 0.05, metal: 0.2, glow: 0x142a2a, opacity: 0.88, double: true }), 'Water', [0, waterY, 0], [-Math.PI / 2, 0, 0]));
  anchors(root, height, [
    ['PlayerStart', 14, -14], ['ExitPortal', -15, 14], ['BossSpot', -9, -4],
    ...lineup(6, (i) => [`EnemySpawn_${String(i + 1).padStart(2, '0')}`, ...[[8, -8], [2, 2], [-6, 8], [10, 4], [-12, 2], [-2, -12]][i]]),
    ['ChestSpot_01', 12, 12], ['ChestSpot_02', -14, -14], ['CampfireSpot', 13, -12],
  ]);
  return { object: root };
}

// ═══════════════════════════ 5. Королевство слизней ═══════════════════════════
export function locSlimeKingdom() {
  const root = G('Loc_SlimeKingdom');
  const noise = makeNoise(51), rnd = rng(505);
  const castleZ = -8;
  const height = (x, z) => {
    let h = (noise(x * 0.1, z * 0.1) - 0.5) * 1.6 + edgeRise(x, z, 2.4, 0.6);
    // двор замка ровный
    const inCastle = sstep(14, 10, Math.abs(x)) * sstep(castleZ + 8.5, castleZ + 6, z);
    h = lerp(h, 0.6, inCastle);
    // ров вокруг
    const moat = Math.abs(z - (castleZ + 8.5)) < 1.8 && Math.abs(x) < 15 ? 1 : 0;
    h -= moat * 1.1;
    // тропа
    return h;
  };
  const colorAt = (x, z, y, sl) => {
    if (Math.abs(z - (castleZ + 8.5)) < 1.6 && Math.abs(x) < 14.5) return 0x29c04a;
    if (Math.abs(x) < 2.2 && z > castleZ + 8) return 0x5a4a82;
    return noise(x * 0.6, z * 0.6, 2) > 0.5 ? 0x2e2650 : 0x372d5e;
  };
  const terrain = makeTerrain({ height, colorAt, skirtColor: 0x1a1430 });
  root.add(new THREE.Mesh(terrain, ENV)); root.children[0].name = 'Terrain';
  const b = new Batch();
  const stone = 0x5a4f82, stone2 = 0x463c6c, roof = 0x7a35c8;
  const fireM = mat('GateFire', 0xd04800, { rough: 1, glow: 0x9a3400 });
  const slimeG = mat('SlimeGlow', 0x4dff5a, { rough: 0.2, glow: 0x1f9a2a });
  const pFire = mat('BraizerFire', 0xb04dff, { rough: 0.6, glow: 0x6a2ab0 });
  const gold = mat('EnvGold', 0xf4b92e, { rough: 0.3, metal: 0.9, glow: 0x3a2800 });
  const y0 = 0.6, cz = castleZ;
  // главная башня
  b.add(ENV, gBox, { p: [0, y0 + 3.2, cz - 1.5], s: [6, 6.4, 5], color: stone });
  for (let i = 0; i < 6; i++) for (const zz of [cz - 4, cz + 1]) b.add(ENV, gBox, { p: [-2.5 + i, y0 + 6.7, zz], s: [0.6, 0.6, 0.6], color: stone2 });
  b.add(ENV, gCone4, { p: [0, y0 + 8.7, cz - 1.5], s: [4.6, 4, 4.0], r: [0, Math.PI / 4, 0], color: roof });
  // угловые башни
  [[-8, 1], [8, 1], [-8, -5], [8, -5]].forEach(([dx, dz], i) => {
    const h = 5 + (i % 2) * 1.0;
    b.add(ENV, gCyl10, { p: [dx, y0 + h / 2, cz + dz], s: [1.5, h, 1.5], color: stone });
    b.add(ENV, gCyl10, { p: [dx, y0 + h + 0.15, cz + dz], s: [1.9, 0.35, 1.9], color: stone2 });
    b.add(ENV, gCone10(), { p: [dx, y0 + h + 1.65, cz + dz], s: [1.9, 2.6, 1.9], color: roof });
    b.add(slimeG, gIco0, { p: [dx, y0 + h + 3.15, cz + dz], s: 0.25 });
  });
  // стены с зубцами
  [[-4.2, 1], [4.2, 1]].forEach(([x, z]) => { b.add(ENV, gBox, { p: [x, y0 + 1.7, cz + z], s: [4.8, 3.4, 1], color: stone }); for (let i = 0; i < 5; i++) b.add(ENV, gBox, { p: [x - 2 + i, y0 + 3.7, cz + z], s: [0.55, 0.6, 1], color: stone2 }); });
  [[-8, -2], [8, -2]].forEach(([x, z]) => b.add(ENV, gBox, { p: [x, y0 + 1.7, cz + z], s: [1, 3.4, 6], color: stone }));
  b.add(ENV, gBox, { p: [0, y0 + 1.7, cz - 5.5], s: [16, 3.4, 1], color: stone });
  // ворота: светящаяся огненная арка
  b.add(ENV, gBox, { p: [-1.6, y0 + 2.1, cz + 1.05], s: [0.9, 4.2, 1.2], color: stone2 });
  b.add(ENV, gBox, { p: [1.6, y0 + 2.1, cz + 1.05], s: [0.9, 4.2, 1.2], color: stone2 });
  b.add(ENV, gBox, { p: [0, y0 + 4.0, cz + 1.05], s: [4.1, 0.9, 1.2], color: stone2 });
  b.add(fireM, gBox, { p: [0, y0 + 1.8, cz + 0.6], s: [2.3, 3.5, 0.3] });
  b.add(fireM, gCone8, { p: [0, y0 + 1.6, cz + 0.8], s: [0.7, 2.6, 0.2], color: 0xffffff });
  // корона над воротами
  b.add(gold, gBox, { p: [0, y0 + 4.7, cz + 1.05], s: [1.5, 0.35, 0.5] });
  [-0.6, -0.3, 0, 0.3, 0.6].forEach((x, i) => b.add(gold, gCone5, { p: [x, y0 + 5.1 + (i % 2 === 0 ? 0.15 : 0), cz + 1.05], s: [0.22, 0.6 + (i % 2 === 0 ? 0.3 : 0), 0.22] }));
  // мост через ров
  b.add(ENV, gBox, { p: [0, 0.05, castleZ + 8.5], s: [3.2, 0.3, 4.4], color: 0x6a5a98 });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.add(ENV, gBox, { p: [s * 1.5, 0.45, castleZ + 7 + i * 1.5], s: [0.2, 0.7, 0.2], color: 0x8a7ab8 });
  // слизь на стенах
  for (let i = 0; i < 10; i++) { const x = (rnd() - 0.5) * 14; b.add(slimeG, jitterGeo(gIco0, rnd, 0.1), { p: [x, y0 + 3.2 + rnd() * 0.3, cz + 1.55], s: [0.3 + rnd() * 0.25, 0.7 + rnd() * 1.0, 0.1] }); }
  // жаровни и знамёна вдоль дороги
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = castleZ + 12 + i * 3.2, x = s * 3.4;
    b.add(ENV, gCyl8, { p: [x, height(x, z) + 0.5, z], s: [0.15, 1.0, 0.15], color: 0x3a3258 });
    b.add(ENV, gCyl8, { p: [x, height(x, z) + 1.1, z], s: [0.4, 0.22, 0.4], color: 0x3a3258 });
    b.add(pFire, gCone6, { p: [x, height(x, z) + 1.5, z], s: [0.32, 0.8, 0.32] });
    b.add(slimeG, gBox, { p: [x + s * 0.0, height(x, z) + 2.2, z], s: [0.04, 0.0001, 0.04] });
  }
  // слизни-статуи/лужи
  scatter(14, rnd, (x, z) => z > castleZ + 11 && Math.abs(x) > 4.5, 2.2).forEach(([x, z]) => { const s = 0.5 + rnd() * 0.5; b.add(slimeG, jitterGeo(gIco1, rnd, 0.15), { p: [x, height(x, z) + s * 0.3, z], s: [s, s * 0.8, s] }); });
  scatter(18, rnd, (x, z) => z > castleZ + 10 && Math.abs(x) > 4, 1.8).forEach(([x, z]) => addRock(b, x, height(x, z), z, 0.4 + rnd() * 0.6, rnd, 0x4a3f70));
  scatter(10, rnd, (x, z) => z > castleZ + 10 && Math.abs(x) > 4, 2.5).forEach(([x, z]) => addCrystals(b, pFire, x, height(x, z), z, 0.9 + rnd() * 0.7, rnd, 4));
  scatter(8, rnd, (x, z) => z > castleZ + 10 && Math.abs(x) > 4.5, 3).forEach(([x, z]) => addDeadTree(b, x, height(x, z), z, 0.9 + rnd() * 0.6, rnd, 0x241c3a));
  b.build(root, 'Props');
  root.add(M(new THREE.PlaneGeometry(31, 3.2), mat('MoatSlime', 0x4dff5a, { rough: 0.1, glow: 0x1c8a2a, opacity: 0.92, double: true }), 'MoatSlime', [0, -0.45, castleZ + 8.5], [-Math.PI / 2, 0, 0]));
  anchors(root, height, [
    ['PlayerStart', 0, 17], ['ExitPortal', 0, castleZ + 2], ['BossSpot', 0, castleZ - 1.5],
    ...lineup(6, (i) => [`EnemySpawn_${String(i + 1).padStart(2, '0')}`, ...[[-6, 10], [6, 9], [-9, 4], [9, 5], [-4, 14], [5, 15]][i]]),
    ['ChestSpot_01', -13, 12], ['ChestSpot_02', 13, 12], ['CampfireSpot', 0, 15.5],
  ]);
  return { object: root };
}
const gCone10 = () => new THREE.ConeGeometry(1, 1, 10);

export const locations = [
  ['loc_green_forest', '1. Зелёный лес', locGreenForest],
  ['loc_ice_mountains', '2. Ледяные горы', locIceMountains],
  ['loc_fire_valley', '3. Огненная долина', locFireValley],
  ['loc_cursed_swamp', '4. Проклятое болото', locCursedSwamp],
  ['loc_slime_kingdom', '5. Королевство слизней', locSlimeKingdom],
];
