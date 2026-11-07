// Оружие. Хват (рукоять) в начале координат, рабочая часть направлена в +Y, лезвие плоскостью к ±Z.
// Масштаб — под героев игры (меч ≈ 0.95 м при росте героя ≈ 1.4 м).
import {
  THREE, P, mat, dim, M, G, rod, rbox, cyl, cone, sph, tor, oct, lathe, extrudePoly, extrudeShape, tube, flameGeo, finalize,
} from './lib.js';

const mirrorPts = (pts) => pts.map(([x, y]) => [-x, y]).reverse();
/** Симметричный контур: R — правая половина сверху вниз (от x=0), зеркалим влево. */
const sym = (R) => [...R, ...mirrorPts(R)];

const woodBlade = mat('BladeWood', 0xb88650, { rough: 0.8 });
const ironBlade = mat('BladeIron', 0xd3dae6, { metal: 0.92, rough: 0.2 });
const goldBlade = mat('BladeGold', 0xffc93c, { metal: 1, rough: 0.2, glow: 0x4a3200 });
const iceBlade = mat('BladeIce', 0x5cc8ff, { metal: 0.2, rough: 0.08, glow: 0x0f4f98 });
const dragonBlade = mat('BladeDragon', 0x9a1d12, { metal: 0.6, rough: 0.3, glow: 0x3a0600 });
const fireBlade = mat('BladeFire', 0xff5a0a, { rough: 0.4, glow: 0x9a2a04 });

/** Базовая сборка меча. */
export function sword({
  name, len = 0.74, w = 0.072, tip = 0.15, blade, ridge, guard = 'cross', guardMat = P.steelDark, gripMat = P.leather,
  pommelMat = P.steelDark, gem = null, bladePts = null, thick = 0.02, guardW = 0.28, edgeMat = null,
}) {
  const g = new THREE.Group(); g.name = name;
  // рукоять и навершие
  g.add(M(cyl(0.025, 0.025, 0.17, 12), gripMat, 'Grip', [0, -0.045, 0]));
  for (let i = 0; i < 4; i++) g.add(M(tor(0.027, 0.006, 6, 14), P.leatherLight, `GripWrap${i}`, [0, -0.1 + i * 0.04, 0], [Math.PI / 2, 0, 0]));
  g.add(M(sph(0.04, 14, 10), pommelMat, 'Pommel', [0, -0.15, 0]));
  if (gem) g.add(M(sph(0.018, 8, 6), gem, 'PommelGem', [0, -0.15, 0.035]));
  // гарда
  const gu = G('Guard', [0, 0.05, 0]);
  if (guard === 'cross') {
    gu.add(M(rbox(guardW, 0.04, 0.055, 0.015), guardMat, 'Crossbar'));
    gu.add(M(sph(0.028, 10, 8), guardMat, 'GuardCapL', [-guardW / 2, 0, 0]));
    gu.add(M(sph(0.028, 10, 8), guardMat, 'GuardCapR', [guardW / 2, 0, 0]));
  } else if (guard === 'wings') {
    const R = [[0, 0.03], [0.07, 0.035], [0.15, 0.07], [0.21, 0.13], [0.2, 0.06], [0.24, 0.07], [0.17, -0.015], [0.08, -0.03], [0, -0.03]];
    gu.add(M(extrudePoly(sym(R), 0.04, 0.006), guardMat, 'WingGuard'));
  } else if (guard === 'claws') {
    const R = [[0, 0.035], [0.07, 0.04], [0.14, 0.1], [0.2, 0.2], [0.17, 0.08], [0.25, 0.1], [0.2, 0.0], [0.27, -0.02], [0.15, -0.04], [0.06, -0.035], [0, -0.035]];
    gu.add(M(extrudePoly(sym(R), 0.045, 0.006), guardMat, 'ClawGuard'));
  } else if (guard === 'crystal') {
    gu.add(M(rbox(guardW, 0.035, 0.05, 0.012), guardMat, 'Crossbar'));
    [-1, 1].forEach((s) => {
      gu.add(M(oct(0.05), iceBlade, s < 0 ? 'ShardL' : 'ShardR', [s * guardW * 0.5, 0.03, 0], [0, 0, s * 0.5], [0.6, 1.6, 0.6]));
      gu.add(M(oct(0.035), iceBlade, s < 0 ? 'ShardL2' : 'ShardR2', [s * guardW * 0.36, -0.03, 0], [0, 0, -s * 0.8], [0.6, 1.4, 0.6]));
    });
  }
  if (gem) gu.add(M(sph(0.026, 12, 10), gem, 'GuardGem', [0, 0, 0.032], [0, 0, 0], [1, 1.2, 0.6]));
  g.add(gu);
  // клинок
  const bp = bladePts || [[-w, 0], [w, 0], [w * 0.9, len - tip], [0, len], [-w * 0.9, len - tip]];
  const b = M(extrudePoly(bp, thick, 0.007), blade, 'Blade', [0, 0.075, 0]);
  g.add(b);
  if (ridge) g.add(M(rbox(w * 0.28, len * 0.78, thick + 0.012, 0.006), ridge, 'Fuller', [0, 0.075 + len * 0.42, 0]));
  if (edgeMat) {
    [-1, 1].forEach((s) => g.add(M(rbox(0.008, len * 0.8, thick + 0.004, 0.003), edgeMat, s < 0 ? 'EdgeL' : 'EdgeR', [s * (w - 0.004), 0.075 + len * 0.45, 0])));
  }
  return g;
}

