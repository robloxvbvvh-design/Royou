// Общая библиотека: материалы, примитивы, помощники для сборки моделей.
// Соглашения: Y — вверх, перед модели смотрит в +Z, 1 единица = 1 метр,
// начало координат — центр основания (у оружия — центр рукояти).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE, mergeGeometries, mergeVertices };

// ───────────────────────── случайные числа / шум ─────────────────────────
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoise(seed = 7) {
  const r = rng(seed);
  const N = 64;
  const lat = new Float32Array(N * N);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  const at = (x, y) => lat[((y & (N - 1)) * N) + (x & (N - 1))];
  const sm = (t) => t * t * (3 - 2 * t);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
  };
  // fbm в диапазоне примерно 0..1
  return (x, y, oct = 4) => {
    let amp = 0.5, f = 1, s = 0, norm = 0;
    for (let i = 0; i < oct; i++) { s += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  };
}

// ───────────────────────────── материалы ─────────────────────────────
const cache = new Map();
export function mat(name, color, o = {}) {
  if (cache.has(name)) return cache.get(name);
  const m = new THREE.MeshStandardMaterial({
    name,
    color,
    roughness: o.rough ?? 0.6,
    metalness: o.metal ?? 0,
    emissive: o.glow ?? 0x000000,
    emissiveIntensity: 1,
    transparent: o.opacity !== undefined && o.opacity < 1,
    opacity: o.opacity ?? 1,
    side: o.double ? THREE.DoubleSide : THREE.FrontSide,
    vertexColors: !!o.vc,
  });
  cache.set(name, m);
  return m;
}
/** Затемнить цвет (для эмиссии: иначе tone-mapping выбеливает свечение). */
export const dim = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
const glow = (name, c, o = {}) => mat(name, c, { rough: 0.45, glow: dim(c, 0.48), ...o });

export const P = {
  // металлы
  steel: mat('Steel', 0xb9c3d6, { metal: 0.85, rough: 0.32 }),
  steelLight: mat('SteelLight', 0xe6edf7, { metal: 0.9, rough: 0.22 }),
  steelDark: mat('SteelDark', 0x59627a, { metal: 0.8, rough: 0.42 }),
  iron: mat('Iron', 0x3c4152, { metal: 0.8, rough: 0.5 }),
  black: mat('BlackArmor', 0x2b2b44, { metal: 0.65, rough: 0.32 }),
  blackTrim: mat('BlackTrim', 0x3a2f55, { metal: 0.6, rough: 0.4 }),
  gold: mat('Gold', 0xf4b92e, { metal: 1, rough: 0.26 }),
  goldDark: mat('GoldDark', 0xb8821a, { metal: 0.9, rough: 0.4 }),
  bronze: mat('Bronze', 0xb5742f, { metal: 0.8, rough: 0.45 }),
  // дерево, кожа
  wood: mat('Wood', 0x9a6a3a, { rough: 0.85 }),
  woodLight: mat('WoodLight', 0xc8975f, { rough: 0.85 }),
  woodDark: mat('WoodDark', 0x5e3b1e, { rough: 0.9 }),
  leather: mat('Leather', 0x5b3a24, { rough: 0.8 }),
  leatherLight: mat('LeatherLight', 0x8a5a36, { rough: 0.8 }),
  // ткань
  clothBlue: mat('ClothBlue', 0x2f66d6, { rough: 0.8 }),
  clothRed: mat('ClothRed', 0x9c1228, { rough: 0.8, double: true }),
  clothPurple: mat('ClothPurple', 0x6a2fa8, { rough: 0.8, double: true }),
  clothPurpleDark: mat('ClothPurpleDark', 0x34195c, { rough: 0.8, double: true }),
  clothWhite: mat('ClothWhite', 0xf3efe4, { rough: 0.8, double: true }),
  clothBlueD: mat('ClothBlueDouble', 0x2f66d6, { rough: 0.8, double: true }),
  parchment: mat('Parchment', 0xefdcab, { rough: 0.9, double: true }),
  // прочее
  skin: mat('Skin', 0xe8b48c, { rough: 0.7 }),
  skinDark: mat('SkinDark', 0x2b2238, { rough: 0.8 }),
  white: mat('White', 0xf5f5f5, { rough: 0.4 }),
  black2: mat('Black', 0x0b0b10, { rough: 0.4 }),
  stone: mat('Stone', 0x8a8f9c, { rough: 0.9 }),
  stoneDark: mat('StoneDark', 0x4d5262, { rough: 0.95 }),
  stoneLight: mat('StoneLight', 0xaab0bd, { rough: 0.9 }),
  // свечение
  gOrange: glow('GlowOrange', 0xff8a1f),
  gRed: glow('GlowRed', 0xff3328),
  gYellow: glow('GlowYellow', 0xffd84a),
  gGold: glow('GlowGold', 0xffd25a),
  gBlue: glow('GlowBlue', 0x3fa0ff),
  gCyan: glow('GlowCyan', 0x8fe8ff),
  gPurple: glow('GlowPurple', 0xb04dff),
  gGreen: glow('GlowGreen', 0x45ff6a),
  gWhite: glow('GlowWhite', 0xfff6d8),
  // полупрозрачное свечение (аура, огонь)
  aGold: glow('AuraGold', 0xffd25a, { opacity: 0.7, double: true }),
  aOrange: glow('AuraOrange', 0xff7a1a, { opacity: 0.85, double: true }),
  aPurple: glow('AuraPurple', 0xa63cff, { opacity: 0.75, double: true }),
  aGreen: glow('AuraGreen', 0x4dff5a, { opacity: 0.7, double: true }),
  aBlue: glow('AuraBlue', 0x58b4ff, { opacity: 0.8, double: true }),
  glass: mat('Glass', 0xcfeeff, { rough: 0.05, metal: 0.1, opacity: 0.35, double: true }),
};

