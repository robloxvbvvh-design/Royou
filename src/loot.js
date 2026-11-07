// Добыча: золото, кристаллы, зелье, свиток. У каждого клип Idle (вращение/парение).
import {
  THREE, P, mat, M, G, rbox, cyl, cone, sph, tor, oct, lathe, tube, flat, finalize, clip, track, rod,
} from './lib.js';

const spin = (node, y0 = 0, bob = 0.04, dur = 3) => clip('Idle', dur, [
  track.rot(node, [0, dur / 2, dur], [[0, 0, 0], [0, Math.PI, 0], [0, Math.PI * 2, 0]]),
  track.pos(node, [0, dur / 4, dur / 2, dur * 0.75, dur], [[0, y0, 0], [0, y0 + bob, 0], [0, y0, 0], [0, y0 + bob, 0], [0, y0, 0]]),
]);

export function lootGold() {
  const root = G('Loot_Gold');
  const pile = G('Pile', [0, 0, 0]); root.add(pile);
  const coin = (r = 0.1) => lathe([[0.001, -0.014], [r * 0.88, -0.014], [r, -0.008], [r, 0.008], [r * 0.88, 0.014], [r * 0.7, 0.01], [r * 0.7, 0.004], [0.001, 0.004]], 22);
  const stacks = [[0, 0, 7, 0.1], [0.19, 0.07, 5, 0.1], [-0.16, 0.12, 4, 0.1], [0.07, -0.19, 3, 0.1]];
  stacks.forEach(([x, z, n, r], si) => {
    for (let i = 0; i < n; i++) {
      pile.add(M(coin(r), i % 2 ? P.gold : P.goldDark, `Coin${si}_${i}`, [x + (i % 2) * 0.006, 0.016 + i * 0.03, z], [0, i * 0.7, 0]));
    }
  });
  // стоящая монета
  pile.add(M(coin(0.11), P.gold, 'CoinStanding', [-0.2, 0.13, -0.12], [Math.PI / 2 - 0.2, 0.5, 0.3]));
  pile.add(M(coin(0.1), P.gold, 'CoinLying', [0.22, 0.016, -0.1], [0, 0.4, 0]));
  pile.add(M(coin(0.1), P.goldDark, 'CoinLying2', [-0.05, 0.016, 0.24], [0, 0.9, 0]));
  return { object: root, animations: [spin(pile)] };
}

export function lootCrystal() {
  const root = G('Loot_Crystal');
  const grp = G('Cluster'); root.add(grp);
  const crystalMat = mat('Crystal', 0xa13cff, { rough: 0.08, metal: 0.1, glow: 0x4a1490 });
  const crystalLight = mat('CrystalLight', 0xd69bff, { rough: 0.08, metal: 0.1, glow: 0x7a3aa8 });
  const shard = (h, r, tipH) => {
    const g = new THREE.CylinderGeometry(r * 0.78, r, h, 6, 1);
    g.translate(0, h / 2, 0);
    const tip = new THREE.ConeGeometry(r * 0.78, tipH, 6); tip.translate(0, h + tipH / 2, 0);
    return flat(THREE.BufferGeometryUtils ? g : mergeSafe(g, tip));
  };
  function mergeSafe(a, b) { return a; }
  const build = (h, r, tipH, mt, name, pos, rot) => {
    const sh = G(name, pos, rot);
    sh.add(M(flat(new THREE.CylinderGeometry(r * 0.8, r, h, 6, 1)), mt, 'Body', [0, h / 2, 0]));
    sh.add(M(flat(new THREE.ConeGeometry(r * 0.8, tipH, 6)), mt, 'Tip', [0, h + tipH / 2, 0]));
    return sh;
  };
  grp.add(build(0.32, 0.075, 0.14, crystalMat, 'Main', [0, 0, 0], [0, 0.3, 0]));
  grp.add(build(0.22, 0.055, 0.1, crystalLight, 'Side1', [0.1, 0, 0.04], [0.0, 0.5, -0.5]));
  grp.add(build(0.2, 0.05, 0.09, crystalMat, 'Side2', [-0.09, 0, 0.03], [0.1, 0.0, 0.55]));
  grp.add(build(0.15, 0.045, 0.08, crystalLight, 'Side3', [0.02, 0, -0.1], [-0.6, 0, 0.1]));
  grp.add(build(0.13, 0.04, 0.07, crystalMat, 'Side4', [0.0, 0, 0.11], [0.7, 0.3, 0.0]));
  grp.add(M(flat(new THREE.IcosahedronGeometry(0.11, 0)), P.stoneDark, 'Base', [0, 0.0, 0], [0, 0.3, 0], [1.3, 0.5, 1.2]));
  return { object: root, animations: [spin(grp, 0, 0.03, 3.5)] };
}