// ───────────────────────────── мечи ─────────────────────────────
export function swordWooden() {
  const g = sword({ name: 'Sword_Wooden', blade: woodBlade, ridge: P.wood, guardMat: P.woodDark, gripMat: P.woodDark, pommelMat: P.wood, len: 0.68, w: 0.066, thick: 0.028 });
  return { object: g };
}
export function swordIron() {
  const g = sword({ name: 'Sword_Iron', blade: ironBlade, ridge: P.steelLight, guardMat: P.steelDark, pommelMat: P.steelDark });
  return { object: g };
}
export function swordGold() {
  const g = sword({ name: 'Sword_Gold', blade: goldBlade, ridge: P.steelLight, guard: 'wings', guardMat: P.gold, gripMat: P.clothBlue, pommelMat: P.gold, gem: P.gBlue, len: 0.78, w: 0.074 });
  return { object: g };
}
export function swordFire() {
  const w = 0.07, len = 0.82;
  const R = [[0, len], [w * 0.9, len - 0.14], [w * 1.35, len - 0.2], [w * 0.8, len - 0.28], [w * 1.45, len - 0.36], [w * 0.85, len - 0.46], [w * 1.5, len - 0.55], [w * 0.95, len - 0.64], [w * 1.2, len - 0.74], [w * 0.8, 0]];
  const pts = [...R.map(([x, y]) => [x, y]), ...mirrorPts(R)];
  // sym даёт контур от верха вниз по правой стороне, затем зеркальный подъём по левой
  const g = sword({ name: 'Sword_Fire', blade: fireBlade, guard: 'claws', guardMat: P.black, gripMat: P.black, pommelMat: P.black, gem: P.gRed, bladePts: pts, len, w, thick: 0.03 });
  g.add(M(extrudePoly(sym([[0, len - 0.04], [w * 0.4, len - 0.3], [w * 0.5, 0.06], [0, 0.0]].map(([x, y]) => [x, y])), 0.04, 0.004), P.gYellow, 'Core', [0, 0.075, 0]));
  [[0.12, 0.62, 0.2], [-0.13, 0.46, 0.17], [0.12, 0.34, 0.16]].forEach(([x, y, h], i) => {
    g.add(M(flameGeo(h, 0.045, 8, x * 0.5), P.aOrange, `Flame${i}`, [x, y, 0.02], [0, i, 0]));
  });
  return { object: g };
}
export function swordIce() {
  const w = 0.07, len = 0.82;
  const R = [[0, len], [w * 0.85, len - 0.16], [w * 1.0, len - 0.12], [w * 1.25, len - 0.3], [w * 0.8, len - 0.3], [w * 1.2, len - 0.5], [w * 0.8, len - 0.5], [w * 1.0, len - 0.7], [w * 0.8, 0]];
  const pts = [...R, ...mirrorPts(R)];
  const g = sword({ name: 'Sword_Ice', blade: iceBlade, ridge: P.gCyan, guard: 'crystal', guardMat: P.steelLight, gripMat: P.clothBlue, pommelMat: P.steelLight, gem: P.gCyan, bladePts: pts, len, w, thick: 0.034 });
  g.add(M(oct(0.05), iceBlade, 'PommelCrystal', [0, -0.2, 0], [0, 0, 0], [0.7, 1.4, 0.7]));
  return { object: g };
}
export function swordDragon() {
  const w = 0.078, len = 0.86;
  const R = [[0, len], [w * 0.95, len - 0.16], [w * 1.15, len - 0.3], [w * 1.0, len - 0.36], [w * 1.35, len - 0.46], [w * 1.05, len - 0.5], [w * 1.3, len - 0.62], [w * 0.9, 0.0]];
  const pts = [...R, ...mirrorPts(R)];
  const g = sword({ name: 'Sword_Dragon', blade: dragonBlade, ridge: P.gOrange, guard: 'claws', guardMat: P.goldDark, gripMat: P.black, pommelMat: P.goldDark, gem: P.gOrange, bladePts: pts, len, w, thick: 0.034, edgeMat: P.gOrange });
  // голова дракона на гарде
  const head = G('DragonHead', [0, 0.1, 0.0]);
  head.add(M(cone(0.045, 0.11, 6), P.goldDark, 'Snout', [0, 0.055, 0.0], [0, 0, 0], [1, 1, 0.8]));
  head.add(M(cone(0.012, 0.08, 5), P.gold, 'HornL', [-0.04, 0.07, -0.01], [0.1, 0, 0.6]));
  head.add(M(cone(0.012, 0.08, 5), P.gold, 'HornR', [0.04, 0.07, -0.01], [0.1, 0, -0.6]));
  g.add(head);
  return { object: g };
}

