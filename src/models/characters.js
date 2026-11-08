// Модели персонажей «Копирки»: всё собрано из блоков в пропорциях Roblox.
// Персонаж смотрит в -Z, стоит ногами на y = 0, высота ≈ 5.2 стада.
import * as THREE from 'three';

// ───────────────────────── вспомогательные функции ─────────────────────────
const matCache = new Map();
export function stdMat(color, o = {}) {
  const key = color + '|' + (o.emissive || '') + '|' + (o.ei || 0) + '|' + (o.rough ?? '') + '|' + (o.metal ?? '') + '|' + (o.side || 0);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.62, metalness: o.metal ?? 0.0,
      emissive: o.emissive || '#000000', emissiveIntensity: o.ei ?? 1,
      side: o.side || THREE.FrontSide,
    });
    matCache.set(key, m);
  }
  return m;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function add(parent, mesh, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
const box = (p, w, h, d, color, x, y, z, o) => add(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stdMat(color, o)), x, y, z);
const cyl = (p, rt, rb, h, color, x, y, z, o, seg = 18) => add(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), stdMat(color, o)), x, y, z);
const cone = (p, r, h, color, x, y, z, o, seg = 4) => add(p, new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), stdMat(color, o)), x, y, z);

function shapeMesh(points, depth, color, o) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(g, stdMat(color, o));
  m.castShadow = true;
  return m;
}

// ───────────────────────── описания скинов ─────────────────────────
// arms / legs — список [высота, цвет] сверху вниз (в сумме 2).
export const SKIN_DEFS = {
  standard: {
    head: '#f2c92e', torso: '#1f78d1', arms: [[2, '#f2c92e']], legs: [[2, '#3fae49']],
    face: 'standard', front: null, hand: '#f2c92e', sleeve: '#f2c92e',
  },
  anime: {
    head: '#f3d3b5', torso: '#16171b', arms: [[1.6, '#16171b'], [0.4, '#f3d3b5']],
    legs: [[1.55, '#1d1e24'], [0.45, '#f2f2f2']], face: 'anime', front: 'hoodie', hand: '#f3d3b5', sleeve: '#16171b',
  },
  cool: {
    head: '#e8bf9a', torso: '#121216', arms: [[1.6, '#121216'], [0.4, '#e8bf9a']],
    legs: [[1.6, '#121216'], [0.4, '#050507']], face: 'cool', front: 'suit', hand: '#e8bf9a', sleeve: '#121216',
  },
  demon: {
    head: '#d6342c', torso: '#1a0d10', arms: [[1.2, '#2b0f12'], [0.8, '#d6342c']],
    legs: [[1.5, '#1a0d10'], [0.5, '#7a1414']], face: 'demon', front: 'rune', hand: '#d6342c', sleeve: '#2b0f12',
  },
  cat: {
    head: '#ffe0cc', torso: '#ff9ec7', arms: [[0.9, '#ffffff'], [1.1, '#ffe0cc']],
    legs: [[1.0, '#ffe0cc'], [0.7, '#ffffff'], [0.3, '#ff9ec7']], face: 'cat', front: 'dress', hand: '#ffe0cc', sleeve: '#ffffff',
  },
  ninja: {
    head: '#111114', torso: '#18181c', arms: [[1.7, '#18181c'], [0.3, '#2e2e36']],
    legs: [[1.6, '#18181c'], [0.4, '#0a0a0c']], face: 'ninja', front: 'ninja', hand: '#2e2e36', sleeve: '#18181c',
  },
  angel: {
    head: '#fbe3cf', torso: '#ffffff', arms: [[1.4, '#ffffff'], [0.6, '#fbe3cf']],
    legs: [[1.5, '#ffffff'], [0.5, '#e8c04a']], face: 'angel', front: 'robe', hand: '#fbe3cf', sleeve: '#ffffff',
  },
};

