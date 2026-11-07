// Игровые объекты: костёр, портал, магазин, кузница, ловушки, ключ, наковальня (крафт), кубок (достижения).
import {
  THREE, P, mat, M, G, rod, rbox, cyl, cone, sph, tor, oct, lathe, tube, flat, flameGeo, finalize, clip, track, rng,
} from './lib.js';

const sq = (x, y, z = x) => [x, y, z];

// ═══════════════════════════ Костёр ═══════════════════════════
export function campfire() {
  const root = G('Campfire');
  const rnd = rng(4);
  // камни по кругу
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const m = M(flat(new THREE.DodecahedronGeometry(0.1 + rnd() * 0.04, 0)), i % 3 ? P.stone : P.stoneDark, `Stone${i}`,
      [Math.sin(a) * 0.48, 0.06, Math.cos(a) * 0.48], [rnd() * 3, rnd() * 3, rnd() * 3], [1.2, 0.7, 1]);
    root.add(m);
  }
  root.add(M(cyl(0.44, 0.46, 0.04, 20), mat('Ash', 0x2a2623, { rough: 1 }), 'Ash', [0, 0.02, 0]));
  // поленья
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const log = G(`Log${i}`, [Math.sin(a) * 0.17, 0.2, Math.cos(a) * 0.17], [0, a, 0]);
    log.add(M(cyl(0.055, 0.055, 0.7, 10), P.woodDark, 'Wood', [0, 0, 0.0], [Math.PI / 2 - 0.55, 0, 0]));
    log.add(M(cyl(0.048, 0.048, 0.01, 10), P.woodLight, 'EndCut', [0, 0, 0], [Math.PI / 2 - 0.55, 0, 0]));
    root.add(log);
  }
  const fire = G('Fire', [0, 0.14, 0]); root.add(fire);
  const fireOuter = mat('FireOuter', 0xd85000, { rough: 1, glow: 0x9a3a00 });
  const fireMid = mat('FireMid', 0xe08000, { rough: 1, glow: 0xa05a00 });
  const outer = M(flameGeo(0.75, 0.3, 12, 0.03), fireOuter, 'FlameOuter');
  const mid = M(flameGeo(0.55, 0.2, 12, -0.03), fireMid, 'FlameMid', [0.02, 0, 0.02]);
  const inner = M(flameGeo(0.34, 0.11, 10, 0.02), P.gYellow, 'FlameInner', [0, 0, 0.03]);
  const tongues = [[0.17, 0.4, 0.2, 0.3], [-0.18, 0.1, 0.45, -0.3], [0.05, -0.18, 0.4, 0.1]].map(([x, z, h, l], i) => M(flameGeo(h, 0.09, 8, l * 0.3), fireOuter, `Tongue${i}`, [x, 0, z]));
  fire.add(outer, mid, inner, ...tongues);
  const embers = [];
  for (let i = 0; i < 6; i++) {
    const e = M(oct(0.015), P.gOrange, `Ember${i}`, [(rnd() - 0.5) * 0.4, 0.8 + rnd() * 0.5, (rnd() - 0.5) * 0.4]);
    root.add(e); embers.push(e);
  }
  const idle = clip('Idle', 1.2, [
    track.scl(outer, [0, 0.3, 0.6, 0.9, 1.2], [sq(1, 1), sq(1.1, 1.15), sq(0.92, 0.9), sq(1.06, 1.1), sq(1, 1)]),
    track.scl(mid, [0, 0.25, 0.55, 0.85, 1.2], [sq(1, 1), sq(0.9, 1.12), sq(1.08, 0.94), sq(0.95, 1.1), sq(1, 1)]),
    track.scl(inner, [0, 0.2, 0.5, 0.8, 1.2], [sq(1, 1), sq(1.15, 1.2), sq(0.9, 0.92), sq(1.1, 1.15), sq(1, 1)]),
    ...embers.map((e, i) => track.pos(e, [0, 1.2], [e.position.toArray(), [e.position.x + 0.05, e.position.y + 0.35, e.position.z]])),
  ]);
  return { object: root, animations: [idle] };
}

