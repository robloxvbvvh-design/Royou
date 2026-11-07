// Враги: шесть видов слизней.
import {
  THREE, P, mat, dim, M, G, cone, sph, tor, oct, ico, flat, blobGeo, flameGeo, makeCrown, makeEyes, finalize, clip, track, rng, cyl, smooth,
} from './lib.js';

const slimeMat = (name, color, glow = 0x000000) => mat(name, color, { rough: 0.14, metal: 0.02, glow });
export const SM = {
  green: slimeMat('SlimeGreen', 0x3fdc45, 0x0c4a10),
  blue: slimeMat('SlimeBlue', 0x3aa0ff, 0x0a2f66),
  red: slimeMat('SlimeRed', 0xe5322b, 0x4a0b08),
  purple: slimeMat('SlimePurple', 0x9440ee, 0x2b0a5a),
  royal: slimeMat('SlimeRoyal', 0x5a48ff, 0x14104d),
  stone: mat('SlimeStone', 0x8b8b95, { rough: 0.9 }),
  stoneDark: mat('SlimeStoneDark', 0x5a5a66, { rough: 0.95 }),
  moss: mat('Moss', 0x5a8a3a, { rough: 0.9 }),
  ice: mat('IceCrystal', 0x7fd8ff, { rough: 0.08, metal: 0.1, glow: 0x1a58a8 }),
  gloss: mat('Gloss', 0xffffff, { rough: 0.2, glow: 0x9a9a9a }),
};

/** Z поверхности «капли» на высоте y (по центральной оси x). */
function surfZ(b, x, y) {
  const cy = b.r * b.h * b.flat;
  const t = 1 - (x / b.r) ** 2 - ((y - cy) / (b.r * b.h)) ** 2;
  return b.r * Math.sqrt(Math.max(0, t)) * (1 - 0.05 * Math.max(0, (y - cy) / (b.r * b.h)));
}

/**
 * Каркас слизня: Root → Body (пивот в основании) → { Blob, Puddle, Face, блики }.
 */
export function slimeBase(name, { r = 0.42, h = 1.32, flatBottom = 0.42, body, eye = {}, mouth = 'smile', eyeX = 0.27, eyeY = 0.2, eyeSize = 0.13, sheen = true } = {}) {
  const b = { r, h, flat: flatBottom };
  const root = G(name);
  const bodyN = G('Body'); root.add(bodyN);
  bodyN.add(M(blobGeo(r, h, flatBottom), body, 'Blob'));
  bodyN.add(M(cyl(r * 0.98, r * 1.08, r * 0.08, 36), body, 'Puddle', [0, r * 0.04, 0]));
  // капли у основания
  [[0.95, 0.5, 0.1], [-0.9, 0.9, 0.08], [0.3, 2.6, 0.07]].forEach(([a, f, s], i) => {
    bodyN.add(M(sph(r * s, 10, 8), body, `Drip${i}`, [Math.sin(a * 2) * r * 1.12, r * s * 0.5, Math.cos(a * 2) * r * 1.12], [0, 0, 0], [1, 0.6, 1]));
  });
  const cy = r * h * flatBottom;
  const ey = cy + r * h * eyeY, ex = r * eyeX;
  const eyes = makeEyes(ex, ey, surfZ(b, ex, ey) - eyeSize * 0.25, r * eyeSize * 1.9, eye);
  bodyN.add(eyes);
  const my = cy + r * h * (eyeY - 0.34);
  const mz = surfZ(b, 0, my) - 0.005;
  if (mouth === 'smile') {
    bodyN.add(M(tor(r * 0.2, r * 0.038, 6, 14, Math.PI), P.black2, 'Mouth', [0, my + r * 0.12, mz], [0, 0, Math.PI], [1, 0.8, 0.6]));
  } else if (mouth === 'frown') {
    bodyN.add(M(tor(r * 0.16, r * 0.03, 6, 14, Math.PI), P.black2, 'Mouth', [0, my - r * 0.02, mz], [0, 0, 0], [1, 0.8, 0.6]));
  } else if (mouth === 'none') {
    // рот добавляет вызывающий код
  } else if (mouth === 'fangs') {
    bodyN.add(M(sph(r * 0.2, 14, 10), P.black2, 'Mouth', [0, my, mz - r * 0.02], [0, 0, 0], [1, 0.5, 0.35]));
    [-1, 1].forEach((sg) => bodyN.add(M(cone(r * 0.04, r * 0.11, 5), P.white, 'Fang', [sg * r * 0.1, my + r * 0.04, mz + r * 0.02], [Math.PI, 0, 0])));
  }
  if (sheen) {
    bodyN.add(M(sph(r * 0.11, 10, 8), SM.gloss, 'Sheen', [-r * 0.45, cy + r * h * 0.62, r * 0.55], [0.5, -0.7, 0.4], [1.5, 0.7, 0.5]));
    bodyN.add(M(sph(r * 0.05, 8, 6), SM.gloss, 'Sheen2', [-r * 0.6, cy + r * h * 0.42, r * 0.58], [0.4, -0.9, 0.3]));
  }
  return { root, body: bodyN, b, cy, surfZ: (x, y) => surfZ(b, x, y), r };
}