// ───────────────────────── текстуры лиц и торсов ─────────────────────────
function faceTexture(kind, skin) {
  return canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = skin; g.fillRect(0, 0, w, h);
    const cx = w / 2;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const ell = (x, y, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
    const line = (x1, y1, x2, y2, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    switch (kind) {
      case 'standard':
        ell(cx - 24, 62, 6, 11, '#111'); ell(cx + 24, 62, 6, 11, '#111');
        g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); g.arc(cx, 76, 38, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
        break;
      case 'anime':
        for (const s of [-1, 1]) {
          ell(cx + s * 26, 66, 11, 16, '#14142b'); ell(cx + s * 26, 70, 7, 9, '#3b3b8f');
          ell(cx + s * 22, 59, 4, 5, '#fff'); ell(cx + s * 30, 75, 2.4, 2.4, '#fff');
          line(cx + s * 40, 42, cx + s * 12, 48, '#cfcfe0', 5);
        }
        g.fillStyle = '#0d0d10'; g.beginPath(); g.roundRect(cx - 60, 92, 120, 70, 14); g.fill();
        line(cx - 120, 100, cx - 58, 104, '#0d0d10', 4); line(cx + 120, 100, cx + 58, 104, '#0d0d10', 4);
        line(cx, 96, cx, 150, '#25252c', 3);
        break;
      case 'cool':
        g.fillStyle = '#08080a';
        g.beginPath(); g.roundRect(cx - 58, 50, 50, 32, 10); g.fill();
        g.beginPath(); g.roundRect(cx + 8, 50, 50, 32, 10); g.fill();
        line(cx - 10, 58, cx + 10, 58, '#08080a', 6);
        line(cx - 46, 56, cx - 34, 70, 'rgba(255,255,255,.55)', 4); line(cx + 20, 56, cx + 32, 70, 'rgba(255,255,255,.55)', 4);
        g.strokeStyle = '#5a3a28'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 20, 108); g.quadraticCurveTo(cx, 116, cx + 24, 100); g.stroke();
        break;
      case 'demon':
        for (const s of [-1, 1]) {
          line(cx + s * 50, 40, cx + s * 10, 58, '#150404', 8);
          g.save(); g.shadowColor = '#ffcc00'; g.shadowBlur = 12;
          ell(cx + s * 28, 68, 13, 8, '#ffe45c', s * 0.25); g.restore();
          ell(cx + s * 28, 68, 3, 8, '#7a0000', s * 0.25);
        }
        g.fillStyle = '#2a0505'; g.beginPath(); g.ellipse(cx, 106, 38, 17, 0, 0, Math.PI); g.fill();
        g.fillStyle = '#fff';
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 24, 106); g.lineTo(cx + s * 14, 106); g.lineTo(cx + s * 19, 124); g.fill(); }
        break;
      case 'cat':
        for (const s of [-1, 1]) {
          ell(cx + s * 27, 66, 12, 17, '#2a1a3a'); ell(cx + s * 27, 69, 9, 12, '#ff6fa8'); ell(cx + s * 27, 71, 4, 6, '#2a1a3a');
          ell(cx + s * 23, 60, 4.5, 5.5, '#fff'); ell(cx + s * 31, 76, 2.4, 2.4, '#fff');
          line(cx + s * 40, 50, cx + s * 14, 50, '#2a1a3a', 5);
          ell(cx + s * 44, 96, 13, 7, 'rgba(255,90,140,.45)');
        }
        g.strokeStyle = '#a0405f'; g.lineWidth = 4;
        g.beginPath(); g.arc(cx - 8, 100, 8, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(cx + 8, 100, 8, 0, Math.PI); g.stroke();
        ell(cx, 90, 4, 3, '#e85f8a');
        break;
      case 'ninja':
        g.fillStyle = '#e6bd97'; g.beginPath(); g.roundRect(cx - 62, 48, 124, 36, 12); g.fill();
        for (const s of [-1, 1]) {
          ell(cx + s * 26, 66, 9, 7, '#fff'); ell(cx + s * 26, 66, 5, 6, '#111');
          line(cx + s * 44, 50, cx + s * 10, 60, '#111', 7);
        }
        break;
      case 'angel':
        g.strokeStyle = '#3a2a2a'; g.lineWidth = 5;
        for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 25, 70, 11, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); ell(cx + s * 42, 92, 12, 7, 'rgba(255,120,140,.4)'); }
        g.strokeStyle = '#b0524a'; g.lineWidth = 5; g.beginPath(); g.arc(cx, 90, 22, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
        break;
    }
  });
}

