// Модели оружия «Копирки». Ствол смотрит в -Z, рукоять — в начале координат, +Y вверх.
import * as THREE from 'three';
import { stdMat, skinColors } from './characters.js';

// Палитры оружейных скинов. Роли деталей: body, metal, wood, accent, dark, glass.
export const WEAPON_PALETTES = {
  regular: {
    body: ['#2e2327', { rough: 0.45, metal: 0.35 }], metal: ['#5f616b', { rough: 0.35, metal: 0.75 }],
    wood: ['#6d3b1e', { rough: 0.7 }], accent: ['#c0282d', { rough: 0.5 }], dark: ['#131316', { rough: 0.5, metal: 0.3 }],
    glass: ['#7fd0ff', { emissive: '#2a7fb0', ei: 0.8, rough: 0.1, metal: 0.3 }],
  },
  neon: {
    body: ['#1a1233', { rough: 0.4, metal: 0.4 }], metal: ['#3b2b6e', { rough: 0.3, metal: 0.7 }],
    wood: ['#2a1a55', { rough: 0.5, metal: 0.3 }], accent: ['#c64dff', { emissive: '#c64dff', ei: 1.8, rough: 0.3 }],
    dark: ['#0d0820', { rough: 0.5 }], glass: ['#37e6ff', { emissive: '#37e6ff', ei: 2.0, rough: 0.1 }],
  },
  gold: {
    body: ['#d9a521', { rough: 0.25, metal: 0.95 }], metal: ['#f6d35a', { rough: 0.2, metal: 1.0 }],
    wood: ['#b3821a', { rough: 0.3, metal: 0.9 }], accent: ['#fff0a8', { rough: 0.2, metal: 0.8, emissive: '#ffd24a', ei: 0.35 }],
    dark: ['#6b4d0b', { rough: 0.35, metal: 0.8 }], glass: ['#ffe9a0', { emissive: '#ffc93c', ei: 1.0, rough: 0.1 }],
  },
  ice: {
    body: ['#64c8fb', { rough: 0.15, metal: 0.4 }], metal: ['#c4ecff', { rough: 0.1, metal: 0.6 }],
    wood: ['#4aa6dc', { rough: 0.2, metal: 0.3 }], accent: ['#ffffff', { emissive: '#8fe3ff', ei: 1.0, rough: 0.1 }],
    dark: ['#2a6e9a', { rough: 0.3, metal: 0.3 }], glass: ['#e8fbff', { emissive: '#9ee8ff', ei: 1.4, rough: 0.05 }],
  },
  demonic: {
    body: ['#170909', { rough: 0.35, metal: 0.5 }], metal: ['#3a1212', { rough: 0.3, metal: 0.8 }],
    wood: ['#240a0a', { rough: 0.5, metal: 0.4 }], accent: ['#ff3b1f', { emissive: '#ff2a00', ei: 2.0, rough: 0.4 }],
    dark: ['#050303', { rough: 0.5 }], glass: ['#ff7a2a', { emissive: '#ff4a00', ei: 2.2, rough: 0.1 }],
  },
};

function mk(skin, role) {
  const pal = WEAPON_PALETTES[skin] || WEAPON_PALETTES.regular;
  const [c, o] = pal[role];
  return stdMat(c, o);
}