// ═══════════════════════════ Портал ═══════════════════════════
export function portal() {
  const root = G('Portal');
  root.add(M(cyl(1.1, 1.22, 0.14, 8), P.stoneDark, 'PlatformLow', [0, 0.07, 0]));
  root.add(M(cyl(0.95, 1.05, 0.12, 8), P.stone, 'PlatformTop', [0, 0.2, 0]));
  const stoneRune = mat('RuneStone', 0x6c7390, { rough: 0.85 });
  // колонны
  [-1, 1].forEach((s) => {
    root.add(M(rbox(0.3, 0.9, 0.3, 0.04), P.stone, `Pillar${s}`, [s * 0.86, 0.72, 0]));
    root.add(M(rbox(0.38, 0.12, 0.38, 0.03), P.stoneDark, `PillarCap${s}`, [s * 0.86, 1.2, 0]));
    root.add(M(rbox(0.36, 0.12, 0.36, 0.03), P.stoneDark, `PillarBase${s}`, [s * 0.86, 0.32, 0]));
    root.add(M(oct(0.06), P.gBlue, `PillarGem${s}`, [s * 0.86, 1.34, 0], [0, 0, 0], [1, 1.5, 1]));
  });
  // кольцо
  const ringN = G('Ring', [0, 1.2, 0]); root.add(ringN);
  ringN.add(M(tor(0.82, 0.12, 10, 36), stoneRune, 'RingStone'));
  ringN.add(M(tor(0.7, 0.04, 8, 36), P.gBlue, 'RingGlowInner'));
  const runes = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = M(rbox(0.05, 0.1, 0.03, 0.01), P.gCyan, `Rune${i}`, [Math.sin(a) * 0.82, Math.cos(a) * 0.82, 0.115], [0, 0, -a]);
    ringN.add(r); runes.push(r);
  }
  // вихрь
  const swirl = G('Swirl', [0, 1.2, 0]); root.add(swirl);
  swirl.add(M(new THREE.CircleGeometry(0.69, 40), mat('PortalDisc', 0x2a7bff, { glow: 0x1646a0, opacity: 0.8, double: true }), 'Disc'));
  [0.52, 0.36, 0.2].forEach((r, i) => swirl.add(M(tor(r, 0.018, 6, 40, Math.PI * (1.5 - i * 0.2)), P.gCyan, `SwirlArc${i}`, [0, 0, 0.01 * (i + 1)], [0, 0, i * 1.7])));
  swirl.add(M(sph(0.08, 12, 10), P.gWhite, 'Core', [0, 0, 0.02], [0, 0, 0], [1, 1, 0.3]));
  root.add(M(tor(1.0, 0.025, 6, 40), P.gBlue, 'GroundRing', [0, 0.27, 0], [Math.PI / 2, 0, 0]));
  const idle = clip('Idle', 6, [
    track.rot(swirl, [0, 3, 6], [[0, 0, 0], [0, 0, -Math.PI], [0, 0, -Math.PI * 2]]),
    ...runes.map((r, i) => track.scl(r, [0, 1 + (i % 4) * 0.3, 3], [sq(1, 1), sq(1.2, 1.5), sq(1, 1)])),
  ]);
  return { object: root, animations: [idle] };
}