function frontTexture(kind, base) {
  if (!kind) return null;
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
    const line = (x1, y1, x2, y2, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    switch (kind) {
      case 'hoodie':
        poly([[26, 76], [102, 76], [112, 124], [16, 124]], '#1f2026');
        g.strokeStyle = '#33343d'; g.lineWidth = 3; g.stroke();
        line(52, 14, 50, 52, '#f2f2f2', 4); line(76, 14, 78, 52, '#f2f2f2', 4);
        g.fillStyle = '#f2f2f2'; g.fillRect(47, 50, 6, 6); g.fillRect(75, 50, 6, 6);
        break;
      case 'suit':
        poly([[44, 0], [84, 0], [64, 62]], '#f4f4f4');
        poly([[28, 0], [44, 0], [64, 62], [50, 80]], '#0c0c10');
        poly([[100, 0], [84, 0], [64, 62], [78, 80]], '#0c0c10');
        poly([[59, 12], [69, 12], [72, 28], [64, 78], [56, 28]], '#c8202a');
        poly([[58, 8], [70, 8], [67, 18], [61, 18]], '#9a141d');
        g.fillStyle = '#d8c070'; g.beginPath(); g.arc(64, 98, 3, 0, 7); g.fill();
        break;
      case 'rune':
        g.save(); g.shadowColor = '#ff3d2e'; g.shadowBlur = 14;
        g.strokeStyle = '#ff4a38'; g.lineWidth = 6; g.beginPath(); g.arc(64, 62, 28, 0, 7); g.stroke();
        g.lineWidth = 5; g.beginPath(); g.moveTo(64, 36); g.lineTo(88, 78); g.lineTo(40, 78); g.closePath(); g.stroke(); g.restore();
        line(10, 104, 118, 104, '#7a1414', 8);
        break;
      case 'dress':
        poly([[0, 0], [128, 0], [128, 22], [64, 58], [0, 22]], '#ffffff');
        line(0, 14, 64, 48, '#ff9ec7', 4); line(128, 14, 64, 48, '#ff9ec7', 4);
        poly([[64, 56], [44, 44], [44, 70]], '#e8407e'); poly([[64, 56], [84, 44], [84, 70]], '#e8407e');
        g.fillStyle = '#ff6fa8'; g.beginPath(); g.arc(64, 56, 7, 0, 7); g.fill();
        g.fillStyle = '#ffd1e6'; g.fillRect(0, 100, 128, 28);
        break;
      case 'ninja':
        line(-10, 0, 138, 128, '#2e2e38', 16);
        g.fillStyle = '#d62828'; g.fillRect(0, 92, 128, 26);
        g.fillStyle = '#9a1a1a'; g.fillRect(0, 92, 128, 5);
        break;
      case 'robe':
        line(0, 0, 64, 62, '#e8c04a', 7); line(128, 0, 64, 62, '#e8c04a', 7);
        g.fillStyle = '#e8c04a'; g.fillRect(0, 96, 128, 12);
        g.fillStyle = '#7ad7ff'; g.beginPath(); g.arc(64, 102, 8, 0, 7); g.fill();
        g.fillStyle = 'rgba(160,190,230,.22)'; g.fillRect(0, 110, 128, 18);
        break;
    }
  });
}

// ───────────────────────── сборка ─────────────────────────
function limb(parent, segs, w, d, pivotY) {
  // конечность свисает вниз от точки вращения; возвращаем список мешей-сегментов
  let y = 0;
  for (const [h, color] of segs) {
    box(parent, w, h, d, color, 0, -(y + h / 2), 0);
    y += h;
  }
}