export function slimeClips(s, hop = true) {
  const sq = (x, y) => [x, y, x];
  const idle = clip('Idle', 1.6, [
    track.scl(s.body, [0, 0.8, 1.6], [sq(1, 1), sq(1.05, 0.92), sq(1, 1)]),
  ]);
  const out = [idle];
  if (hop) {
    const h = s.r * 1.1;
    out.push(clip('Hop', 1.0, [
      track.scl(s.body, [0, 0.18, 0.32, 0.5, 0.68, 0.82, 1.0], [sq(1, 1), sq(1.2, 0.72), sq(0.88, 1.22), sq(0.94, 1.12), sq(0.9, 1.15), sq(1.22, 0.68), sq(1, 1)]),
      track.pos(s.body, [0, 0.18, 0.32, 0.5, 0.68, 0.82, 1.0], [[0, 0, 0], [0, 0, 0], [0, h * 0.4, 0], [0, h, 0], [0, h * 0.4, 0], [0, 0, 0], [0, 0, 0]]),
    ]));
  }
  return out;
}

// ───────────────────────── Зелёный ─────────────────────────
export function slimeGreen() {
  const s = slimeBase('Slime_Green', { body: SM.green, mouth: 'smile' });
  // росток
  const sp = G('Sprout', [0, s.cy + s.r * 0.8 * 0.98, 0]);
  sp.add(M(cyl(0.012, 0.016, 0.08, 6), SM.moss, 'Stem', [0, 0.03, 0]));
  [-1, 1].forEach((sg) => sp.add(M(sph(0.05, 10, 8), mat('Leaf', 0x6adf4a, { rough: 0.6 }), sg < 0 ? 'LeafL' : 'LeafR', [sg * 0.045, 0.085, 0], [0, 0, sg * -0.6], [1.3, 0.35, 0.8])));
  s.body.add(sp);
  return { object: s.root, animations: slimeClips(s) };
}

// ───────────────────────── Синий ─────────────────────────
export function slimeBlue() {
  const s = slimeBase('Slime_Blue', { body: SM.blue, mouth: 'smile', eye: { angry: 0.2 } });
  const top = s.cy + s.r * s.b.h * 0.92;
  const rnd = rng(11);
  const crown = G('IceCrown', [0, top - 0.06, 0]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const hh = 0.2 + rnd() * 0.1;
    crown.add(M(cone(0.05, hh, 5), SM.ice, `IceSpike${i}`, [Math.sin(a) * 0.17, hh / 2 - 0.03, Math.cos(a) * 0.17 - 0.02], [Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45]));
  }
  crown.add(M(cone(0.07, 0.36, 5), SM.ice, 'IceSpikeCenter', [0, 0.14, -0.02]));
  s.body.add(crown);
  // кристаллы по бокам
  [-1, 1].forEach((sg) => s.body.add(M(cone(0.035, 0.12, 5), SM.ice, 'SideCrystal', [sg * s.r * 0.88, s.cy + s.r * 0.2, -s.r * 0.1], [0, 0, -sg * 1.1])));
  return { object: s.root, animations: slimeClips(s) };
}

