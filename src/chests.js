// Сундуки: обычный, редкий, эпический, легендарный. Крышка — отдельный узел Lid (шарнир сзади), клип «Open».
import {
  THREE, P, mat, M, G, rbox, cyl, cone, sph, tor, oct, extrudePoly, flameGeo, finalize, clip, track, rod,
} from './lib.js';

const GoldD = mat('GoldDouble', 0xf4b92e, { metal: 1, rough: 0.28, double: true });
const TIERS = {
  common: { wood: mat('ChestWoodCommon', 0x8a5a2e, { rough: 0.85, double: true }), wood2: P.woodDark, metal: mat('ChestIronD', 0x4a5068, { metal: 0.8, rough: 0.45, double: true }), gem: P.gBlue, studs: 0, feet: false },
  rare: { wood: mat('ChestWoodRare', 0x2f58b8, { rough: 0.6, double: true }), wood2: mat('ChestWoodRare2', 0x1f3d86, { rough: 0.6 }), metal: GoldD, gem: P.gBlue, studs: 6, feet: true },
  epic: { wood: mat('ChestWoodEpic', 0x6a2fb0, { rough: 0.55, double: true }), wood2: mat('ChestWoodEpic2', 0x45207c, { rough: 0.55 }), metal: GoldD, gem: P.gPurple, studs: 8, feet: true },
  legendary: { wood: mat('ChestWoodLegend', 0x7a2ea0, { rough: 0.45, metal: 0.1, double: true }), wood2: mat('ChestWoodLegend2', 0x4a1a78, { rough: 0.45 }), metal: GoldD, gem: P.gGold, studs: 10, feet: true },
};