export function buildCharacter(skinId = 'standard') {
  const def = SKIN_DEFS[skinId] || SKIN_DEFS.standard;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ноги
  const legL = new THREE.Group(); legL.position.set(-0.5, 2, 0); body.add(legL);
  const legR = new THREE.Group(); legR.position.set(0.5, 2, 0); body.add(legR);
  limb(legL, def.legs, 0.98, 0.98); limb(legR, def.legs, 0.98, 0.98);

  // торс (лицевая сторона — грань -Z)
  const frontTex = frontTexture(def.front, def.torso);
  const side = stdMat(def.torso);
  const front = frontTex ? new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.65 }) : side;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), [side, side, side, side, side, front]);
  add(body, torso, 0, 3, 0);

  // руки
  const armL = new THREE.Group(); armL.position.set(-1.5, 4, 0); body.add(armL);
  const armR = new THREE.Group(); armR.position.set(1.5, 4, 0); body.add(armR);
  limb(armL, def.arms, 0.98, 0.98); limb(armR, def.arms, 0.98, 0.98);

  // точка хвата оружия: вдоль руки вперёд
  const hand = new THREE.Group();
  hand.position.set(0, -1.85, 0);
  hand.rotation.x = -Math.PI / 2;
  armR.add(hand);

  // голова — цилиндр с лицом, «намотанным» на боковую поверхность
  const head = new THREE.Group(); head.position.set(0, 4, 0); body.add(head);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(def.face, def.head), roughness: 0.55 });
  const capMat = stdMat(def.head);
  const headMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.2, 28), [faceMat, capMat, capMat]);
  add(head, headMesh, 0, 0.6, 0);

  const rig = {
    skinId, def, root, body, torso, head, armL, armR, legL, legR, hand,
    wings: [], tail: null, halo: null, weapon: null,
    anim: { phase: 0, t: Math.random() * 10, emoteT: 0, recoil: 0, dead: 0, lastEmote: null },
  };
  ACCESSORIES[skinId]?.(rig);
  rig.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return rig;
}