function part(g, skin, role, geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mk(skin, role));
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m);
  return m;
}
const B = (g, s, role, w, h, d, x, y, z, rx, ry, rz) => part(g, s, role, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
// цилиндр вдоль оси Z (ствол)
const C = (g, s, role, r, len, x, y, z, seg = 14) => part(g, s, role, new THREE.CylinderGeometry(r, r, len, seg), x, y, z, Math.PI / 2, 0, 0);

function muzzleAnchor(g, x, y, z) {
  const o = new THREE.Object3D(); o.position.set(x, y, z); g.add(o); g.userData.muzzle = o;
}

const BUILDERS = {
  pistol(g, s) {
    B(g, s, 'metal', 0.36, 0.42, 2.1, 0, 0.5, -0.55);          // затвор
    B(g, s, 'accent', 0.38, 0.1, 1.3, 0, 0.66, -0.55);         // полоса
    B(g, s, 'body', 0.32, 0.3, 1.6, 0, 0.16, -0.35);           // рамка
    B(g, s, 'body', 0.34, 1.05, 0.52, 0, -0.5, 0.15, -0.2);    // рукоять
    B(g, s, 'dark', 0.36, 0.2, 0.56, 0, -1.0, 0.25, -0.2);     // основание магазина
    B(g, s, 'dark', 0.08, 0.22, 0.08, 0, -0.1, -0.35);         // спуск
    B(g, s, 'body', 0.1, 0.08, 0.7, 0, -0.2, -0.6);            // скоба
    C(g, s, 'dark', 0.1, 0.4, 0, 0.5, -1.75);                  // дульный срез
    B(g, s, 'accent', 0.1, 0.14, 0.12, 0, 0.78, -1.45);        // мушка
    B(g, s, 'accent', 0.22, 0.12, 0.14, 0, 0.78, 0.45);        // целик
    muzzleAnchor(g, 0, 0.5, -1.95);
    g.userData.hands = { right: [0, -0.4, 0.15], left: null };
  },
  shotgun(g, s) {
    C(g, s, 'metal', 0.17, 4.4, 0, 0.38, -3.3);                // ствол
    C(g, s, 'dark', 0.14, 3.4, 0, 0.0, -3.0);                  // трубчатый магазин
    B(g, s, 'body', 0.52, 0.75, 2.0, 0, 0.2, -0.3);            // ствольная коробка
    B(g, s, 'accent', 0.54, 0.1, 0.9, 0, 0.1, -0.6);
    B(g, s, 'wood', 0.56, 0.42, 1.2, 0, -0.08, -2.7);          // помпа
    B(g, s, 'dark', 0.6, 0.12, 0.12, 0, -0.08, -2.1); B(g, s, 'dark', 0.6, 0.12, 0.12, 0, -0.08, -3.3);
    B(g, s, 'wood', 0.5, 0.95, 2.3, 0, -0.1, 1.8, 0.12);       // приклад
    B(g, s, 'dark', 0.52, 1.0, 0.12, 0, -0.1, 3.0, 0.12);
    B(g, s, 'wood', 0.36, 0.8, 0.44, 0, -0.55, 0.4, -0.25);    // рукоять
    B(g, s, 'accent', 0.1, 0.16, 0.12, 0, 0.62, -5.35);        // мушка
    C(g, s, 'dark', 0.2, 0.3, 0, 0.38, -5.45);
    muzzleAnchor(g, 0, 0.38, -5.7);
    g.userData.hands = { right: [0, -0.5, 0.4], left: [0, -0.1, -2.7] };
  },
  rifle(g, s) {
    B(g, s, 'body', 0.52, 0.78, 2.7, 0, 0.15, -0.7);           // ствольная коробка
    B(g, s, 'accent', 0.54, 0.12, 1.1, 0, 0.12, -0.7);
    B(g, s, 'metal', 0.42, 0.2, 2.5, 0, 0.62, -0.8);           // крышка
    B(g, s, 'wood', 0.52, 0.46, 1.9, 0, 0.02, -3.05);          // нижняя цевьё
    B(g, s, 'wood', 0.44, 0.2, 1.9, 0, 0.4, -3.05);            // верхняя накладка
    C(g, s, 'metal', 0.1, 2.2, 0, 0.3, -5.0);                  // ствол
    C(g, s, 'metal', 0.085, 2.4, 0, 0.62, -3.65);              // газовая трубка
    B(g, s, 'dark', 0.12, 0.45, 0.12, 0, 0.55, -5.6);          // мушка
    C(g, s, 'dark', 0.16, 0.45, 0, 0.3, -6.1);                 // пламегаситель
    B(g, s, 'accent', 0.4, 1.0, 0.72, 0, -0.9, -1.45, 0.1);    // магазин верх
    B(g, s, 'accent', 0.4, 0.9, 0.72, 0, -1.7, -1.15, 0.38);   // магазин низ (изогнут)
    B(g, s, 'dark', 0.38, 1.05, 0.5, 0, -0.85, 0.4, -0.3);     // рукоять
    B(g, s, 'wood', 0.44, 0.95, 2.2, 0, -0.05, 2.0, 0.08);     // приклад
    B(g, s, 'dark', 0.46, 1.0, 0.14, 0, -0.05, 3.15, 0.08);
    B(g, s, 'dark', 0.3, 0.22, 0.34, 0, 0.82, -1.7);           // целик
    muzzleAnchor(g, 0, 0.3, -6.4);
    g.userData.hands = { right: [0, -0.8, 0.4], left: [0, -0.18, -3.0] };
  },
  sniper(g, s) {
    B(g, s, 'body', 0.52, 0.68, 2.6, 0, 0.2, -0.6);            // ствольная коробка
    C(g, s, 'metal', 0.12, 4.6, 0, 0.34, -4.3);                // тяжёлый ствол
    C(g, s, 'dark', 0.19, 0.55, 0, 0.34, -6.7);                // дульный тормоз
    B(g, s, 'body', 0.52, 1.0, 2.5, 0, -0.05, 2.1, 0.06);      // приклад
    B(g, s, 'wood', 0.5, 0.3, 1.5, 0, 0.62, 2.3);              // подщёчник
    B(g, s, 'dark', 0.54, 1.05, 0.14, 0, -0.05, 3.4, 0.06);
    B(g, s, 'dark', 0.34, 0.95, 0.46, 0, -0.75, 0.5, -0.25);   // рукоять
    B(g, s, 'metal', 0.4, 0.8, 0.7, 0, -0.65, -0.8);           // магазин
    // оптика
    C(g, s, 'dark', 0.27, 2.3, 0, 1.05, -0.9, 18);
    C(g, s, 'dark', 0.36, 0.55, 0, 1.05, -2.2, 18);
    C(g, s, 'dark', 0.31, 0.45, 0, 1.05, 0.4, 18);
    C(g, s, 'accent', 0.285, 0.12, 0, 1.05, -0.9, 18);
    part(g, s, 'glass', new THREE.CylinderGeometry(0.32, 0.32, 0.03, 18), 0, 1.05, -2.5, Math.PI / 2);
    B(g, s, 'metal', 0.2, 0.4, 0.3, 0, 0.62, -0.1); B(g, s, 'metal', 0.2, 0.4, 0.3, 0, 0.62, -1.6);
    // затвор
    C(g, s, 'metal', 0.06, 0.55, 0.42, 0.42, 0.02); g.children[g.children.length - 1].rotation.set(0, 0, Math.PI / 2);
    part(g, s, 'metal', new THREE.SphereGeometry(0.11, 10, 8), 0.7, 0.42, 0.02);
    // сошки
    B(g, s, 'dark', 0.07, 1.0, 0.07, -0.22, -0.35, -3.6, 0.2, 0, 0.2); B(g, s, 'dark', 0.07, 1.0, 0.07, 0.22, -0.35, -3.6, 0.2, 0, -0.2);
    muzzleAnchor(g, 0, 0.34, -7.0);
    g.userData.hands = { right: [0, -0.7, 0.5], left: [0, -0.1, -1.6] };
  },
  knife(g, s) {
    const sh = new THREE.Shape();
    [[0, 0.24], [2.1, 0.24], [2.9, -0.04], [2.2, -0.34], [0, -0.34]].forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false });
    geo.translate(0, 0, -0.05);
    const blade = part(g, s, 'metal', geo, 0, 0.1, -0.15, 0, Math.PI / 2, 0);
    blade.material = s === 'regular' ? stdMat('#d6dce6', { rough: 0.18, metal: 0.95 }) : mk(s, 'metal');
    B(g, s, 'accent', 0.04, 0.08, 1.7, 0, 0.18, -1.2);          // кровосток
    B(g, s, 'dark', 0.36, 0.6, 0.14, 0, 0.0, -0.1);             // гарда
    B(g, s, 'wood', 0.26, 0.36, 1.25, 0, 0.0, 0.6);             // рукоять
    B(g, s, 'accent', 0.28, 0.1, 0.18, 0, 0.0, 0.4); B(g, s, 'accent', 0.28, 0.1, 0.18, 0, 0.0, 0.8);
    B(g, s, 'metal', 0.3, 0.42, 0.16, 0, 0.0, 1.3);             // навершие
    g.userData.hands = { right: [0, 0, 0.6], left: null };
  },
};

