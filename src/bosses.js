// Боссы: Король слизней, Тёмный король слизней, Слизневый дракон.
import {
  THREE, P, mat, dim, M, G, rod, rbox, cyl, cone, sph, tor, oct, lathe, tube, extrudePoly, flameGeo, makeCrown, makeEyes, finalize, clip, track, rng, blobGeo,
} from './lib.js';
import { SM, slimeBase } from './enemies.js';

const mirrorPts = (pts) => pts.map(([x, y]) => [-x, y]).reverse();

/** Кольцо языков пламени позади тела (аура босса). Возвращает массив для анимации. */
function flameRing(parent, n, radius, y, hMin, hMax, material, seed, arcFrom = 1.25, arcTo = 5.05) {
  const rnd = rng(seed); const list = [];
  for (let i = 0; i < n; i++) {
    const a = arcFrom + (i / (n - 1)) * (arcTo - arcFrom);
    const hh = hMin + rnd() * (hMax - hMin);
    const f = M(flameGeo(hh, hh * 0.2, 8, 0.05), material, `AuraFlame${i}`,
      [Math.sin(a) * radius, y, Math.cos(a) * radius], [-Math.cos(a) * 0.35, a, Math.sin(a) * 0.35 * 0]);
    parent.add(f); list.push(f);
  }
  return list;
}
const flicker = (nodes, dur = 1.2) => nodes.map((f, i) =>
  track.scl(f, [0, dur * (0.3 + (i % 4) * 0.12), dur], [[1, 1, 1], [1.12, 1.22, 1.12], [1, 1, 1]]));

/** Пасть с зубами на поверхности «капли». */
function bigMouth(s, y, w, hgt, teeth, toothMat = P.white, inner = mat('MouthInner', 0x2a0a12, { rough: 0.5 })) {
  const z = s.surfZ(0, y) - w * 0.1;
  const g = G('Mouth', [0, y, z]);
  g.add(M(sph(1, 20, 14), inner, 'MouthCavity', [0, 0, 0], [0, 0, 0], [w, hgt, w * 0.25]));
  for (let i = 0; i < teeth; i++) {
    const t = (i + 0.5) / teeth * 2 - 1;
    const x = t * w * 0.82;
    g.add(M(cone(w * 0.075, hgt * 0.7, 5), toothMat, `ToothUp${i}`, [x, hgt * 0.62, w * 0.2], [Math.PI, 0, 0]));
    if (i % 2 === 0) g.add(M(cone(w * 0.06, hgt * 0.5, 5), toothMat, `ToothLow${i}`, [x * 0.9, -hgt * 0.65, w * 0.2]));
  }
  g.add(M(sph(1, 12, 8), mat('Tongue', 0xe0507a, { rough: 0.4 }), 'Tongue', [0, -hgt * 0.45, w * 0.1], [0, 0, 0], [w * 0.5, hgt * 0.35, w * 0.12]));
  return g;
}

// ═══════════════════════════ Король слизней ═══════════════════════════
export function bossSlimeKing() {
  const s = slimeBase('Boss_SlimeKing', { r: 1.15, body: mat('KingGreen', 0x2fcf3a, { rough: 0.12, glow: 0x0a4a10 }), mouth: 'none', eye: { angry: 0.42, mat: mat('KingEyeWhite', 0xfdffd0, { rough: 0.3, glow: 0x555a20 }) }, eyeX: 0.3, eyeY: 0.28, eyeSize: 0.13 });
  const top = s.cy + s.r * s.b.h * 0.97;
  s.body.add(bigMouth(s, s.cy - s.r * 0.1, s.r * 0.34, s.r * 0.15, 6));
  const crown = makeCrown(0.5, 0.62, 7, P.gold, P.gRed, 'Crown');
  crown.position.set(0, top - 0.22, -0.05); crown.rotation.set(-0.15, 0, -0.1);
  s.body.add(crown);
  // капли слизи по бокам / толстая «мантия»-кайма у основания
  s.body.add(M(tor(s.r * 0.98, 0.1, 10, 40), SM.green, 'Rim', [0, 0.12, 0], [Math.PI / 2, 0, 0], [1, 1, 0.8]));
  // аура
  const aura = G('Aura', [0, 0, 0]);
  const flames = flameRing(aura, 13, s.r * 1.02, 0.1, 0.9, 1.6, P.aGreen, 3);
  s.body.add(aura);
  // искры
  const rnd = rng(9);
  for (let i = 0; i < 8; i++) s.body.add(M(oct(0.05 + rnd() * 0.03), P.gGreen, `Spark${i}`, [(rnd() - 0.5) * 3.2, 0.8 + rnd() * 1.6, -0.6 - rnd() * 0.8], [rnd(), rnd(), rnd()]));
  const sq = (x, y) => [x, y, x];
  const idle = clip('Idle', 2.0, [
    track.scl(s.body, [0, 1, 2], [sq(1, 1), sq(1.035, 0.955), sq(1, 1)]),
    track.rot(crown, [0, 1, 2], [[-0.15, 0, -0.1], [-0.12, 0.05, -0.04], [-0.15, 0, -0.1]]),
    ...flicker(flames, 1.0),
  ]);
  return { object: s.root, animations: [idle] };
}