// ───────────────────────────── геометрия ─────────────────────────────
export const rbox = (w, h, d, r = 0.03, seg = 2) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 16, hs = 1, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, hs, open);
export const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);
export const sph = (r, ws = 20, hs = 14) => new THREE.SphereGeometry(r, ws, hs);
export const cap = (r, len, cs = 5, rs = 12) => new THREE.CapsuleGeometry(r, len, cs, rs);
export const tor = (R, r, rs = 10, ts = 28, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc);
export const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const oct = (r) => new THREE.OctahedronGeometry(r);

/** Тело вращения по профилю [[r,y],...] (снизу вверх — нормали наружу). */
export function lathe(pts, seg = 28) {
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
}

/** Сглаженная геометрия без швов (склеиваем дубли вершин сферы/лате и пересчитываем нормали). */
export function smooth(geo) {
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  const g = mergeVertices(geo, 1e-4);
  g.computeVertexNormals();
  return g;
}

/**
 * «Капля» слизня: сфера радиуса r, верх высотой h·r, нижняя часть сплющена (flatBottom) и чуть расширена.
 * Основание лежит на y=0.
 */
export function blobGeo(r, h = 1.32, flatBottom = 0.42, seg = 36) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = y < 0 ? 1 + 0.2 * -y : 1 - 0.05 * y;
    p.setXYZ(i, x * r * k, (y >= 0 ? y * h : y * h * flatBottom) * r, z * r * k);
  }
  g.translate(0, r * h * flatBottom, 0);
  return smooth(g);
}