function chest(name, tier) {
  const T = TIERS[tier];
  const W = 0.9, D = 0.58, Hb = 0.36, Hl = 0.26;
  const root = G(name);
  // корпус
  root.add(M(rbox(W, Hb, D, 0.03), T.wood, 'Base', [0, Hb / 2 + 0.04, 0]));
  root.add(M(rbox(W + 0.02, 0.05, D + 0.02, 0.012), T.metal, 'BaseRim', [0, 0.065, 0]));
  root.add(M(rbox(W + 0.02, 0.04, D + 0.02, 0.012), T.metal, 'BaseTopRim', [0, Hb + 0.02, 0]));
  [-1, 1].forEach((sx) => {
    root.add(M(rbox(0.07, Hb + 0.02, D + 0.02, 0.012), T.metal, `Band${sx}`, [sx * (W / 2 - 0.15), Hb / 2 + 0.04, 0]));
  });
  // шарнир крышки: сзади, на верхней кромке
  const hingeY = Hb + 0.04, hingeZ = -D / 2;
  const lid = G('Lid', [0, hingeY, hingeZ]);
  root.add(lid);
  // бочкообразная крышка: полуцилиндр вдоль X
  const cylG = new THREE.CylinderGeometry(D / 2, D / 2, W, 24, 1, true, 0, Math.PI);
  cylG.rotateZ(Math.PI / 2); // ось вдоль X
  cylG.rotateX(0);
  const lidMesh = M(cylG, T.wood, 'LidBarrel', [0, 0, D / 2], [0, 0, 0], [1, Hl / (D / 2), 1]);
  lid.add(lidMesh);
  // торцы крышки (чтобы было закрыто)
  [-1, 1].forEach((sx) => {
    const cap = new THREE.CircleGeometry(D / 2, 24, 0, Math.PI);
    cap.rotateY(sx > 0 ? Math.PI / 2 : -Math.PI / 2);
    lid.add(M(cap, T.wood2, `LidCap${sx}`, [sx * W / 2, 0, D / 2], [0, 0, 0], [1, Hl / (D / 2), 1]));
  });
  [-1, 1].forEach((sx) => {
    const bandG = new THREE.CylinderGeometry(D / 2 + 0.012, D / 2 + 0.012, 0.07, 24, 1, true, 0, Math.PI);
    bandG.rotateZ(Math.PI / 2);
    lid.add(M(bandG, T.metal, `LidBand${sx}`, [sx * (W / 2 - 0.15), 0, D / 2], [0, 0, 0], [1, (Hl + 0.012) / (D / 2 + 0.012), 1]));
  });
  lid.add(M(rbox(W + 0.03, 0.04, 0.05, 0.012), T.metal, 'LidFrontRim', [0, 0.02, D + 0.0 - 0.01]));
  // замок
  const lock = G('Lock', [0, hingeY - 0.07, D / 2 + 0.0]);
  root.add(lock);
  root.children.pop(); lid.add(lock); lock.position.set(0, -0.06, D + 0.01);
  lock.add(M(rbox(0.16, 0.2, 0.05, 0.02), T.metal, 'LockPlate'));
  lock.add(M(sph(0.045, 14, 10), T.gem, 'LockGem', [0, 0.02, 0.03], [0, 0, 0], [1, 1.2, 0.7]));
  lock.add(M(rbox(0.025, 0.06, 0.02, 0.008), P.black2, 'Keyhole', [0, -0.05, 0.028]));
  // шипы/заклёпки
  for (let i = 0; i < T.studs; i++) {
    const side = i % 2 ? 1 : -1;
    const x = (-0.32 + Math.floor(i / 2) * 0.16) * 1;
    root.add(M(sph(0.018, 8, 6), T.metal, `Stud${i}`, [side * (W / 2 + 0.0), 0.14 + (i % 3) * 0.08, (-0.18 + (i % 5) * 0.09)]));
  }
  // ножки
  if (T.feet) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => root.add(M(sph(0.055, 10, 8), T.metal, 'Foot', [sx * (W / 2 - 0.06), 0.04, sz * (D / 2 - 0.06)], [0, 0, 0], [1, 0.8, 1])));
  else [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => root.add(M(rbox(0.1, 0.06, 0.1, 0.02), T.wood2, 'Foot', [sx * (W / 2 - 0.07), 0.03, sz * (D / 2 - 0.07)])));
  // внутренность: золотой свет при открытии
  const inner = M(rbox(W - 0.1, 0.02, D - 0.1, 0.006), P.gGold, 'Treasure', [0, Hb + 0.02, 0]);
  root.add(inner);
  const coins = G('Coins', [0, Hb + 0.03, 0]);
  for (let i = 0; i < 9; i++) coins.add(M(cyl(0.05, 0.05, 0.014, 14), i % 3 ? P.gold : P.goldDark, `Coin${i}`, [-0.28 + (i % 5) * 0.14, 0.01 + (i % 2) * 0.012, -0.1 + Math.floor(i / 5) * 0.17], [0.1 * (i % 3), i, 0.1]));
  root.add(coins);
  // отделка высших уровней
  if (tier === 'rare' || tier === 'epic' || tier === 'legendary') {
    [-1, 1].forEach((sx) => root.add(M(cone(0.05, 0.12, 4), T.metal, `Corner${sx}`, [sx * (W / 2 - 0.02), Hb + 0.12, D / 2 - 0.04], [0, Math.PI / 4, 0])));
  }
  if (tier === 'epic' || tier === 'legendary') {
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => root.add(M(oct(0.045), T.gem, `CornerGem${i}`, [sx * (W / 2 - 0.02), 0.28, sz * (D / 2 - 0.02)], [0, 0, 0], [0.8, 1.3, 0.8])));
  }
  if (tier === 'legendary') {
    // корона-венец на крышке + сияние
    const cr = G('Ornament', [0, Hl + 0.01, D / 2]);
    lid.add(cr);
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.15;
      cr.add(M(cone(0.045, 0.2 - Math.abs(i - 2) * 0.04, 5), P.gold, `Crest${i}`, [x, 0.07, 0]));
      cr.add(M(sph(0.022, 8, 6), P.gGold, `CrestTip${i}`, [x, 0.17 - Math.abs(i - 2) * 0.04, 0]));
    }
    cr.add(M(oct(0.07), P.gPurple, 'CrestGem', [0, 0.03, 0.04], [0, 0, 0], [1, 1.3, 0.7]));
    lid.add(M(tor(0.2, 0.016, 8, 28), P.gold, 'LidRing', [0, Hl * 0.9, D / 2], [Math.PI / 2, 0, 0], [1, 0.7, 1]));
    root.add(M(new THREE.CylinderGeometry(0.58, 0.64, 0.02, 40), mat('LegendGlow', 0xffd25a, { glow: 0x7a5a12, opacity: 0.28, double: true }), 'GroundGlow', [0, 0.012, 0]));
  }
  const openA = -Math.PI * 0.62;
  const open = clip('Open', 1.0, [track.rot(lid, [0, 0.55, 0.8, 1.0], [[0, 0, 0], [openA * 1.05, 0, 0], [openA * 0.97, 0, 0], [openA, 0, 0]])]);
  const close = clip('Close', 0.6, [track.rot(lid, [0, 0.6], [[openA, 0, 0], [0, 0, 0]])]);
  return { object: root, animations: [open, close] };
}

export const chests = [
  ['chest_common', 'Обычный сундук', () => chest('Chest_Common', 'common')],
  ['chest_rare', 'Редкий сундук', () => chest('Chest_Rare', 'rare')],
  ['chest_epic', 'Эпический сундук', () => chest('Chest_Epic', 'epic')],
  ['chest_legendary', 'Легендарный сундук', () => chest('Chest_Legendary', 'legendary')],
];
