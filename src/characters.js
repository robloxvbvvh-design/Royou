// Главные персонажи: Обычный Рыцарь, Тёмный Рыцарь, Паладин, Маг-рыцарь.
// Иерархия: Root → Hips → (LegL, LegR, Torso → (Head, ArmL, ArmR)). Правая рука (персонажа) — в −X, перед — +Z.
// Слоты: Socket_Weapon_R (кисть правой руки), Socket_Shield_L (левое предплечье). Оружие по умолчанию — узел DefaultWeapon.
import {
  THREE, P, mat, dim, M, G, rbox, cyl, cone, sph, cap, tor, lathe, tube, cloth, extrudeShape, flameGeo, finalize, clip, track,
} from './lib.js';
import { swordIron, swordGold, swordDark, staffMagic } from './weapons.js';

/** Дуга тора, лежащая в горизонтальной плоскости и центрированная на +Z (щель шлема, шарф и т.п.). */
function arcFront(R, r, arc, seg = 24) {
  const g = tor(R, r, 6, seg, arc);
  g.rotateZ(Math.PI / 2 - arc / 2);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Щит-«геральдический» контур. */
function shieldShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w, h * 0.5);
  s.lineTo(w, h * 0.5);
  s.lineTo(w, h * 0.05);
  s.quadraticCurveTo(w, -h * 0.35, 0, -h * 0.5);
  s.quadraticCurveTo(-w, -h * 0.35, -w, h * 0.05);
  s.closePath();
  return s;
}
function makeShield(body, rim, emblem, boss) {
  const g = G('Shield');
  g.add(M(extrudeShape(shieldShape(0.17, 0.4), 0.035, 0.012), rim, 'ShieldRim'));
  g.add(M(extrudeShape(shieldShape(0.135, 0.34), 0.035, 0.01), body, 'ShieldFace', [0, 0, 0.012]));
  g.add(M(rbox(0.045, 0.26, 0.02, 0.008), emblem, 'ShieldStripeV', [0, 0.0, 0.05]));
  g.add(M(rbox(0.19, 0.045, 0.02, 0.008), emblem, 'ShieldStripeH', [0, 0.06, 0.05]));
  g.add(M(sph(0.04, 12, 10), boss, 'ShieldBoss', [0, 0.06, 0.055], [0, 0, 0], [1, 1, 0.55]));
  return g;
}

/**
 * Базовое тело chibi-рыцаря. Возвращает узлы для дальнейшей сборки.
 */