/** Плоскогранная версия геометрии (low-poly look). */
export function flat(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

/** Выдавленный многоугольник [[x,y],...] толщиной depth (по Z, центрирован). */
export function extrudePoly(pts, depth, bevel = 0.008) {
  const clean = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-5);
  const L = clean.length - 1;
  if (Math.hypot(clean[0][0] - clean[L][0], clean[0][1] - clean[L][1]) < 1e-5) clean.pop();
  const s = new THREE.Shape(clean.map(([x, y]) => new THREE.Vector2(x, y)));
  return extrudeShape(s, depth, bevel);
}
export function extrudeShape(shape, depth, bevel = 0.008, curveSegments = 10) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Труба переменного радиуса вдоль кривой Catmull-Rom. radii — массив или функция t→r. */
export function tube(points, radii, { radial = 8, segs = 24, capEnds = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segs, false);
  const rf = typeof radii === 'function' ? radii : (t) => {
    const f = t * (radii.length - 1);
    const i = Math.min(radii.length - 2, Math.floor(f));
    return radii[i] + (radii[i + 1] - radii[i]) * (f - i);
  };
  const pos = [], idx = [];
  const ringV = (t, i) => {
    const P0 = curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i], r = rf(t);
    const ring = [];
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      ring.push(new THREE.Vector3().copy(P0).addScaledVector(N, Math.cos(a) * r).addScaledVector(B, Math.sin(a) * r));
    }
    return ring;
  };
  for (let i = 0; i <= segs; i++) for (const v of ringV(i / segs, i)) pos.push(v.x, v.y, v.z);
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial);
      idx.push(a, c, b, b, c, d);
    }
  }
  if (capEnds) {
    for (const [i, flip] of [[0, true], [segs, false]]) {
      const t = i / segs;
      if (rf(t) < 1e-4) continue;
      const base = pos.length / 3;
      const ring = ringV(t, i);
      ring.forEach((v) => pos.push(v.x, v.y, v.z));
      const c = curve.getPointAt(t);
      pos.push(c.x, c.y, c.z);
      for (let j = 0; j < radial; j++) {
        const a = base + j, b = base + ((j + 1) % radial);
        if (flip) idx.push(base + radial, b, a); else idx.push(base + radial, a, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Полотно ткани (плащ, знамя): w×h, изгиб/волны задаёт fn(u,v)→[dx,dy,dz]. Верхний край в y=0, вниз к -h. */
export function cloth(wTop, wBot, h, ws = 8, hs = 8, fn = () => [0, 0, 0]) {
  const pos = [], idx = [];
  for (let j = 0; j <= hs; j++) {
    const v = j / hs;
    const w = wTop + (wBot - wTop) * v;
    for (let i = 0; i <= ws; i++) {
      const u = i / ws - 0.5;
      const [dx, dy, dz] = fn(u, v);
      pos.push(u * w + dx, -v * h + dy, dz);
    }
  }
  for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) {
    const a = j * (ws + 1) + i, b = a + 1, c = a + ws + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Пламя-капля. */
export function flameGeo(h, r, seg = 10, lean = 0) {
  const pts = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([Math.max(0.0001, r * Math.sin(Math.PI * Math.pow(t, 0.55)) * (1 - t * 0.15)), t * h]);
  }
  const g = lathe(pts, seg);
  if (lean) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + lean * Math.pow(p.getY(i) / h, 2));
    g.computeVertexNormals();
  }
  return g;
}

// ───────────────────────── сборка узлов сцены ─────────────────────────
/** Меш с позицией/поворотом/масштабом. */
export function M(geo, material, name, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  m.position.set(...p);
  m.rotation.set(...r);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
  return m;
}
/** Пустой узел (группа, шарнир, сокет). */
export function G(name, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], ...children) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(...p);
  g.rotation.set(...r);
  if (typeof s === 'number') g.scale.setScalar(s); else g.scale.set(...s);
  children.forEach((c) => c && g.add(c));
  return g;
}
/** Цилиндр-стержень между двумя точками. */
export function rod(a, b, r, material, name, seg = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), material);
  m.name = name;
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}
/** Размножить меш по кругу. */
export function ring(parent, n, radius, make, y = 0) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = make(i, a);
    m.position.set(Math.sin(a) * radius + m.position.x, y + m.position.y, Math.cos(a) * radius + m.position.z);
    parent.add(m);
  }
}