// ═══════════════════════════ Магазин ═══════════════════════════
export function shop() {
  const root = G('Shop');
  const W = 2.2, D = 1.5, H = 1.9;
  // основание-прилавок
  root.add(M(rbox(W, 0.12, D + 0.2, 0.03), P.woodDark, 'Floor', [0, 0.06, 0]));
  root.add(M(rbox(W - 0.1, 0.62, 0.55, 0.03), P.wood, 'Counter', [0, 0.43, D / 2 - 0.1]));
  root.add(M(rbox(W, 0.07, 0.68, 0.02), P.woodLight, 'CounterTop', [0, 0.78, D / 2 - 0.1]));
  for (let i = 0; i < 4; i++) root.add(M(rbox(0.5, 0.45, 0.02, 0.01), P.woodDark, `CounterPanel${i}`, [-0.8 + i * 0.53, 0.43, D / 2 + 0.19]));
  // столбы
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z], i) => {
    const ph = z < 0 ? 2.2 : 1.7;
    root.add(M(cyl(0.05, 0.06, ph, 8), P.woodDark, `Post${i}`, [x * (W / 2 - 0.08), ph / 2 + 0.1, z * (D / 2 - 0.05)]));
  });
  // задняя стенка и полки
  root.add(M(rbox(W - 0.1, 1.6, 0.06, 0.02), P.woodDark, 'BackWall', [0, 0.9, -D / 2 + 0.05]));
  [0.7, 1.2].forEach((y, i) => root.add(M(rbox(W - 0.2, 0.05, 0.3, 0.01), P.woodLight, `Shelf${i}`, [0, y, -D / 2 + 0.22])));
  // товары: зелья, свитки, мешки
  const potCols = [P.gGreen, P.gRed, P.gBlue, P.gPurple, P.gGold];
  for (let i = 0; i < 6; i++) {
    const c = potCols[i % potCols.length];
    const x = -0.85 + i * 0.34;
    root.add(M(lathe([[0.001, 0], [0.06, 0.01], [0.08, 0.06], [0.06, 0.12], [0.03, 0.16], [0.03, 0.2]], 12), c, `Potion${i}`, [x, 0.725, -D / 2 + 0.22]));
    root.add(M(cyl(0.028, 0.03, 0.04, 8), P.woodLight, `Cork${i}`, [x, 0.945, -D / 2 + 0.22]));
  }
  for (let i = 0; i < 5; i++) root.add(M(rbox(0.22, 0.1, 0.18, 0.04), [P.steel, P.gold, P.clothRed, P.leatherLight, P.stoneLight][i], `Goods${i}`, [-0.8 + i * 0.4, 1.28, -D / 2 + 0.22]));
  // мешки и бочка спереди-сбоку
  root.add(M(sph(0.2, 12, 10), mat('Sack', 0xc9a56a, { rough: 0.95 }), 'Sack', [-0.88, 0.32, D / 2 + 0.3], [0, 0, 0], [1, 1.1, 1]));
  root.add(M(sph(0.06, 8, 6), mat('Sack'), 'SackKnot', [-0.88, 0.58, D / 2 + 0.3]));
  root.add(M(cyl(0.2, 0.17, 0.5, 14), P.wood, 'Barrel', [0.9, 0.35, D / 2 + 0.28]));
  [0.2, 0.5].forEach((y, i) => root.add(M(tor(0.185 - i * 0.0, 0.015, 6, 20), P.steelDark, `BarrelHoop${i}`, [0.9, y + 0.12, D / 2 + 0.28], [Math.PI / 2, 0, 0])));
  root.add(M(rbox(0.3, 0.25, 0.25, 0.03), P.woodLight, 'Crate', [0.55, 0.22, D / 2 + 0.42], [0, 0.3, 0]));
  // тент: полосатый, красно-белый
  const roofY = 2.02, tilt = 0.19, awL = D + 0.5;
  const frontZ = 0.1 + (awL / 2) * Math.cos(tilt), frontY = roofY - (awL / 2) * Math.sin(tilt);
  const nStr = 10, sw = (W + 0.4) / nStr;
  for (let i = 0; i < nStr; i++) {
    const x = -W / 2 - 0.2 + sw * (i + 0.5);
    const c = i % 2 ? P.clothWhite : P.clothRed;
    root.add(M(box(sw, 0.06, awL), c, `Awning${i}`, [x, roofY, 0.1], [tilt, 0, 0]));
    root.add(M(cone(sw * 0.62, 0.18, 4), c, `Pennant${i}`, [x, frontY - 0.1, frontZ + 0.02], [Math.PI, Math.PI / 4, 0], [1, 1, 0.25]));
  }
  // вывеска с монетой
  root.add(M(rbox(0.6, 0.3, 0.05, 0.02), P.woodDark, 'Sign', [0, frontY - 0.5, frontZ + 0.05]));
  root.add(M(cyl(0.09, 0.09, 0.02, 16), P.gold, 'SignCoin', [0, frontY - 0.5, frontZ + 0.09], [Math.PI / 2, 0, 0]));
  [-1, 1].forEach((s) => root.add(rod([s * 0.2, frontY - 0.35, frontZ + 0.05], [s * 0.2, frontY - 0.08, frontZ + 0.05], 0.008, P.steelDark, `SignChain${s}`, 4)));
  return { object: root };
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ═══════════════════════════ Кузница ═══════════════════════════
export function forge() {
  const root = G('Forge');
  const W = 2.3, D = 1.8, WH = 1.2;
  root.add(M(rbox(W + 0.2, 0.12, D + 0.2, 0.02), P.stoneDark, 'Foundation', [0, 0.06, 0]));
  root.add(M(rbox(W, WH, D, 0.05), P.stone, 'Walls', [0, WH / 2 + 0.12, 0]));
  // каменная кладка: полосы
  for (let i = 1; i < 4; i++) root.add(M(rbox(W + 0.02, 0.025, D + 0.02, 0.005), P.stoneDark, `Course${i}`, [0, 0.12 + i * 0.28, 0]));
  // балки
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z], i) => root.add(M(rbox(0.12, WH + 0.08, 0.12, 0.02), P.woodDark, `Beam${i}`, [x * (W / 2), WH / 2 + 0.12, z * (D / 2)])));
  // крыша (четырёхскатная) + свесы
  const roofMat = mat('RoofRed', 0xa6332a, { rough: 0.8 });
  root.add(M(cone(W * 0.72, 0.95, 4), roofMat, 'Roof', [0, WH + 0.12 + 0.47, 0], [0, Math.PI / 4, 0], [1, 1, D / W * 1.05]));
  root.add(M(rbox(W + 0.4, 0.07, D + 0.35, 0.02), P.woodDark, 'Eaves', [0, WH + 0.14, 0]));
  // дымоход
  root.add(M(rbox(0.42, 1.0, 0.42, 0.03), P.stoneDark, 'Chimney', [-0.65, WH + 0.75, -0.3]));
  root.add(M(rbox(0.52, 0.1, 0.52, 0.02), P.stone, 'ChimneyCap', [-0.65, WH + 1.3, -0.3]));
  root.add(M(sph(0.1, 10, 8), P.gOrange, 'ChimneyGlow', [-0.65, WH + 1.3, -0.3], [0, 0, 0], [1, 0.4, 1]));
  // проём-горн спереди
  root.add(M(rbox(1.0, 0.7, 0.2, 0.03), P.black2, 'HearthOpening', [0.45, 0.62, D / 2 + 0.0]));
  root.add(M(rbox(0.8, 0.12, 0.1, 0.02), P.gOrange, 'HearthEmbers', [0.45, 0.4, D / 2 + 0.06]));
  root.add(M(flameGeo(0.32, 0.12, 8), P.aOrange, 'HearthFlame', [0.45, 0.42, D / 2 + 0.0]));
  root.add(M(rbox(1.15, 0.1, 0.14, 0.02), P.stoneDark, 'HearthLintel', [0.45, 1.0, D / 2 + 0.05]));
  // дверь
  root.add(M(rbox(0.5, 0.85, 0.06, 0.02), P.wood, 'Door', [-0.75, 0.55, D / 2 + 0.01]));
  root.add(M(sph(0.03, 8, 6), P.gold, 'Knob', [-0.6, 0.55, D / 2 + 0.06]));
  // окно с огнём
  root.add(M(rbox(0.4, 0.3, 0.05, 0.02), P.woodDark, 'WindowFrame', [W / 2, 0.8, 0.1], [0, Math.PI / 2, 0]));
  root.add(M(rbox(0.3, 0.2, 0.05, 0.01), P.gOrange, 'WindowGlow', [W / 2 + 0.01, 0.8, 0.1], [0, Math.PI / 2, 0]));
  // наковальня и бочка перед входом
  const an = anvil().object; an.name = 'AnvilProp'; an.position.set(-0.4, 0.0, D / 2 + 0.6); an.scale.setScalar(0.85); root.add(an);
  root.add(M(cyl(0.16, 0.14, 0.4, 12), P.woodDark, 'WaterBarrel', [1.0, 0.2, D / 2 + 0.5]));
  root.add(M(cyl(0.14, 0.14, 0.02, 12), mat('Water', 0x3a7ad0, { rough: 0.1, glow: 0x0a2050 }), 'Water', [1.0, 0.39, D / 2 + 0.5]));
  // подвешенный молот-вывеска
  root.add(M(rbox(0.06, 0.4, 0.04, 0.01), P.woodDark, 'SignArm', [W / 2 - 0.2, 0.9, D / 2 + 0.3]));
  return { object: root };
}