// ═══════════════════════════ Тёмный король слизней ═══════════════════════════
export function bossDarkSlimeKing() {
  const bodyMat = mat('DarkKingBody', 0x321a5e, { rough: 0.2, glow: 0x12082a });
  const s = slimeBase('Boss_DarkSlimeKing', { r: 1.2, body: bodyMat, mouth: 'none', eye: { angry: 0.45, mat: P.gPurple }, eyeX: 0.3, eyeY: 0.28, eyeSize: 0.13 });
  const top = s.cy + s.r * s.b.h * 0.97;
  s.body.add(bigMouth(s, s.cy - s.r * 0.1, s.r * 0.34, s.r * 0.15, 6, mat('DarkTooth', 0xdad0ff, { rough: 0.4 }), mat('DarkMouthInner', 0x0b0316, { rough: 0.5 })));
  // шипастая корона
  const crown = makeCrown(0.55, 0.85, 7, P.black, P.gPurple, 'Crown');
  crown.position.set(0, top - 0.25, -0.05); crown.rotation.set(-0.15, 0, 0.05);
  s.body.add(crown);
  // латный воротник и наплечники
  const armorM = P.black;
  const collarY = s.cy + s.r * s.b.h * 0.62, collarR = s.r * Math.sqrt(1 - 0.62 ** 2) * 1.02;
  s.body.add(M(tor(collarR, 0.1, 8, 36), armorM, 'Collar', [0, collarY, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    s.body.add(M(cone(0.07, 0.26, 6), P.blackTrim, `CollarSpike${i}`, [Math.sin(a) * collarR * 1.05, collarY + 0.1, Math.cos(a) * collarR * 1.05], [Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7]));
  }
  [-1, 1].forEach((sg) => {
    const pa = G(sg < 0 ? 'Pauldron_R' : 'Pauldron_L', [sg * s.r * 0.92, s.cy + s.r * 0.35, -0.05], [0, 0, -sg * 0.5]);
    pa.add(M(sph(0.38, 16, 12), armorM, 'PauldronDome', [0, 0, 0], [0, 0, 0], [1, 0.75, 1]));
    pa.add(M(tor(0.34, 0.035, 6, 20), P.gPurple, 'PauldronRune', [0, -0.04, 0], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 3; i++) pa.add(M(cone(0.07, 0.34 - i * 0.05, 6), P.blackTrim, `PauldronSpike${i}`, [sg * (0.0 + i * 0.12), 0.26 - i * 0.04, 0.1 - i * 0.14], [0.2 - i * 0.2, 0, -sg * (0.15 + i * 0.3)]));
    s.body.add(pa);
  });
  // пурпурное пламя за спиной
  const aura = G('Aura');
  const flames = flameRing(aura, 15, s.r * 1.05, 0.1, 1.0, 1.9, P.aPurple, 17);
  s.body.add(aura);
  const sq = (x, y) => [x, y, x];
  const idle = clip('Idle', 2.2, [
    track.scl(s.body, [0, 1.1, 2.2], [sq(1, 1), sq(1.03, 0.96), sq(1, 1)]),
    track.rot(crown, [0, 1.1, 2.2], [[-0.15, 0, 0.05], [-0.1, 0.04, 0.0], [-0.15, 0, 0.05]]),
    ...flicker(flames, 1.1),
  ]);
  return { object: s.root, animations: [idle] };
}

// ═══════════════════════════ Слизневый дракон ═══════════════════════════
export function bossSlimeDragon() {
  const slime = mat('DragonSlime', 0x8a3df0, { rough: 0.14, glow: 0x2a0a60 });
  const scale = mat('DragonScale', 0x5c22b0, { rough: 0.4, glow: 0x14063a });
  const bone = mat('DragonBone', 0xe2d6ff, { rough: 0.4 });
  const membrane = mat('DragonMembrane', 0x7a35d6, { rough: 0.5, double: true, glow: 0x20084a });
  const root = G('Boss_SlimeDragon');
  const body = G('Body'); root.add(body);
  const R = 0.95, H = 1.2, FB = 0.45;
  body.add(M(blobGeo(R, H, FB), slime, 'Blob'));
  body.add(M(cyl(R * 0.98, R * 1.08, 0.1, 40), slime, 'Puddle', [0, 0.05, 0]));
  const cy = R * H * FB;
  // шея → голова
  const neck = [[0, cy + 0.45, 0.3], [0, cy + 0.95, 0.5], [0, cy + 1.4, 0.55], [0, cy + 1.7, 0.72]];
  body.add(M(tube(neck, [0.46, 0.34, 0.3, 0.3], { radial: 18, segs: 22 }), scale, 'Neck'));
  for (let i = 0; i < 5; i++) { // шипы по шее/спине
    const t = i / 5;
    body.add(M(cone(0.06 - t * 0.01, 0.2, 6), bone, `NeckSpike${i}`, [0, cy + 0.55 + t * 1.15, 0.2 + t * 0.12 - 0.12 + 0.3], [-0.5, 0, 0]));
  }
  const head = G('Head', [0, cy + 1.78, 0.85], [0.2, 0, 0], 1.75);
  body.add(head);
  head.add(M(sph(0.3, 20, 14), scale, 'Skull', [0, 0, 0], [0, 0, 0], [1, 0.9, 1.15]));
  head.add(M(rbox(0.3, 0.2, 0.36, 0.08), scale, 'Snout', [0, -0.05, 0.38]));
  head.add(M(rbox(0.28, 0.08, 0.4, 0.03), scale, 'Jaw', [0, -0.2, 0.3], [0.2, 0, 0]));
  [-1, 1].forEach((sg) => {
    head.add(M(sph(0.035, 8, 6), P.black2, 'Nostril', [sg * 0.07, -0.0, 0.56]));
    head.add(M(sph(0.075, 12, 10), P.gBlue, sg < 0 ? 'EyeR' : 'EyeL', [sg * 0.17, 0.1, 0.22], [0, 0, 0], [1, 1.1, 0.6]));
    head.add(M(sph(0.03, 8, 6), P.black2, 'Pupil', [sg * 0.18, 0.1, 0.27], [0, 0, 0], [0.5, 1.4, 0.6]));
    head.add(M(rbox(0.16, 0.035, 0.06, 0.012), scale, 'Brow', [sg * 0.17, 0.2, 0.24], [0, 0, -sg * 0.35]));
    head.add(M(tube([[sg * 0.16, 0.2, -0.08], [sg * 0.3, 0.4, -0.25], [sg * 0.34, 0.55, -0.5], [sg * 0.3, 0.5, -0.72]], [0.06, 0.05, 0.035, 0.0], { radial: 8, segs: 14 }), bone, sg < 0 ? 'HornR' : 'HornL'));
    for (let i = 0; i < 4; i++) {
      head.add(M(cone(0.018, 0.07, 5), P.white, `Tooth${sg}_${i}`, [sg * 0.1, -0.13, 0.28 + i * 0.1], [Math.PI, 0, 0]));
    }
  });
  head.add(M(cone(0.05, 0.16, 6), bone, 'NoseHorn', [0, 0.06, 0.52], [-0.9, 0, 0]));
  // крылья
  const wingN = {};
  [-1, 1].forEach((sg) => {
    const w = G(sg < 0 ? 'Wing_R' : 'Wing_L', [sg * 0.36, cy + 0.95, -0.38], [0, sg * 0.7, sg * 0.15], 1.25);
    const pts = [[0, 0], [0.3, 0.75], [1.2, 1.2], [1.0, 0.65], [1.55, 0.3], [1.1, 0.02], [1.25, -0.55], [0.6, -0.25], [0.12, -0.4]];
    const poly = sg > 0 ? pts : mirrorPts(pts);
    w.add(M(extrudePoly(poly, 0.03, 0.004), membrane, 'Membrane'));
    [[1.2, 1.2], [1.55, 0.3], [1.25, -0.55]].forEach(([x, y], i) => w.add(rod([0, 0, 0], [sg * x, y, 0], 0.035 - i * 0.004, bone, `WingBone${i}`, 6)));
    w.add(M(sph(0.07, 10, 8), scale, 'WingJoint'));
    body.add(w); wingN[sg] = w;
  });
  // шипы вдоль спины
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    body.add(M(cone(0.1 - t * 0.03, 0.34 - t * 0.1, 6), bone, `BackSpike${i}`, [0, cy + 0.9 - t * 0.7, -0.62 - t * 0.35], [-0.9 - t * 0.2, 0, 0]));
  }
  // хвост
  const tail = G('Tail', [0, 0, 0]);
  tail.add(M(tube([[0, 0.45, -0.7], [0, 0.35, -1.3], [0.35, 0.3, -1.85], [0.8, 0.55, -2.15], [1.15, 0.95, -2.1]], [0.38, 0.26, 0.17, 0.1, 0.0], { radial: 14, segs: 26 }), slime, 'TailBody'));
  tail.add(M(cone(0.16, 0.42, 6), bone, 'TailSpike', [1.2, 1.05, -2.05], [0.2, 0, -1.0]));
  for (let i = 0; i < 3; i++) tail.add(M(cone(0.05, 0.16, 5), bone, `TailFin${i}`, [0.1 + i * 0.3, 0.42 + i * 0.1 - 0.0, -1.55 - i * 0.25], [-0.2, 0, 0]));
  body.add(tail);
  // глаза-блики капли
  body.add(M(sph(0.14, 10, 8), SM.gloss, 'Sheen', [-0.45, cy + 0.7, 0.55], [0.5, -0.7, 0.4], [1.5, 0.7, 0.5]));
  const idle = clip('Idle', 2.4, [
    track.scl(body, [0, 1.2, 2.4], [[1, 1, 1], [1.02, 0.98, 1.02], [1, 1, 1]]),
    track.rot(wingN[1], [0, 0.6, 1.2, 1.8, 2.4], [[0, 0.7, 0.15], [0, 0.7, -0.25], [0, 0.7, 0.15], [0, 0.7, -0.25], [0, 0.7, 0.15]]),
    track.rot(wingN[-1], [0, 0.6, 1.2, 1.8, 2.4], [[0, -0.7, -0.15], [0, -0.7, 0.25], [0, -0.7, -0.15], [0, -0.7, 0.25], [0, -0.7, -0.15]]),
    track.rot(head, [0, 1.2, 2.4], [[0.18, 0, 0], [0.08, 0.1, 0], [0.18, 0, 0]]),
    track.rot(tail, [0, 1.2, 2.4], [[0, 0.05, 0], [0, -0.06, 0], [0, 0.05, 0]]),
  ]);
  return { object: root, animations: [idle] };
}

export const bosses = [
  ['boss_slime_king', 'Король слизней', bossSlimeKing],
  ['boss_dark_slime_king', 'Тёмный король слизней', bossDarkSlimeKing],
  ['boss_slime_dragon', 'Слизневый дракон', bossSlimeDragon],
];