export function swordDark() {
  const w = 0.085, len = 0.88;
  const R = [[0, len], [w * 0.95, len - 0.17], [w * 1.2, len - 0.3], [w * 1.0, len - 0.42], [w * 1.25, len - 0.56], [w * 0.95, len - 0.7], [w * 0.9, 0.0]];
  const pts = [...R, ...mirrorPts(R)];
  const blade = mat('BladeDark', 0x1d1b2b, { metal: 0.85, rough: 0.3 });
  const g = sword({ name: 'Sword_Dark', blade, ridge: P.gPurple, guard: 'claws', guardMat: P.black, gripMat: P.black, pommelMat: P.black, gem: P.gRed, bladePts: pts, len, w, thick: 0.036, edgeMat: P.gRed });
  return { object: g };
}

// ───────────────────────────── топор ─────────────────────────────
function crescent(R, a0, xi, side) {
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = -a0 + (i / n) * a0 * 2;
    pts.push([Math.cos(a) * R * 0.9, Math.sin(a) * R * 1.05]);
  }
  const xe = Math.cos(a0) * R * 0.9, ye = Math.sin(a0) * R * 1.05;
  for (let i = n; i >= 0; i--) {
    const t = -1 + (i / n) * 2; // от +1 до -1
    const tt = (i / n) * 2 - 1;
    pts.push([xi + (xe - xi) * tt * tt * 0.9, tt * ye]);
  }
  // убираем дубли и ориентируем: от нижней точки по внешней дуге вверх, назад по внутренней
  const poly = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-4);
  return side < 0 ? mirrorPts(poly) : poly;
}
export function axeWarrior() {
  const g = new THREE.Group(); g.name = 'Axe_Warrior';
  g.add(M(cyl(0.03, 0.034, 1.0, 12), P.wood, 'Shaft', [0, 0.15, 0]));
  g.add(M(cyl(0.038, 0.038, 0.26, 12), P.leather, 'GripWrap', [0, -0.05, 0]));
  g.add(M(cone(0.04, 0.12, 8), P.steelDark, 'Butt', [0, -0.4, 0], [Math.PI, 0, 0]));
  g.add(M(sph(0.04, 10, 8), P.steelDark, 'ButtCap', [0, -0.35, 0]));
  const head = G('Head', [0, 0.52, 0]);
  head.add(M(rbox(0.1, 0.2, 0.1, 0.02), P.steelDark, 'Hub'));
  head.add(M(extrudePoly(crescent(0.26, 0.9, 0.04, 1), 0.04, 0.008), P.steelLight, 'BladeR', [0.03, 0, 0]));
  head.add(M(extrudePoly(crescent(0.26, 0.9, 0.04, -1), 0.04, 0.008), P.steelLight, 'BladeL', [-0.03, 0, 0]));
  head.add(M(cone(0.04, 0.16, 6), P.steelLight, 'Spike', [0, 0.18, 0]));
  [-1, 1].forEach((s) => head.add(M(tor(0.04, 0.012, 6, 14), P.gold, `Band${s}`, [0, s * 0.09, 0], [Math.PI / 2, 0, 0])));
  g.add(head);
  return { object: g };
}