export function buildWeapon(weaponId, skin = 'regular') {
  const g = new THREE.Group();
  (BUILDERS[weaponId] || BUILDERS.pistol)(g, skin);
  g.userData.weaponId = weaponId;
  return g;
}

// Позы оружия при виде от первого лица (положение, поворот и масштаб относительно камеры).
export const VIEW_POSE = {
  pistol: { pos: [0.8, -0.8, -2.3], rot: [0.04, 0.06, 0], scale: 0.7 },
  shotgun: { pos: [1.0, -0.9, -2.2], rot: [0.0, 0.08, 0], scale: 0.55 },
  rifle: { pos: [1.0, -0.9, -2.2], rot: [0.0, 0.08, 0], scale: 0.55 },
  sniper: { pos: [1.0, -0.95, -2.2], rot: [0.0, 0.08, 0], scale: 0.5 },
  knife: { pos: [1.0, -1.0, -1.9], rot: [0.55, 0.45, -0.2], scale: 1.1 },
};

// Оружие + руки (от первого лица)
export function buildViewmodel(weaponId, weaponSkin, skinId) {
  const root = new THREE.Group();
  const w = buildWeapon(weaponId, weaponSkin);
  root.add(w);
  const { sleeve, hand } = skinColors(skinId);
  const arm = (pos, dirX) => {
    const g = new THREE.Group();
    const dir = new THREE.Vector3(dirX, -0.55, 1).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.9), stdMat(hand));
    const slv = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 3.6), stdMat(sleeve));
    fist.position.copy(dir).multiplyScalar(0.0); slv.position.copy(dir).multiplyScalar(2.3);
    fist.quaternion.copy(q); slv.quaternion.copy(q);
    g.add(fist, slv); g.position.set(...pos);
    return g;
  };
  const hands = w.userData.hands || {};
  if (hands.right) root.add(arm(hands.right, 0.35));
  if (hands.left) root.add(arm(hands.left, -0.55));
  root.userData.muzzle = w.userData.muzzle;
  root.userData.weapon = w;
  return root;
}