function baseBody(name, s) {
  const root = G(name);
  const hips = G('Hips', [0, 0.44, 0]); root.add(hips);
  const legL = G('LegL', [0.12, 0, 0]), legR = G('LegR', [-0.12, 0, 0]);
  for (const leg of [legL, legR]) {
    leg.add(M(cap(0.068, 0.16, 4, 12), s.under, 'Thigh', [0, -0.15, 0]));
    leg.add(M(sph(0.082, 14, 10), s.armor, 'Knee', [0, -0.2, 0.035], [0, 0, 0], [1, 0.85, 0.8]));
    leg.add(M(cyl(0.074, 0.082, 0.14, 14), s.armor, 'Greave', [0, -0.3, 0]));
    leg.add(M(rbox(0.17, 0.115, 0.27, 0.04), s.boot, 'Boot', [0, -0.385, 0.035]));
    leg.add(M(rbox(0.15, 0.04, 0.05, 0.015), s.armor, 'BootCap', [0, -0.35, 0.13]));
    hips.add(leg);
  }
  hips.add(M(rbox(0.36, 0.14, 0.25, 0.05), s.under, 'Pelvis', [0, 0.02, 0]));
  const torso = G('Torso', [0, 0.07, 0]); hips.add(torso);
  torso.add(M(rbox(0.44, 0.33, 0.3, 0.09), s.armor, 'Chest', [0, 0.2, 0]));
  torso.add(M(rbox(0.3, 0.2, 0.05, 0.03), s.armor2 || s.armor, 'ChestPlate', [0, 0.23, 0.15]));
  torso.add(M(cyl(0.225, 0.225, 0.07, 20), s.belt, 'Belt', [0, 0.03, 0]));
  torso.add(M(rbox(0.07, 0.07, 0.04, 0.012), s.buckle, 'Buckle', [0, 0.03, 0.225]));
  torso.add(M(cyl(0.1, 0.12, 0.08, 14), s.armor, 'Collar', [0, 0.38, 0]));
  const head = G('Head', [0, 0.39, 0]); torso.add(head);
  // руки
  const mkArm = (side) => {
    const a = G(side < 0 ? 'ArmR' : 'ArmL', [side * -0.285, 0.31, 0]);
    // side<0 → правая рука персонажа (−X)
    a.add(M(sph(0.11, 16, 12), s.armor, 'Pauldron', [0, 0.04, 0], [0, 0, 0], [1, 0.85, 1.05]));
    a.add(M(cap(0.052, 0.1, 4, 10), s.under, 'UpperArm', [0, -0.1, 0]));
    a.add(M(cyl(0.062, 0.058, 0.14, 12), s.armor, 'Vambrace', [0, -0.23, 0]));
    a.add(M(sph(0.075, 14, 10), s.glove, 'Hand', [0, -0.32, 0.01]));
    return a;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  // mkArm(-1) создаёт «ArmR» в x=+0.285 — исправляем знак: правая рука в −X
  armR.name = 'ArmR'; armR.position.x = -0.285;
  armL.name = 'ArmL'; armL.position.x = 0.285;
  armR.rotation.set(-0.5, 0, -0.12);
  armL.rotation.set(0, 0, 0.14);
  torso.add(armL, armR);
  const socketR = G('Socket_Weapon_R', [0, -0.32, 0.02], [0.75, 0, 0]); armR.add(socketR);
  const socketL = G('Socket_Shield_L', [0.08, -0.2, 0.12], [0, 0.35, 0]); armL.add(socketL);
  return { root, hips, legL, legR, torso, head, armL, armR, socketR, socketL };
}

/** Стандартные клипы Idle / Walk / Attack. */
function heroClips(n, extra = {}) {
  const base = { y: 0.44 };
  const idle = clip('Idle', 2.0, [
    track.pos(n.hips, [0, 1, 2], [[0, base.y, 0], [0, base.y - 0.012, 0], [0, base.y, 0]]),
    track.rot(n.torso, [0, 1, 2], [[0, 0, 0], [0.02, 0.03, 0], [0, 0, 0]]),
    track.rot(n.head, [0, 1, 2], [[0, 0, 0], [-0.03, -0.05, 0], [0, 0, 0]]),
    track.rot(n.armR, [0, 1, 2], [[-0.5, 0, -0.12], [-0.46, 0, -0.14], [-0.5, 0, -0.12]]),
    track.rot(n.armL, [0, 1, 2], [[0, 0, 0.14], [0.04, 0, 0.17], [0, 0, 0.14]]),
    ...(extra.idle || []),
  ]);
  const walk = clip('Walk', 0.8, [
    track.rot(n.legL, [0, 0.2, 0.4, 0.6, 0.8], [[0.6, 0, 0], [0, 0, 0], [-0.6, 0, 0], [0, 0, 0], [0.6, 0, 0]]),
    track.rot(n.legR, [0, 0.2, 0.4, 0.6, 0.8], [[-0.6, 0, 0], [0, 0, 0], [0.6, 0, 0], [0, 0, 0], [-0.6, 0, 0]]),
    track.rot(n.armL, [0, 0.2, 0.4, 0.6, 0.8], [[-0.5, 0, 0.14], [0, 0, 0.14], [0.5, 0, 0.14], [0, 0, 0.14], [-0.5, 0, 0.14]]),
    track.rot(n.armR, [0, 0.2, 0.4, 0.6, 0.8], [[-0.7, 0, -0.12], [-0.5, 0, -0.12], [-0.3, 0, -0.12], [-0.5, 0, -0.12], [-0.7, 0, -0.12]]),
    track.pos(n.hips, [0, 0.2, 0.4, 0.6, 0.8], [[0, 0.44, 0], [0, 0.465, 0], [0, 0.44, 0], [0, 0.465, 0], [0, 0.44, 0]]),
    track.rot(n.torso, [0, 0.4, 0.8], [[0.05, 0.1, 0], [0.05, -0.1, 0], [0.05, 0.1, 0]]),
    ...(extra.walk || []),
  ]);
  const attack = clip('Attack', 0.75, [
    track.rot(n.armR, [0, 0.2, 0.34, 0.75], [[-0.5, 0, -0.12], [-2.7, 0, -0.1], [0.2, 0, -0.1], [-0.5, 0, -0.12]]),
    track.rot(n.torso, [0, 0.2, 0.34, 0.75], [[0, 0, 0], [0, 0.5, 0], [0.1, -0.5, 0], [0, 0, 0]]),
    track.pos(n.hips, [0, 0.2, 0.34, 0.75], [[0, 0.44, 0], [0, 0.43, -0.03], [0, 0.42, 0.06], [0, 0.44, 0]]),
  ]);
  return [idle, walk, attack];
}

// ═══════════════════════════ Обычный Рыцарь ═══════════════════════════
export function knightNormal() {
  const s = {
    armor: P.steel, armor2: P.steelLight, under: mat('KnightUnder', 0x2c3d63, { rough: 0.8 }), boot: P.steelDark,
    belt: P.leather, buckle: P.gold, glove: P.steelDark,
  };
  const n = baseBody('Knight_Normal', s);
  // подол
  n.hips.add(M(lathe([[0.27, -0.12], [0.255, -0.08], [0.21, 0.0], [0.18, 0.06]], 24), P.clothBlueD, 'Skirt', [0, 0.01, 0]));
  // шлем
  const helm = lathe([[0.0, 0.0], [0.17, 0.0], [0.225, 0.04], [0.262, 0.13], [0.27, 0.25], [0.255, 0.35], [0.21, 0.44], [0.12, 0.5], [0.0, 0.525]], 28);
  n.head.add(M(helm, P.steel, 'Helmet'));
  n.head.add(M(arcFront(0.268, 0.035, 2.1), P.black2, 'VisorSlit', [0, 0.28, 0], [0, 0, 0], [1, 0.6, 1]));
  n.head.add(M(rbox(0.055, 0.17, 0.05, 0.015), P.black2, 'VisorBar', [0, 0.18, 0.263], [-0.08, 0, 0]));
  n.head.add(M(arcFront(0.275, 0.018, 2.4), P.steelLight, 'BrowRidge', [0, 0.35, 0], [0, 0, 0]));
  n.head.add(M(cyl(0.05, 0.06, 0.05, 10), P.steelDark, 'CrestBase', [0, 0.53, 0]));
  const plume = G('Plume', [0, 0.52, 0]);
  plume.add(M(tube([[0, 0, 0.02], [0, 0.13, -0.1], [0, 0.12, -0.3], [0, -0.04, -0.46]], [0.035, 0.078, 0.062, 0.0], { radial: 10, segs: 20 }), P.clothBlue, 'PlumeFeather'));
  n.head.add(plume);
  // щит и меч
  const shield = makeShield(P.clothBlue, P.steelLight, P.white, P.gold);
  n.socketL.add(shield);
  const sw = swordIron().object; sw.name = 'DefaultWeapon'; n.socketR.add(sw);
  const animations = heroClips(n, { idle: [track.rot(plume, [0, 1, 2], [[0, 0, 0], [0.08, 0, 0], [0, 0, 0]])] });
  return { object: n.root, animations };
}

// ═══════════════════════════ Тёмный Рыцарь ═══════════════════════════
export function knightDark() {
  const s = {
    armor: P.black, armor2: P.blackTrim, under: mat('DarkUnder', 0x2a1724, { rough: 0.8 }), boot: P.black,
    belt: P.leather, buckle: P.gRed, glove: P.black,
  };
  const n = baseBody('Knight_Dark', s);
  n.hips.add(M(lathe([[0.28, -0.13], [0.26, -0.08], [0.21, 0.0], [0.18, 0.06]], 24), P.clothRed, 'Skirt', [0, 0.01, 0]));
  // шипастые наплечники
  [n.armL, n.armR].forEach((a, i) => {
    a.add(M(cone(0.045, 0.16, 8), P.blackTrim, 'ShoulderSpike', [0, 0.14, 0], [0, 0, (i ? -1 : 1) * 0.25]));
  });
  // красная окантовка
  n.torso.add(M(tor(0.215, 0.012, 6, 24), P.gRed, 'ChestTrim', [0, 0.3, 0], [Math.PI / 2, 0, 0], [1, 1, 1]));
  // шлем
  const helm = lathe([[0.0, 0.0], [0.17, 0.0], [0.225, 0.04], [0.262, 0.13], [0.27, 0.25], [0.255, 0.35], [0.21, 0.44], [0.12, 0.5], [0.0, 0.525]], 28);
  n.head.add(M(helm, P.black, 'Helmet'));
  n.head.add(M(arcFront(0.268, 0.042, 2.3), P.black2, 'VisorSlit', [0, 0.27, 0], [0, 0, 0], [1, 0.7, 1]));
  [-1, 1].forEach((sg) => n.head.add(M(rbox(0.125, 0.055, 0.045, 0.016), P.gRed, sg < 0 ? 'EyeR' : 'EyeL', [sg * 0.095, 0.272, 0.252], [0, sg * 0.42, sg * -0.22])));
  [-1, 1].forEach((sg) => n.head.add(M(cone(0.04, 0.2, 6), P.blackTrim, 'Horn', [sg * 0.2, 0.46, 0.0], [0, 0, -sg * 0.7])));
  n.head.add(M(cyl(0.05, 0.06, 0.05, 10), P.blackTrim, 'CrestBase', [0, 0.53, 0]));
  const plume = G('Plume', [0, 0.52, 0]);
  plume.add(M(tube([[0, 0, 0.04], [0, 0.17, -0.05], [0, 0.2, -0.26], [0, 0.02, -0.46]], [0.04, 0.09, 0.07, 0.0], { radial: 10, segs: 22 }), P.clothRed, 'PlumeFeather'));
  n.head.add(plume);
  // плащ
  const capeG = cloth(0.34, 0.56, 0.78, 8, 10, (u, v) => [0, 0, -0.04 - 0.22 * v * v + 0.025 * Math.sin(u * 9 + v * 3) * v]);
  const capeN = G('Cape', [0, 0.38, -0.17]);
  capeN.add(M(capeG, P.clothRed, 'CapeCloth'));
  capeN.add(M(rbox(0.38, 0.05, 0.05, 0.02), P.blackTrim, 'CapeCollar', [0, 0.0, 0.02]));
  n.torso.add(capeN);
  const sw = swordDark().object; sw.name = 'DefaultWeapon'; n.socketR.add(sw);
  const animations = heroClips(n, {
    idle: [track.rot(plume, [0, 1, 2], [[0, 0, 0], [0.1, 0, 0], [0, 0, 0]]), track.rot(capeN, [0, 1, 2], [[0, 0, 0], [0.07, 0, 0], [0, 0, 0]])],
    walk: [track.rot(capeN, [0, 0.4, 0.8], [[0.12, 0, 0], [0.3, 0, 0], [0.12, 0, 0]])],
  });
  return { object: n.root, animations };
}

// ═══════════════════════════ Паладин ═══════════════════════════
export function paladin() {
  const s = {
    armor: P.gold, armor2: P.steelLight, under: mat('PaladinUnder', 0xf1e6c8, { rough: 0.8 }), boot: P.goldDark,
    belt: P.clothWhite, buckle: P.gBlue, glove: P.gold,
  };
  const n = baseBody('Paladin', s);
  n.hips.add(M(lathe([[0.3, -0.14], [0.28, -0.09], [0.22, 0.0], [0.18, 0.06]], 24), P.clothWhite, 'Skirt', [0, 0.01, 0]));
  n.hips.add(M(tor(0.295, 0.014, 6, 28), P.gold, 'SkirtTrim', [0, -0.125, 0], [Math.PI / 2, 0, 0]));
  // светящийся крест на груди
  n.torso.add(M(rbox(0.035, 0.17, 0.02, 0.008), P.gWhite, 'CrossV', [0, 0.23, 0.18]));
  n.torso.add(M(rbox(0.11, 0.035, 0.02, 0.008), P.gWhite, 'CrossH', [0, 0.26, 0.18]));
  // шлем
  const helm = lathe([[0.0, 0.0], [0.17, 0.0], [0.225, 0.04], [0.262, 0.13], [0.27, 0.25], [0.255, 0.35], [0.21, 0.44], [0.12, 0.5], [0.0, 0.525]], 28);
  n.head.add(M(helm, P.gold, 'Helmet'));
  n.head.add(M(arcFront(0.268, 0.034, 2.2), P.gWhite, 'VisorGlow', [0, 0.27, 0], [0, 0, 0], [1, 0.6, 1]));
  n.head.add(M(arcFront(0.275, 0.02, 2.5), P.goldDark, 'BrowRidge', [0, 0.34, 0]));
  // крылья на шлеме
  [-1, 1].forEach((sg) => {
    const w = [[0, 0], [0.12, 0.05], [0.24, 0.17], [0.2, 0.12], [0.22, 0.04], [0.12, -0.03], [0, -0.04]];
    const shp = new THREE.Shape(w.map(([x, y]) => new THREE.Vector2(x * sg, y)));
    const geo = extrudeShape(shp, 0.025, 0.006);
    // для sg<0 порядок обхода обратный — три.js сам нормализует контур
    n.head.add(M(geo, P.gold, sg < 0 ? 'HelmWingR' : 'HelmWingL', [sg * 0.25, 0.3, -0.01], [0, sg * 0.25, sg * 0.25]));
  });
  n.head.add(M(cyl(0.035, 0.05, 0.08, 10), P.gold, 'CrestBase', [0, 0.54, 0]));
  n.head.add(M(sph(0.045, 10, 8), P.gBlue, 'CrestGem', [0, 0.59, 0]));
  // нимб
  const halo = G('Halo', [0, 0.78, 0]);
  halo.add(M(tor(0.22, 0.022, 10, 36), P.gGold, 'HaloRing', [0, 0, 0], [Math.PI / 2 - 0.12, 0, 0]));
  halo.add(M(tor(0.22, 0.04, 10, 36), mat('HaloGlow', 0xffe27a, { glow: 0x8a6a10, opacity: 0.3, double: true }), 'HaloGlow', [0, 0, 0], [Math.PI / 2 - 0.12, 0, 0]));
  n.head.add(halo);
  // золотая аура-«пламя» за плечами
  const aura = G('Aura', [0, 0.3, -0.2]);
  const flames = [];
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) / 3; // −1..1
    const f = M(flameGeo(0.34 - Math.abs(a) * 0.12, 0.055, 8, a * 0.1), P.aGold, `AuraFlame${i}`,
      [a * 0.32, 0.12 + (1 - Math.abs(a)) * 0.06, -0.02 - Math.abs(a) * 0.05], [0, 0, -a * 0.35]);
    aura.add(f); flames.push(f);
  }
  n.torso.add(aura);
  const shield = makeShield(P.clothWhite, P.gold, P.gold, P.gBlue);
  n.socketL.add(shield);
  const sw = swordGold().object; sw.name = 'DefaultWeapon'; n.socketR.add(sw);
  const animations = heroClips(n, {
    idle: [
      track.pos(halo, [0, 1, 2], [[0, 0.78, 0], [0, 0.8, 0], [0, 0.78, 0]]),
      track.rot(halo, [0, 1, 2], [[0, 0, 0], [0, Math.PI, 0], [0, Math.PI * 2, 0]]),
      ...flames.map((f, i) => track.scl(f, [0, 0.5 + (i % 3) * 0.2, 2], [[1, 1, 1], [1, 1.2, 1], [1, 1, 1]])),
    ],
  });
  return { object: n.root, animations };
}