// ───────────────────────────── молот ─────────────────────────────
export function hammerTitan() {
  const g = new THREE.Group(); g.name = 'Hammer_Titan';
  g.add(M(cyl(0.035, 0.04, 0.95, 12), P.woodDark, 'Shaft', [0, 0.12, 0]));
  g.add(M(cyl(0.045, 0.045, 0.24, 12), P.leather, 'GripWrap', [0, -0.08, 0]));
  g.add(M(sph(0.055, 12, 10), P.steelDark, 'Pommel', [0, -0.37, 0]));
  const head = G('Head', [0, 0.55, 0]);
  head.add(M(rbox(0.52, 0.27, 0.27, 0.04), P.stone, 'Block'));
  [-1, 1].forEach((s) => {
    head.add(M(rbox(0.06, 0.31, 0.31, 0.02), P.steelDark, `Cap${s}`, [s * 0.27, 0, 0]));
    head.add(M(rbox(0.05, 0.29, 0.29, 0.015), P.steelDark, `Band${s}`, [s * 0.14, 0, 0]));
    head.add(M(rbox(0.03, 0.12, 0.12, 0.01), P.gBlue, `Rune${s}`, [s * 0.255, 0, 0.0]));
  });
  head.add(M(sph(0.05, 12, 10), P.gBlue, 'Gem', [0, 0, 0.14], [0, 0, 0], [1, 1, 0.5]));
  head.add(M(cone(0.045, 0.14, 6), P.steelDark, 'Spike', [0, 0.2, 0]));
  g.add(head);
  return { object: g };
}

// ───────────────────────────── лук ─────────────────────────────
export function bowHunter() {
  const g = new THREE.Group(); g.name = 'Bow_Hunter';
  const pts = [[0, -0.58, -0.12], [0, -0.34, -0.02], [0, 0, 0.05], [0, 0.34, -0.02], [0, 0.58, -0.12]];
  g.add(M(tube(pts, [0.012, 0.022, 0.034, 0.022, 0.012], { radial: 8, segs: 28 }), P.wood, 'Limbs'));
  [-1, 1].forEach((s) => {
    g.add(M(cone(0.02, 0.06, 6), P.gold, `Tip${s}`, [0, s * 0.6, -0.14], [s < 0 ? Math.PI : 0, 0, 0]));
    g.add(M(rbox(0.03, 0.2, 0.03, 0.008), P.gold, `Inlay${s}`, [0, s * 0.2, 0.0], [0.15 * s, 0, 0]));
  });
  g.add(M(cyl(0.04, 0.04, 0.2, 12), P.leather, 'Grip', [0, 0, 0.05]));
  g.add(M(sph(0.026, 8, 6), P.gBlue, 'Gem', [0, 0.12, 0.085]));
  g.add(M(cyl(0.004, 0.004, 1.2, 4), P.white, 'String', [0, 0, -0.145]));
  const arrow = G('Arrow', [0, 0, -0.02]);
  arrow.add(M(cyl(0.008, 0.008, 0.62, 6), P.woodLight, 'ArrowShaft', [0, 0, 0.18], [Math.PI / 2, 0, 0]));
  arrow.add(M(cone(0.018, 0.07, 6), P.steelLight, 'ArrowHead', [0, 0, 0.52], [Math.PI / 2, 0, 0]));
  arrow.add(M(rbox(0.004, 0.04, 0.09, 0.001), P.clothRed, 'FletchA', [0, 0.02, -0.08]));
  arrow.add(M(rbox(0.04, 0.004, 0.09, 0.001), P.clothRed, 'FletchB', [0.02, 0, -0.08]));
  g.add(arrow);
  return { object: g };
}