// ═══════════════════════════ Ловушка с шипами ═══════════════════════════
export function trapSpikes() {
  const root = G('Trap_Spikes');
  root.add(M(rbox(1.2, 0.1, 1.2, 0.03), P.stoneDark, 'Plate', [0, 0.05, 0]));
  root.add(M(rbox(1.3, 0.06, 1.3, 0.02), P.stone, 'Frame', [0, 0.03, 0]));
  const spikes = G('Spikes', [0, 0.1, 0]); root.add(spikes);
  const holeM = P.black2;
  for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 4; iz++) {
    const x = -0.45 + ix * 0.3, z = -0.45 + iz * 0.3;
    spikes.add(M(cyl(0.07, 0.07, 0.01, 10), holeM, `Hole${ix}${iz}`, [x, 0.001, z]));
    spikes.add(M(cone(0.048, 0.42, 6), P.steelLight, `Spike${ix}${iz}`, [x, 0.21, z]));
    spikes.add(M(cyl(0.05, 0.055, 0.05, 6), P.steelDark, `SpikeBase${ix}${iz}`, [x, 0.025, z]));
  }
  // кровавые пятна для зловещего вида — тусклые
  root.add(M(cyl(0.12, 0.12, 0.004, 12), mat('Rust', 0x6b2a1c, { rough: 1 }), 'Stain', [0.2, 0.101, 0.38]));
  const out = clip('Activate', 0.4, [track.scl(spikes, [0, 0.12, 0.4], [[1, 0.05, 1], [1, 1.15, 1], [1, 1, 1]])]);
  const back = clip('Retract', 0.6, [track.scl(spikes, [0, 0.6], [[1, 1, 1], [1, 0.05, 1]])]);
  // стартовое состояние (без анимации) — шипы выдвинуты
  return { object: root, animations: [out, back] };
}