// ───────────────────────── Красный ─────────────────────────
export function slimeRed() {
  const s = slimeBase('Slime_Red', { body: SM.red, mouth: 'fangs', eye: { angry: 0.38 } });
  const top = s.cy + s.r * s.b.h * 0.9;
  const fire = G('Flame', [0, top - 0.04, 0]);
  const fireMat = mat('FlameBody', 0xd85000, { rough: 1, glow: 0x9a3a00 });
  const outer = M(flameGeo(0.34, 0.15, 10, 0.04), fireMat, 'FlameOuter');
  const mid = M(flameGeo(0.22, 0.09, 10, 0.03), P.gOrange, 'FlameMid', [0, 0.0, 0.01]);
  const inner = M(flameGeo(0.14, 0.05, 8, 0.02), P.gYellow, 'FlameInner', [0, 0.0, 0.02]);
  [-1, 1].forEach((sg) => fire.add(M(flameGeo(0.18, 0.065, 8, sg * 0.04), fireMat, 'FlameSide', [sg * 0.13, 0.0, 0], [0, 0, -sg * 0.3])));
  fire.add(outer, mid, inner);
  s.body.add(fire);
  const base = s.animations;
  const clips = slimeClips(s);
  clips[0].tracks.push(track.scl(fire, [0, 0.4, 0.8, 1.2, 1.6], [[1, 1, 1], [1.08, 1.18, 1.08], [0.94, 0.9, 0.94], [1.06, 1.14, 1.06], [1, 1, 1]]));
  return { object: s.root, animations: clips };
}

// ───────────────────────── Фиолетовый ─────────────────────────
export function slimePurple() {
  const s = slimeBase('Slime_Purple', { body: SM.purple, mouth: 'smile', eye: { angry: 0.3 }, eyeSize: 0.12 });
  const rnd = rng(5);
  const spikes = G('Spikes', [0, s.cy, 0]);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const el = 0.52 + rnd() * 0.15; // угол от оси Y
    const rr = s.r * 0.93;
    const nx = Math.sin(el) * Math.sin(a), ny = Math.cos(el), nz = Math.sin(el) * Math.cos(a);
    const hh = 0.1 + rnd() * 0.06;
    const m = M(cone(0.034, hh, 5), P.gPurple, `Spike${i}`, [nx * rr, ny * rr * s.b.h + hh * 0.2, nz * rr], [0, 0, 0]);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, ny, nz));
    spikes.add(m);
  }
  s.body.add(spikes);
  s.body.add(M(sph(s.r * 0.12, 8, 6), mat('CheekGlow', 0xff7ad9, { glow: 0x8a2a70, opacity: 0.6 }), 'CheekL', [s.r * 0.5, s.cy + s.r * 0.05, s.surfZ(s.r * 0.5, s.cy + s.r * 0.05) - 0.01], [0, 0, 0], [1.3, 0.7, 0.3]));
  s.body.add(M(sph(s.r * 0.12, 8, 6), mat('CheekGlow'), 'CheekR', [-s.r * 0.5, s.cy + s.r * 0.05, s.surfZ(s.r * 0.5, s.cy + s.r * 0.05) - 0.01], [0, 0, 0], [1.3, 0.7, 0.3]));
  return { object: s.root, animations: slimeClips(s) };
}