// ───────────────────────── аксессуары по скинам ─────────────────────────
const ACCESSORIES = {
  anime(rig) {
    const h = rig.head, w = '#eeeef6', w2 = '#d4d4e4';
    box(h, 1.38, 0.36, 1.36, w, 0, 1.16, 0.05);
    box(h, 1.4, 1.0, 0.5, w, 0, 0.7, 0.52);
    box(h, 0.24, 0.8, 1.0, w, -0.68, 0.7, 0.1); box(h, 0.24, 0.8, 1.0, w, 0.68, 0.7, 0.1);
    // чёлка
    [[-0.45, 0.34, 0.1], [-0.05, 0.42, -0.05], [0.4, 0.36, -0.12]].forEach(([x, hh, rz]) => {
      const b = box(h, 0.46, hh * 1.7, 0.2, w2, x, 1.0 - hh * 0.35, -0.62); b.rotation.z = rz;
    });
    // торчащие пряди
    [[-0.5, 1.35, -0.2, 0.3, 0.5], [0.0, 1.45, -0.3, -0.1, 0.0], [0.5, 1.35, -0.2, 0.3, -0.5],
     [-0.35, 1.4, 0.35, 0.8, 0.4], [0.35, 1.4, 0.35, 0.8, -0.4], [0.0, 1.35, 0.5, 1.0, 0]].forEach(([x, y, z, rx, rz]) => {
      const c = cone(h, 0.3, 1.0, w, x, y, z, undefined, 4); c.rotation.set(rx * (z < 0 ? -1 : 1) * 0.6, 0.4, rz);
    });
    // капюшон худи
    box(rig.torso, 1.9, 0.4, 0.5, '#16171b', 0, 0.95, 0.5);
  },
  cool(rig) {
    const h = rig.head, k = '#0c0c0f';
    box(h, 1.36, 0.34, 1.36, k, 0, 1.14, 0.03);
    box(h, 1.1, 0.34, 0.5, k, 0, 1.28, -0.5).rotation.x = -0.25;
    box(h, 1.34, 0.7, 0.34, k, 0, 0.8, 0.52);
    box(rig.torso, 0.18, 0.5, 0.06, '#d8c070', 0.55, 0.1, -0.52);
  },
  demon(rig) {
    const h = rig.head, k = '#16090a';
    box(h, 1.3, 0.28, 1.3, '#220808', 0, 1.14, 0.05);
    for (const s of [-1, 1]) {
      const a = cone(h, 0.22, 1.0, k, s * 0.42, 1.55, 0.02, { rough: 0.3 }, 10); a.rotation.z = -s * 0.35;
      const b = cone(h, 0.13, 0.55, k, s * 0.72, 2.12, 0.02, { rough: 0.3 }, 10); b.rotation.z = -s * 0.9;
    }
    // крылья
    const pts = [[0, 0.3], [0.7, 1.6], [1.4, 2.5], [2.2, 1.4], [3.0, 1.9], [2.8, 0.5], [3.5, 0.3], [2.6, -0.5], [2.8, -1.4], [1.8, -0.8], [1.0, -1.5], [0, -0.6]];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.3, 0.6, 0.62); g.scale.set(s * 0.62, 0.62, 0.62);
      g.add(shapeMesh(pts, 0.1, '#8a1620', { side: THREE.DoubleSide, rough: 0.8 }));
      const bone = shapeMesh([[0, 0.3], [0.7, 1.6], [1.4, 2.5], [1.5, 2.5], [0.8, 1.6], [0.1, 0.3]], 0.2, '#1a0a0c');
      g.add(bone);
      g.rotation.y = s * -0.35;
      rig.torso.add(g); rig.wings.push({ g, s, base: -0.35 });
    }
    box(rig.torso, 0.3, 0.3, 0.2, '#ff3d2e', 0, 0.2, -0.52, { emissive: '#ff2200', ei: 1.6 });
  },
  cat(rig) {
    const h = rig.head, p = '#ff9cc8', p2 = '#f77fb3';
    box(h, 1.38, 0.34, 1.36, p, 0, 1.15, 0.03);
    box(h, 1.5, 1.7, 0.45, p, 0, 0.35, 0.55);
    box(h, 0.2, 0.9, 0.9, p, -0.7, 0.72, 0.05); box(h, 0.2, 0.9, 0.9, p, 0.7, 0.72, 0.05);
    [[-0.45, 0.4, 0.08], [0.0, 0.46, 0], [0.45, 0.4, -0.08]].forEach(([x, hh, rz]) => {
      const b = box(h, 0.48, hh * 1.5, 0.18, p2, x, 1.0 - hh * 0.2, -0.64); b.rotation.z = rz;
    });
    // уши
    for (const s of [-1, 1]) {
      const e = cone(h, 0.36, 0.72, p, s * 0.42, 1.55, -0.02, undefined, 3); e.rotation.set(0, Math.PI, -s * 0.28);
      const i = cone(h, 0.22, 0.5, '#ffd1e6', s * 0.42, 1.5, -0.12, undefined, 3); i.rotation.set(0, Math.PI, -s * 0.28);
      // косички
      box(h, 0.34, 1.7, 0.34, p, s * 0.92, -0.35, 0.2).rotation.z = s * 0.08;
      box(h, 0.4, 0.2, 0.4, '#e8407e', s * 0.86, 0.6, 0.2);
    }
    box(rig.torso, 2.3, 0.7, 1.5, '#ffd1e6', 0, -1.1, 0).castShadow = true;
    box(rig.torso, 2.3, 0.12, 1.5, '#ff9ec7', 0, -1.4, 0);
    // хвост
    const tail = new THREE.Group(); tail.position.set(0, -1.0, 0.8); rig.torso.add(tail);
    let cur = tail; const segs = [];
    for (let i = 0; i < 4; i++) {
      const sg = new THREE.Group(); sg.position.set(0, i ? 0.55 : 0, i ? 0 : 0); cur.add(sg);
      box(sg, 0.36, 0.7, 0.36, i === 3 ? '#ffffff' : '#ff9cc8', 0, 0.3, 0);
      sg.rotation.x = 0.55; cur = sg; segs.push(sg);
    }
    tail.rotation.x = 0.6;
    rig.tail = segs;
  },
  ninja(rig) {
    const h = rig.head;
    cyl(h, 0.66, 0.66, 0.3, '#d62828', 0, 0.88, 0, undefined, 24);
    const k = box(h, 0.3, 0.3, 0.3, '#d62828', 0, 0.88, 0.7);
    const t1 = box(h, 0.22, 0.9, 0.1, '#d62828', -0.14, 0.4, 0.9); t1.rotation.z = 0.2; t1.rotation.x = 0.35;
    const t2 = box(h, 0.22, 1.0, 0.1, '#b01f1f', 0.16, 0.35, 0.9); t2.rotation.z = -0.25; t2.rotation.x = 0.4;
    rig.tailBits = [t1, t2];
    // катана за спиной
    const g = new THREE.Group(); g.position.set(0, 0.2, 0.62); g.rotation.z = 0.75; rig.torso.add(g);
    box(g, 0.16, 2.6, 0.2, '#0c0c10', 0, 0.2, 0); box(g, 0.34, 0.1, 0.34, '#e8c04a', 0, 1.55, 0); box(g, 0.2, 0.7, 0.2, '#6a1a1a', 0, 1.95, 0);
  },
  angel(rig) {
    const h = rig.head, y = '#f4d77a';
    box(h, 1.38, 0.32, 1.36, y, 0, 1.15, 0.03);
    box(h, 1.4, 0.9, 0.4, y, 0, 0.75, 0.55);
    box(h, 0.22, 0.7, 0.8, y, -0.68, 0.8, 0.05); box(h, 0.22, 0.7, 0.8, y, 0.68, 0.8, 0.05);
    [[-0.4, 0.3, 0.12], [0.1, 0.34, -0.05], [0.45, 0.28, -0.12]].forEach(([x, hh, rz]) => {
      const b = box(h, 0.46, hh * 1.5, 0.18, '#e9c860', x, 1.0 - hh * 0.2, -0.64); b.rotation.z = rz;
    });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.08, 10, 28), stdMat('#ffd54a', { emissive: '#ffb400', ei: 1.3, metal: 0.4, rough: 0.3 }));
    halo.rotation.x = Math.PI / 2; halo.position.set(0, 1.85, 0); h.add(halo); rig.halo = halo;
    const pts = [[0, 0.2], [1.0, 1.2], [2.2, 2.0], [3.3, 2.2], [3.5, 1.6], [3.1, 1.3], [3.2, 0.7], [2.8, 0.4], [2.8, -0.2], [2.3, -0.4], [2.2, -1.0], [1.6, -1.1], [1.4, -1.6], [0.8, -1.5], [0.5, -1.9], [0, -1.2]];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.25, 0.7, 0.62); g.scale.set(s * 0.66, 0.66, 0.66);
      g.add(shapeMesh(pts, 0.14, '#ffffff', { rough: 0.9 }));
      const inner = shapeMesh(pts.map(([x, y]) => [x * 0.72 + 0.1, y * 0.7]), 0.2, '#e8f1ff', { rough: 0.9 });
      inner.position.z = -0.04; g.add(inner);
      g.rotation.y = s * -0.3;
      rig.torso.add(g); rig.wings.push({ g, s, base: -0.3 });
    }
  },
};