// ═══════════════════════════ Ключ ═══════════════════════════
export function key() {
  const root = G('Key');
  const k = G('KeyBody', [0, 0, 0]); root.add(k);
  k.add(M(tor(0.1, 0.03, 10, 28), P.gold, 'Bow', [0, 0.38, 0]));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    k.add(M(sph(0.035, 10, 8), P.gold, `BowLobe${i}`, [Math.cos(a) * 0.135, 0.38 + Math.sin(a) * 0.135, 0], [0, 0, 0], [1, 1, 0.8]));
  }
  k.add(M(sph(0.045, 12, 10), P.gBlue, 'Gem', [0, 0.38, 0], [0, 0, 0], [1, 1, 0.8]));
  k.add(M(cyl(0.04, 0.04, 0.56, 12), P.gold, 'Shaft', [0, 0.02, 0]));
  [0.22, 0.12, 0.3].forEach((y, i) => k.add(M(tor(0.05, 0.016, 6, 16), P.goldDark, `Collar${i}`, [y * 0 + 0, y, 0], [Math.PI / 2, 0, 0])));
  [[-0.24, 0.12], [-0.34, 0.08], [-0.14, 0.1]].forEach(([y, w], i) => k.add(M(rbox(w, 0.06, 0.06, 0.015), P.gold, `Tooth${i}`, [w / 2 + 0.02, y, 0])));
  const idle = clip('Idle', 3.2, [
    track.rot(k, [0, 1.6, 3.2], [[0, 0, 0.2], [0, Math.PI, 0.2], [0, Math.PI * 2, 0.2]]),
    track.pos(k, [0, 0.8, 1.6, 2.4, 3.2], [[0, 0, 0], [0, 0.04, 0], [0, 0, 0], [0, 0.04, 0], [0, 0, 0]]),
  ]);
  k.rotation.z = 0.2;
  return { object: root, animations: [idle] };
}