export function lootPotion() {
  const root = G('Loot_Potion');
  const grp = G('Bottle', [0, 0, 0]); root.add(grp);
  const glassPts = [[0.001, 0.0], [0.07, 0.005], [0.12, 0.04], [0.14, 0.1], [0.13, 0.17], [0.09, 0.22], [0.05, 0.27], [0.045, 0.34], [0.05, 0.36], [0.05, 0.37]];
  const liquidPts = [[0.001, 0.012], [0.065, 0.017], [0.11, 0.05], [0.13, 0.1], [0.12, 0.16], [0.095, 0.185], [0.001, 0.185]];
  const liquid = mat('PotionLiquid', 0x3fe85a, { rough: 0.15, glow: 0x147a2a });
  grp.add(M(lathe(liquidPts, 28), liquid, 'Liquid'));
  grp.add(M(lathe(glassPts, 28), P.glass, 'Glass'));
  grp.add(M(tor(0.055, 0.012, 8, 20), P.gold, 'NeckRing', [0, 0.355, 0], [Math.PI / 2, 0, 0]));
  grp.add(M(lathe([[0.001, 0.36], [0.04, 0.36], [0.05, 0.4], [0.045, 0.43], [0.001, 0.43]], 16), P.woodLight, 'Cork'));
  [[0.04, 0.1, 0.1], [-0.05, 0.14, 0.09], [0.02, 0.07, 0.12]].forEach(([x, y, z], i) => grp.add(M(sph(0.014 + i * 0.004, 8, 6), P.gGreen, `Bubble${i}`, [x, y, z])));
  return { object: root, animations: [spin(grp, 0, 0.03, 3)] };
}

export function lootScroll() {
  const root = G('Loot_Scroll');
  const grp = G('Scroll', [0, 0.17, 0], [0, 0, Math.PI / 2]); root.add(grp);
  // развёрнутый лист (по длине вдоль Y внутри группы)
  grp.add(M(rbox(0.3, 0.4, 0.008, 0.003, 1), P.parchment, 'Sheet', [0, 0, 0], [0, 0, 0]));
  [-1, 1].forEach((s) => {
    const y = s * 0.205;
    grp.add(M(cyl(0.035, 0.035, 0.3, 14), P.parchment, 'Roll', [0, y, 0], [0, 0, Math.PI / 2]));
    grp.add(M(cyl(0.03, 0.03, 0.34, 10), P.woodDark, 'Rod', [0, y, 0], [0, 0, Math.PI / 2]));
    [-1, 1].forEach((e) => grp.add(M(sph(0.032, 10, 8), P.gold, 'RodCap', [e * 0.175, y, 0])));
  });
  // строки текста
  for (let i = 0; i < 5; i++) grp.add(M(rbox(0.2 - (i % 2) * 0.05, 0.012, 0.004, 0.002, 1), P.leather, `Line${i}`, [(i % 2) * -0.025, 0.12 - i * 0.05, 0.006]));
  // лента и печать
  grp.add(M(rbox(0.3, 0.035, 0.014, 0.004, 1), P.clothRed, 'Ribbon', [0, -0.02, 0.012]));
  grp.add(M(cyl(0.05, 0.05, 0.016, 16), P.clothRed, 'Seal', [0, -0.02, 0.022], [Math.PI / 2, 0, 0]));
  grp.add(M(sph(0.022, 8, 6), P.gold, 'SealStar', [0, -0.02, 0.034], [0, 0, 0], [1, 1, 0.5]));
  const wrap = G('Wrap'); wrap.add(grp); root.add(wrap);
  return { object: root, animations: [spin(wrap, 0, 0.03, 3)] };
}

export const loot = [
  ['loot_gold', 'Золото', lootGold],
  ['loot_crystal', 'Кристаллы', lootCrystal],
  ['loot_potion', 'Зелье', lootPotion],
  ['loot_scroll', 'Свитки', lootScroll],
];