// ───────────────────────── оружие в руке ─────────────────────────
export function attachWeapon(rig, weaponObj) {
  if (rig.weapon) rig.hand.remove(rig.weapon);
  rig.weapon = weaponObj || null;
  if (weaponObj) { weaponObj.scale.setScalar(0.5); rig.hand.add(weaponObj); }
}

// ───────────────────────── анимация ─────────────────────────
// o: { speed: 0..1, air: bool, pitch: рад, holding: bool, emote: id|null, dead: 0..1, recoilKick: 0..1 }
export function updateRig(rig, dt, o = {}) {
  const a = rig.anim; a.t += dt;
  const sp = Math.min(1, o.speed || 0);
  a.phase += dt * (6 + sp * 6) * (sp > 0.05 ? 1 : 0);
  const sw = Math.sin(a.phase) * 0.95 * sp;
  const pitch = THREE.MathUtils.clamp(o.pitch || 0, -1.2, 1.2);
  const idle = Math.sin(a.t * 2) * 0.03;
  const emote = o.emote || null;
  if (emote !== a.lastEmote) { a.emoteT = 0; a.lastEmote = emote; }
  if (emote) a.emoteT += dt;

  rig.body.position.y = 0; rig.body.rotation.set(0, 0, 0);
  rig.legL.rotation.set(sw, 0, 0); rig.legR.rotation.set(-sw, 0, 0);
  rig.armL.rotation.set(-sw * 0.9 + idle, 0, 0.05 + idle); rig.armR.rotation.set(sw * 0.9 - idle, 0, -0.05 - idle);
  rig.head.rotation.set(0, 0, 0);
  if (o.air) { rig.legL.rotation.x = -0.5; rig.legR.rotation.x = 0.4; }

  if (o.holding && !emote) {
    // правая рука поднята вперёд и следует за прицелом
    rig.armR.rotation.set(Math.PI / 2 + pitch - (rig.anim.recoil || 0) * 0.35, 0, 0);
    rig.armL.rotation.x += 0.15;
    rig.head.rotation.x = -pitch * 0.6;
  }
  if (rig.weapon) rig.weapon.visible = !emote;

  if (emote) {
    const t = a.emoteT;
    switch (emote) {
      case 'wave':
        rig.armR.rotation.set(Math.PI * 0.95, 0, -0.2 + Math.sin(t * 9) * 0.45);
        break;
      case 'dance':
        rig.body.position.y = Math.abs(Math.sin(t * 7)) * 0.5;
        rig.body.rotation.y = Math.sin(t * 3.5) * 0.5;
        rig.armL.rotation.set(Math.PI * 0.85 + Math.sin(t * 7) * 0.5, 0, 0.3);
        rig.armR.rotation.set(Math.PI * 0.85 + Math.cos(t * 7) * 0.5, 0, -0.3);
        rig.legL.rotation.x = Math.sin(t * 7) * 0.7; rig.legR.rotation.x = -Math.sin(t * 7) * 0.7;
        break;
      case 'cheer':
        rig.body.position.y = Math.abs(Math.sin(t * 6)) * 0.8;
        rig.armL.rotation.set(Math.PI * 0.92, 0, 0.35); rig.armR.rotation.set(Math.PI * 0.92, 0, -0.35);
        break;
      case 'flex':
        rig.armL.rotation.set(0, 0, 1.2); rig.armR.rotation.set(0, 0, -1.2);
        rig.body.position.y = Math.abs(Math.sin(t * 4)) * 0.15;
        break;
    }
  }

  // крылья, хвост, нимб
  for (const w of rig.wings) w.g.rotation.y = w.s * (-0.3 - Math.sin(a.t * 3) * 0.12 - (o.air ? 0.35 : 0));
  if (rig.tail) rig.tail.forEach((sg, i) => { sg.rotation.z = Math.sin(a.t * 3 + i * 0.7) * 0.22; });
  if (rig.tailBits) rig.tailBits.forEach((b, i) => { b.rotation.z = (i ? -0.25 : 0.2) + Math.sin(a.t * 4 + i) * 0.12 + sp * (i ? -0.2 : 0.2); });
  if (rig.halo) { rig.halo.position.y = 1.85 + Math.sin(a.t * 2) * 0.06; rig.halo.rotation.z = a.t * 0.8; }

  // смерть: падаем на спину
  a.dead = o.dead || 0;
  rig.root.rotation.x = a.dead * (Math.PI / 2);
  rig.root.position.y = a.dead * 0.5;
  a.recoil = Math.max(0, (a.recoil || 0) - dt * 6);
}

export function kickRig(rig) { rig.anim.recoil = 1; }

// цвета для модели рук от первого лица
export function skinColors(skinId) {
  const d = SKIN_DEFS[skinId] || SKIN_DEFS.standard;
  return { sleeve: d.sleeve, hand: d.hand, torso: d.torso, head: d.head };
}