// ═══════════════════════════ Наковальня (крафт) ═══════════════════════════
export function anvil() {
  const root = G('Anvil');
  root.add(M(cyl(0.26, 0.3, 0.4, 10), P.woodDark, 'Stump', [0, 0.2, 0]));
  root.add(M(rbox(0.42, 0.08, 0.24, 0.02), P.iron, 'Foot', [0, 0.44, 0]));
  root.add(M(rbox(0.24, 0.16, 0.2, 0.04), P.iron, 'Waist', [0, 0.56, 0]));
  root.add(M(rbox(0.6, 0.12, 0.26, 0.03), mat('AnvilTop', 0x4a5064, { metal: 0.85, rough: 0.3 }), 'Face', [0, 0.7, 0]));
  root.add(M(cone(0.13, 0.28, 4), P.iron, 'Horn', [0.42, 0.7, 0], [0, Math.PI / 4, -Math.PI / 2], [1, 1, 0.9]));
  root.add(M(rbox(0.08, 0.02, 0.2, 0.005), P.steelLight, 'Highlight', [-0.12, 0.765, 0]));
  return { object: root };
}

// ═══════════════════════════ Кубок (достижения) ═══════════════════════════
export function trophy() {
  const root = G('Trophy');
  const t = G('Cup'); root.add(t);
  t.add(M(rbox(0.36, 0.06, 0.36, 0.02), P.woodDark, 'Plinth', [0, 0.03, 0]));
  t.add(M(rbox(0.3, 0.05, 0.3, 0.015), P.goldDark, 'BaseGold', [0, 0.085, 0]));
  t.add(M(cyl(0.05, 0.09, 0.14, 14), P.gold, 'Stem', [0, 0.18, 0]));
  t.add(M(sph(0.065, 12, 10), P.gold, 'Knob', [0, 0.26, 0]));
  t.add(M(lathe([[0.001, 0.0], [0.07, 0.02], [0.14, 0.1], [0.19, 0.24], [0.2, 0.34], [0.19, 0.36], [0.17, 0.35], [0.16, 0.24], [0.12, 0.1], [0.001, 0.05]], 28), P.gold, 'Bowl', [0, 0.28, 0]));
  [-1, 1].forEach((s) => t.add(M(tor(0.11, 0.025, 8, 20, Math.PI * 1.25), P.gold, `Handle${s}`, [s * 0.215, 0.5, 0], [0, 0, s < 0 ? Math.PI * 0.6 - 0.2 : -Math.PI * 0.25 - 0.0], [0.9, 1.0, 1])));
  t.add(M(oct(0.07), P.gBlue, 'Star', [0, 0.48, 0.19], [0, 0, 0], [1, 1, 0.4]));
  const idle = clip('Idle', 4, [track.rot(t, [0, 2, 4], [[0, 0, 0], [0, Math.PI, 0], [0, Math.PI * 2, 0]])]);
  return { object: root, animations: [idle] };
}

export const props = [
  ['prop_campfire', 'Костёр', campfire],
  ['prop_portal', 'Портал', portal],
  ['prop_shop', 'Магазин', shop],
  ['prop_forge', 'Кузница', forge],
  ['prop_trap_spikes', 'Ловушки', trapSpikes],
  ['prop_key', 'Ключ', key],
  ['prop_anvil', 'Наковальня (крафт)', anvil],
  ['prop_trophy', 'Кубок (достижения)', trophy],
];