// ───────────────────────── Каменный ─────────────────────────
export function slimeStone() {
  const r = 0.42, h = 1.45, fb = 0.4;
  const root = G('Slime_Stone');
  const body = G('Body'); root.add(body);
  // корпус — рваный икосаэдр
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const rnd = rng(23);
  const jit = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 0.88 + rnd() * 0.22);
    const k = jit.get(key);
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, x * r * k * 1.05, (y >= 0 ? y * h : y * h * fb) * r * k, z * r * k * 1.05);
  }
  g.translate(0, r * h * fb, 0);
  body.add(M(flat(g), SM.stone, 'Rock'));
  // каменные пластины/наросты
  const rnd2 = rng(8);
  for (let i = 0; i < 6; i++) {
    const a = rnd2() * Math.PI * 2, el = 0.3 + rnd2() * 0.9;
    const d = new THREE.Vector3(Math.sin(el) * Math.sin(a), Math.cos(el), Math.sin(el) * Math.cos(a));
    if (d.z > 0.55 && d.y < 0.75) continue; // не закрываем лицо
    const m = M(flat(new THREE.DodecahedronGeometry(0.075 + rnd2() * 0.05, 0)), i % 2 ? SM.stoneDark : SM.stone, `Chunk${i}`,
      [d.x * r * 0.95, r * h * fb + d.y * r * h * 0.95, d.z * r * 0.95]);
    m.rotation.set(rnd2() * 3, rnd2() * 3, rnd2() * 3);
    body.add(m);
  }
  // мох
  body.add(M(flat(new THREE.IcosahedronGeometry(0.16, 0)), SM.moss, 'Moss', [-0.16, r * h * (fb + 0.9) * 0.95, -0.12], [0, 0.4, 0], [1.2, 0.35, 1]));
  body.add(M(flat(new THREE.IcosahedronGeometry(0.1, 0)), SM.moss, 'Moss2', [0.2, r * h * (fb + 0.85) * 0.93, -0.1], [0, 0.9, 0], [1.1, 0.35, 1]));
  // лицо: тёмные глазницы с оранжевым свечением
  const cy = r * h * fb, ey = cy + r * h * 0.22;
  [-1, 1].forEach((sg) => {
    const e = G(sg < 0 ? 'Eye_R' : 'Eye_L', [sg * r * 0.3, ey, r * 0.83]);
    e.add(M(flat(new THREE.IcosahedronGeometry(0.085, 0)), P.black2, 'Socket', [0, 0, 0], [0, 0, 0], [1.15, 1, 0.7]));
    e.add(M(sph(0.045, 10, 8), P.gOrange, 'EyeGlow', [0, -0.005, 0.045], [0, 0, 0], [1.1, 0.9, 0.5]));
    e.add(M(flat(new THREE.BoxGeometry(0.15, 0.04, 0.05)), SM.stoneDark, 'Brow', [0, 0.085, 0.03], [0, 0, sg * -0.4]));
    body.add(e);
  });
  body.add(M(flat(new THREE.BoxGeometry(0.2, 0.035, 0.05)), P.black2, 'Mouth', [0, cy + r * h * -0.12, r * 0.88], [0, 0, 0.0]));
  const sq = (x, y) => [x, y, x];
  const idle = clip('Idle', 1.8, [track.scl(body, [0, 0.9, 1.8], [sq(1, 1), sq(1.02, 0.97), sq(1, 1)])]);
  const hop = clip('Hop', 1.1, [
    track.scl(body, [0, 0.2, 0.36, 0.55, 0.75, 0.9, 1.1], [sq(1, 1), sq(1.06, 0.9), sq(0.96, 1.06), sq(0.98, 1.03), sq(0.97, 1.04), sq(1.08, 0.88), sq(1, 1)]),
    track.pos(body, [0, 0.2, 0.36, 0.55, 0.75, 0.9, 1.1], [[0, 0, 0], [0, 0, 0], [0, 0.2, 0], [0, 0.42, 0], [0, 0.2, 0], [0, 0, 0], [0, 0, 0]]),
  ]);
  return { object: root, animations: [idle, hop] };
}

// ───────────────────────── Королевский ─────────────────────────
export function slimeRoyal() {
  const s = slimeBase('Slime_Royal', { r: 0.46, body: SM.royal, mouth: 'smile', eye: { angry: 0.15 }, eyeSize: 0.12 });
  const top = s.cy + s.r * s.b.h * 0.96;
  const crown = makeCrown(0.17, 0.2, 5, P.gold, P.gRed, 'Crown');
  crown.position.set(0, top - 0.06, -0.02); crown.rotation.set(-0.12, 0, 0.08);
  s.body.add(crown);
  // золотые искры вокруг
  [[0.5, 0.7, 0.3], [-0.55, 0.55, 0.2], [0.35, 0.95, -0.3]].forEach(([x, y, z], i) => s.body.add(M(oct(0.03), P.gGold, `Sparkle${i}`, [x, y, z], [0.3, 0.5, 0.2])));
  // мантия-«воротник» из слизи
  s.body.add(M(tor(s.r * 0.62, 0.035, 8, 28), P.gold, 'Collar', [0, s.cy + s.r * 0.12, 0], [Math.PI / 2 + 0.1, 0, 0]));
  const clips = slimeClips(s);
  clips[0].tracks.push(track.rot(crown, [0, 0.8, 1.6], [[-0.12, 0, 0.08], [-0.12, 0, -0.06], [-0.12, 0, 0.08]]));
  return { object: s.root, animations: clips };
}

export const enemies = [
  ['slime_green', 'Зелёный слизень', slimeGreen],
  ['slime_blue', 'Синий слизень', slimeBlue],
  ['slime_red', 'Красный слизень', slimeRed],
  ['slime_purple', 'Фиолетовый слизень', slimePurple],
  ['slime_stone', 'Каменный слизень', slimeStone],
  ['slime_royal', 'Королевский слизень', slimeRoyal],
];