// ───────────────────────────── арбалет ─────────────────────────────
export function crossbow() {
  const g = new THREE.Group(); g.name = 'Crossbow';
  g.add(M(rbox(0.075, 0.62, 0.07, 0.02), P.wood, 'Stock', [0, 0.02, 0]));
  g.add(M(rbox(0.05, 0.3, 0.06, 0.02), P.woodDark, 'Grip', [0, -0.18, -0.045], [0.35, 0, 0]));
  g.add(M(rbox(0.09, 0.05, 0.08, 0.015), P.steelDark, 'Trigger', [0, -0.05, 0]));
  g.add(M(rbox(0.04, 0.5, 0.025, 0.008), P.steelDark, 'Rail', [0, 0.06, 0.045]));
  const prod = [[-0.34, 0.2, -0.0], [-0.2, 0.14, 0.0], [0, 0.12, 0], [0.2, 0.14, 0.0], [0.34, 0.2, -0.0]];
  g.add(M(tube(prod, [0.016, 0.026, 0.032, 0.026, 0.016], { radial: 8, segs: 24 }), P.steelDark, 'Prod'));
  [-1, 1].forEach((s) => g.add(M(sph(0.02, 8, 6), P.gold, `ProdTip${s}`, [s * 0.345, 0.2, 0])));
  g.add(M(rbox(0.2, 0.06, 0.07, 0.015), P.gold, 'ProdMount', [0, 0.12, 0]));
  [-1, 1].forEach((s) => g.add(rod([s * 0.345, 0.2, 0], [0, 0.03, 0.0], 0.004, P.white, `String${s}`, 4)));
  // болт на направляющей
  const bolt = G('Bolt', [0, 0.18, 0.065]);
  bolt.add(M(cyl(0.01, 0.01, 0.42, 6), P.woodLight, 'BoltShaft'));
  bolt.add(M(cone(0.02, 0.07, 6), P.steelLight, 'BoltHead', [0, 0.245, 0]));
  g.add(bolt);
  g.add(M(sph(0.022, 8, 6), P.gBlue, 'Gem', [0, 0.28, 0.04]));
  return { object: g };
}

// ───────────────────────────── магический посох ─────────────────────────────
export function staffMagic() {
  const g = new THREE.Group(); g.name = 'Staff_Magic';
  g.add(M(cyl(0.026, 0.032, 1.2, 12), P.woodDark, 'Shaft', [0, 0.18, 0]));
  g.add(M(cone(0.04, 0.12, 8), P.gold, 'Ferrule', [0, -0.46, 0], [Math.PI, 0, 0]));
  [-0.2, 0.1, 0.5].forEach((y, i) => g.add(M(tor(0.034, 0.01, 6, 16), P.gold, `Ring${i}`, [0, y, 0], [Math.PI / 2, 0, 0])));
  g.add(M(cyl(0.012, 0.03, 0.12, 8), P.gold, 'Collar', [0, 0.62, 0]));
  // оправа: четыре изогнутых зубца вокруг кристалла
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const c = [[Math.sin(a) * 0.03, 0.66, Math.cos(a) * 0.03], [Math.sin(a) * 0.12, 0.74, Math.cos(a) * 0.12], [Math.sin(a) * 0.1, 0.88, Math.cos(a) * 0.1], [Math.sin(a) * 0.035, 0.98, Math.cos(a) * 0.035]];
    g.add(M(tube(c, [0.014, 0.012, 0.01, 0.004], { radial: 6, segs: 16 }), P.gold, `Prong${i}`));
  }
  g.add(M(sph(0.085, 18, 14), P.gPurple, 'Crystal', [0, 0.82, 0], [0, 0, 0], [1, 1.35, 1]));
  g.add(M(sph(0.11, 14, 10), mat('AuraPurpleSoft', 0xb15cff, { glow: 0x6a2aa8, opacity: 0.28, double: true }), 'CrystalGlow', [0, 0.82, 0], [0, 0, 0], [1, 1.35, 1]));
  [[0.18, 0.95, 0.0], [-0.15, 0.7, 0.1], [0.05, 1.08, -0.15]].forEach(([x, y, z], i) =>
    g.add(M(oct(0.03), P.gPurple, `Shard${i}`, [x, y, z], [0.3 * i, 0.6, 0.2], [0.7, 1.2, 0.7])));
  return { object: g };
}

export const weapons = [
  ['sword_wooden', 'Деревянный меч', swordWooden],
  ['sword_iron', 'Железный меч', swordIron],
  ['sword_gold', 'Золотой меч', swordGold],
  ['sword_fire', 'Огненный меч', swordFire],
  ['sword_ice', 'Ледяной меч', swordIce],
  ['sword_dragon', 'Меч дракона', swordDragon],
  ['sword_dark', 'Тёмный меч (бонус)', swordDark],
  ['axe_warrior', 'Топор воина', axeWarrior],
  ['hammer_titan', 'Молот титана', hammerTitan],
  ['bow_hunter', 'Лук охотника', bowHunter],
  ['crossbow', 'Арбалет', crossbow],
  ['staff_magic', 'Магический посох', staffMagic],
];