// ═══════════════════════════ Маг-рыцарь ═══════════════════════════
export function mageKnight() {
  const s = {
    armor: P.clothPurple, armor2: P.gold, under: P.clothPurpleDark, boot: P.leather,
    belt: P.gold, buckle: P.gPurple, glove: P.goldDark,
  };
  const n = baseBody('Mage_Knight', s);
  // длинная мантия
  n.hips.add(M(lathe([[0.33, -0.385], [0.31, -0.3], [0.26, -0.17], [0.21, -0.05], [0.18, 0.06]], 28), P.clothPurple, 'Robe', [0, 0.01, 0]));
  n.hips.add(M(tor(0.325, 0.016, 6, 32), P.gold, 'RobeHem', [0, -0.375, 0], [Math.PI / 2, 0, 0]));
  // нагрудник с камнем
  n.torso.add(M(rbox(0.3, 0.2, 0.05, 0.03), P.goldDark, 'ChestPlate', [0, 0.23, 0.15]));
  n.torso.add(M(sph(0.045, 12, 10), P.gPurple, 'ChestGem', [0, 0.24, 0.18], [0, 0, 0], [1, 1.1, 0.6]));
  [n.armL, n.armR].forEach((a) => a.add(M(tor(0.085, 0.018, 6, 20), P.gold, 'PauldronTrim', [0, 0.0, 0], [Math.PI / 2, 0, 0])));
  // голова: лицо, шарф, шляпа
  n.head.add(M(sph(0.225, 22, 16), P.skinDark, 'Face', [0, 0.22, 0], [0, 0, 0], [1, 1.02, 0.98]));
  [-1, 1].forEach((sg) => n.head.add(M(sph(0.035, 10, 8), P.gGold, sg < 0 ? 'EyeR' : 'EyeL', [sg * 0.085, 0.265, 0.205], [0, 0, 0], [1, 1.2, 0.5])));
  const scarf = new THREE.SphereGeometry(0.236, 28, 14, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.44);
  n.head.add(M(scarf, P.clothPurple, 'Scarf', [0, 0.22, 0.003]));
  n.head.add(M(tor(0.19, 0.045, 8, 28), P.clothPurple, 'ScarfRoll', [0, 0.17, 0], [Math.PI / 2 + 0.15, 0, 0]));
  const hat = G('Hat', [0, 0.35, 0], [-0.08, 0, 0]);
  hat.add(M(lathe([[0.1, -0.01], [0.28, -0.015], [0.4, 0.0], [0.47, 0.035], [0.45, 0.055], [0.38, 0.03], [0.28, 0.022], [0.1, 0.03]], 32), P.clothPurple, 'HatBrim'));
  hat.add(M(tube([[0, 0.02, 0], [0, 0.22, -0.01], [0, 0.42, -0.07], [0.0, 0.52, -0.22]], [0.205, 0.15, 0.08, 0.0], { radial: 20, segs: 22 }), P.clothPurple, 'HatCone'));
  hat.add(M(tor(0.2, 0.026, 8, 30), P.gold, 'HatBand', [0, 0.065, 0], [Math.PI / 2, 0, 0]));
  hat.add(M(rbox(0.1, 0.09, 0.03, 0.012), P.gold, 'HatBuckle', [0, 0.065, 0.205]));
  hat.add(M(sph(0.026, 10, 8), P.gPurple, 'HatGem', [0, 0.065, 0.222], [0, 0, 0], [1, 1, 0.5]));
  n.head.add(hat);
  // накидка
  const capeG = cloth(0.34, 0.5, 0.6, 8, 8, (u, v) => [0, 0, -0.04 - 0.14 * v * v + 0.02 * Math.sin(u * 8 + v * 3) * v]);
  const capeN = G('Cape', [0, 0.38, -0.17]);
  capeN.add(M(capeG, P.clothPurpleDark, 'CapeCloth'));
  n.torso.add(capeN);
  const st = staffMagic().object; st.name = 'DefaultWeapon'; st.position.y = 0.2; n.socketR.add(st);
  const animations = heroClips(n, { idle: [track.rot(capeN, [0, 1, 2], [[0, 0, 0], [0.06, 0, 0], [0, 0, 0]]), track.rot(hat, [0, 1, 2], [[-0.08, 0, 0], [-0.05, 0.03, 0], [-0.08, 0, 0]])] });
  return { object: n.root, animations };
}

export const characters = [
  ['knight_normal', 'Обычный Рыцарь', knightNormal],
  ['knight_dark', 'Тёмный Рыцарь', knightDark],
  ['paladin', 'Паладин', paladin],
  ['mage_knight', 'Маг-рыцарь', mageKnight],
];