// ───────────────────────────── общие детали ─────────────────────────────
/** Корона с зубцами и камнями. */
export function makeCrown(radius, height, nPoints, metal = P.gold, jewel = P.gRed, name = 'Crown') {
  const g = new THREE.Group(); g.name = name;
  const hb = height * 0.38;
  const band = lathe([[radius, 0], [radius, hb], [radius * 0.9, hb], [radius * 0.9, 0], [radius, 0]], 28);
  g.add(M(band, metal, `${name}_Band`));
  for (let i = 0; i < nPoints; i++) {
    const a = (i / nPoints) * Math.PI * 2;
    const x = Math.sin(a) * radius * 0.95, z = Math.cos(a) * radius * 0.95;
    const tall = i % 2 === 0 ? 1 : 0.72;
    const c = M(cone(radius * 0.2, height * 0.8 * tall, 4), metal, `${name}_Spike${i}`,
      [x, hb + height * 0.4 * tall, z], [0, a + Math.PI / 4, 0]);
    g.add(c);
    g.add(M(sph(radius * 0.085, 10, 8), jewel, `${name}_Tip${i}`, [x, hb + height * 0.8 * tall, z]));
  }
  g.add(M(sph(radius * 0.17, 12, 10), jewel, `${name}_Gem`, [0, hb * 0.5, radius * 0.97], [0, 0, 0], [1, 1.1, 0.6]));
  return g;
}

/** Глаза слизня: белок + зрачок + блик. */
export function makeEyes(x, y, z, size = 0.12, { angry = 0, pupil = 0.55, mat: sc = P.white } = {}) {
  const g = new THREE.Group(); g.name = 'Eyes';
  [-1, 1].forEach((s) => {
    const e = G(s < 0 ? 'Eye_L' : 'Eye_R', [s * x, y, z]);
    e.add(M(sph(size, 16, 12), sc, 'Sclera', [0, 0, 0], [0, 0, 0], [1, 1.2, 0.55]));
    e.add(M(sph(size * pupil, 12, 10), P.black2, 'Pupil', [-s * size * 0.08, -size * 0.05, size * 0.3], [0, 0, 0], [1, 1.25, 0.6]));
    e.add(M(sph(size * 0.17, 8, 6), P.white, 'Glint', [s * size * 0.1, size * 0.3, size * 0.5]));
    if (angry) {
      e.add(M(rbox(size * 2.1, size * 0.4, size * 0.4, 0.015), P.black2, 'Brow',
        [0, size * 1.05, size * 0.15], [0, 0, s * angry]));
    }
    g.add(e);
  });
  return g;
}

/** Заключительная обработка: уникальные имена узлов, тени, без UV. */
export function finalize(root) {
  const seen = new Map();
  root.traverse((o) => {
    if (o === root) return;
    const base = o.name || (o.isMesh ? 'Mesh' : 'Node');
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    o.name = n === 1 ? base : `${base}_${String(n).padStart(2, '0')}`;
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      if (o.geometry.attributes.uv) o.geometry.deleteAttribute('uv');
      if (o.geometry.attributes.uv1) o.geometry.deleteAttribute('uv1');
      const nrm = o.geometry.attributes.normal;
      if (nrm && !o.geometry.userData.normalized) {
        const v = new THREE.Vector3();
        for (let i = 0; i < nrm.count; i++) {
          v.fromBufferAttribute(nrm, i);
          if (v.lengthSq() < 1e-12) v.set(0, 1, 0); else v.normalize();
          nrm.setXYZ(i, v.x, v.y, v.z);
        }
        o.geometry.userData.normalized = true;
      }
    }
  });
  return root;
}

// ───────────────────────────── анимации ─────────────────────────────
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const quat = ([x, y, z]) => { _q.setFromEuler(_e.set(x, y, z)); return [_q.x, _q.y, _q.z, _q.w]; };

/** Треки: rot(node, times, [[ex,ey,ez],...]), pos(...), scl(...) */
export const track = {
  rot: (node, times, eulers) => new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, eulers.flatMap(quat)),
  pos: (node, times, vecs) => new THREE.VectorKeyframeTrack(`${node.name}.position`, times, vecs.flat()),
  scl: (node, times, vecs) => new THREE.VectorKeyframeTrack(`${node.name}.scale`, times, vecs.flat()),
};
export const clip = (name, duration, tracks) => new THREE.AnimationClip(name, duration, tracks.flat());

/** Статистика по модели (треугольники, вершины, материалы). */
export function stats(root) {
  let tris = 0, verts = 0, meshes = 0;
  const mats = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    verts += g.attributes.position.count;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    mats.add(o.material);
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  return {
    triangles: Math.round(tris), vertices: verts, meshes, materials: mats.size,
    size: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)],
  };
}
