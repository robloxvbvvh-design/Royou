'use strict';
/* ART: all drawing — stickmen, statues, backgrounds, cover, ending cutscene. */
(() => {
const W = 1280, H = 720, GROUND = 575;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t * t * (3 - 2 * t);
const seg = (T, a, b) => clamp((T - a) / (b - a), 0, 1);

/* ---------------- stickman ---------------- */
const SKIN_COL = { steel: '#8d98a6', gold: '#e8b800', blue: '#2f6fe0', green: '#2fa84a', royal: '#7a3cc8', shadow: '#5ff' };

function drawStick(c, o) {
  const type = o.type || 'club', s = o.s || 1, t = o.t || 0, mv = !!o.moving;
  const team1 = o.team === 1;
  let col = o.col || (o.zomb ? '#2c6b2f' : team1 ? '#c8201a' : '#111');
  if (o.flash > 0) col = o.zomb ? '#8f8' : team1 ? '#ff9a90' : '#9a9a9a';
  const skin = !team1 && !o.zomb ? o.skin : null;
  c.save();
  c.translate(o.x, o.y);
  if (o.rot) c.rotate(o.rot);
  c.scale((o.dir || 1) * s, s * (o.squash || 1));
  c.globalAlpha = o.alpha == null ? 1 : o.alpha;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = col; c.fillStyle = col;
  const lw = o.lw || 4.4;
  c.lineWidth = lw;
  if (skin === 'shadow') { c.shadowColor = '#5ff'; c.shadowBlur = 12; }
  const ph = t * 10;
  const bob = mv ? Math.abs(Math.sin(ph)) * 2.2 : Math.sin(t * 2.2) * 0.8;
  const shake = o.shake ? Math.sin(t * 40) * 2 : 0;
  c.translate(shake, 0);
  const hipY = -34 - bob, shY = -62 - bob, hdY = -75 - bob;
  const L = (x1, y1, x2, y2) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };

  // cape (behind body)
  if (skin === 'blue' || skin === 'royal') {
    c.save(); c.fillStyle = SKIN_COL[skin]; c.globalAlpha *= 0.92;
    c.beginPath(); c.moveTo(-2, shY); c.lineTo(-24 + Math.sin(t * 5) * 3, shY + 34); c.lineTo(-14, hipY + 8); c.lineTo(0, hipY - 6); c.closePath(); c.fill(); c.restore();
  }
  // legs
  const sw = mv ? Math.sin(ph) * 14 : 5;
  const l1 = mv ? Math.max(0, Math.cos(ph)) * 6 : 0, l2 = mv ? Math.max(0, -Math.cos(ph)) * 6 : 0;
  c.beginPath(); c.moveTo(0, hipY); c.lineTo(sw * 0.5 + 2, hipY * 0.5); c.lineTo(sw, -l1); c.stroke();
  const sw2 = mv ? -sw : -5;
  c.beginPath(); c.moveTo(0, hipY); c.lineTo(sw2 * 0.5 + 2, hipY * 0.5); c.lineTo(sw2, -l2); c.stroke();
  // body
  if (type === 'mage') {
    c.beginPath(); c.moveTo(-3, shY); c.lineTo(3, shY); c.lineTo(15, -4); c.lineTo(-15, -4); c.closePath(); c.fill();
  } else L(0, hipY, 0, shY);
  // head
  c.beginPath(); c.arc(0, hdY, 11, 0, 7); c.fill();

  // arm angle
  const p = o.atk >= 0 ? o.atk : -1;
  let a = 0.55, ext = 0, pull = 0;
  const melee = type === 'club' || type === 'sword' || type === 'giant' || type === 'helper' || type === 'miner' || type === 'zombie' || type === 'runner' || type === 'brute';
  if (melee) {
    let pp = p;
    if (type === 'miner' && o.mine) pp = (t * 1.9) % 1;
    if (type === 'zombie' || type === 'runner' || type === 'brute') { a = -0.1 + Math.sin(t * 3) * 0.1; if (p >= 0) a = lerp(-1.6, 1.0, Math.min(1, p * 1.4)); }
    else a = pp >= 0 ? lerp(-2.0, 1.2, ease(Math.min(1, pp * 1.4))) : 0.5 + (mv ? Math.sin(ph) * 0.15 : 0);
  } else if (type === 'captain') { a = p >= 0 ? -0.12 : 0.05; ext = p >= 0 ? Math.sin(p * Math.PI) * 24 : 0; }
  else if (type === 'archer') { a = -0.05; pull = p >= 0 ? (p < 0.6 ? p / 0.6 : 1 - (p - 0.6) / 0.4) : 0; }
  else if (type === 'mage') { a = p >= 0 ? lerp(-1.5, -0.2, p) : -0.35 + Math.sin(t * 2) * 0.05; }
  const hx = Math.cos(a) * 22 + ext, hy = shY + Math.sin(a) * 22;
  // back arm / shield
  if (type === 'sword' || type === 'captain') {
    c.beginPath(); c.ellipse(5, shY + 14, 9, 17, 0, 0, 7); c.fillStyle = o.shield || (team1 ? '#7a1410' : '#333'); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = col; c.stroke(); c.fillStyle = col; c.lineWidth = lw;
    L(0, shY, 5, shY + 12);
  } else L(0, shY, -9, shY + 16);
  // front arm
  L(0, shY, hx, hy);
  // weapon
  c.save(); c.translate(hx, hy); c.rotate(a);
  switch (type) {
    case 'club': case 'zombie': case 'runner': case 'brute':
      if (type === 'club') { c.lineWidth = lw * 1.1; L(0, 0, 24, 0); c.lineWidth = lw * 2.4; L(24, 0, 37, 0); }
      break;
    case 'giant':
      c.lineWidth = lw * 1.2; L(0, 0, 30, 0); c.lineWidth = lw * 2.8; L(30, 0, 48, 0);
      c.lineWidth = lw * 0.8; L(36, -4, 38, -9); L(42, 4, 44, 9); break;
    case 'sword': case 'helper':
      c.lineWidth = lw * 0.8; L(-4, 0, 36, 0); c.lineWidth = lw * 0.9; L(6, -7, 6, 7); break;
    case 'captain':
      c.rotate(-a + (p >= 0 ? -0.05 : -0.18)); c.lineWidth = lw * 0.75; L(-30, 0, 58, 0);
      c.beginPath(); c.moveTo(58, -5); c.lineTo(76, 0); c.lineTo(58, 5); c.closePath(); c.fillStyle = '#9aa'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 1.5; c.stroke(); break;
    case 'archer':
      c.rotate(-a); c.lineWidth = lw * 0.8;
      c.beginPath(); c.arc(4, 0, 19, -1.25, 1.25); c.stroke();
      c.lineWidth = 1.6; c.beginPath(); c.moveTo(4 + Math.cos(-1.25) * 19, Math.sin(-1.25) * 19); c.lineTo(4 - pull * 16, 0); c.lineTo(4 + Math.cos(1.25) * 19, Math.sin(1.25) * 19); c.stroke();
      if (pull > 0.05) { c.lineWidth = 2; L(4 - pull * 16, 0, 26, 0); }
      break;
    case 'mage':
      c.lineWidth = lw * 0.7; L(-16, 0, 40, 0);
      c.beginPath(); c.arc(46, 0, 7, 0, 7); c.fillStyle = team1 ? '#ff7a00' : '#7a5cff'; c.shadowColor = c.fillStyle; c.shadowBlur = 14; c.fill(); break;
    case 'miner':
      c.lineWidth = lw * 0.8; L(-6, 0, 30, 0); c.lineWidth = lw; c.beginPath(); c.moveTo(22, -13); c.quadraticCurveTo(38, 0, 22, 13); c.stroke(); break;
  }
  c.restore();
  if (type === 'miner' && o.carry) { c.beginPath(); c.arc(-9, shY + 8, 6, 0, 7); c.fillStyle = '#e8b800'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#111'; c.stroke(); }
  if (type === 'archer') { c.lineWidth = 3; L(-5, shY - 2, -11, shY - 14); L(-3, shY, -8, shY - 14); }

  // hats / helmets
  const helm = (fill) => { c.beginPath(); c.arc(0, hdY - 1, 12.5, Math.PI, 0); c.lineTo(12.5, hdY + 3); c.lineTo(-12.5, hdY + 3); c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = 2.2; c.strokeStyle = '#111'; c.stroke(); };
  if (type === 'miner') { c.beginPath(); c.arc(0, hdY - 2, 12.5, Math.PI, 0); c.closePath(); c.fillStyle = '#e8b800'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#111'; c.stroke(); c.fillStyle = '#fff'; c.fillRect(6, hdY - 9, 5, 4); }
  if (type === 'sword') { helm(team1 ? '#7a1410' : '#4a4a4a'); c.strokeStyle = col; c.lineWidth = 3; L(0, hdY - 13, 0, hdY - 20); }
  if (type === 'captain') { helm(team1 ? '#7a1410' : '#4a4a4a'); c.strokeStyle = team1 ? '#ff5a3c' : '#c8201a'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, hdY - 13); c.quadraticCurveTo(-8, hdY - 24, -16 + Math.sin(t * 6) * 2, hdY - 14); c.stroke(); }
  if (type === 'mage') { c.beginPath(); c.moveTo(-13, hdY - 4); c.lineTo(13, hdY - 4); c.lineTo(3, hdY - 34); c.closePath(); c.fillStyle = team1 ? '#7a1410' : '#2a2a5a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#111'; c.stroke(); }
  if (type === 'giant' && o.helm) { helm('#58606a'); c.strokeStyle = '#ddd'; c.lineWidth = 4; L(-12, hdY - 8, -18, hdY - 20); L(12, hdY - 8, 18, hdY - 20); }
  if (o.zomb) { c.fillStyle = '#ff2'; c.fillRect(3, hdY - 3, 3, 3); }

  // skin accessories
  if (skin) {
    const sc = SKIN_COL[skin];
    if (skin === 'steel') { helm('#8d98a6'); }
    else if (skin === 'gold') { c.fillStyle = sc; c.fillRect(-11.5, hdY - 6, 23, 4); c.beginPath(); c.moveTo(-8, hdY - 9); c.lineTo(-5, hdY - 17); c.lineTo(0, hdY - 10); c.lineTo(5, hdY - 17); c.lineTo(8, hdY - 9); c.closePath(); c.fill(); }
    else if (skin === 'green') { c.strokeStyle = sc; c.lineWidth = 4; c.beginPath(); c.moveTo(0, shY - 1); c.quadraticCurveTo(-14, shY + 2 + Math.sin(t * 6) * 3, -26, shY + 8 + Math.sin(t * 6 + 1) * 4); c.stroke(); }
    else if (skin === 'royal') { c.fillStyle = '#ffd21f'; c.beginPath(); c.moveTo(-9, hdY - 9); c.lineTo(-9, hdY - 20); c.lineTo(-4, hdY - 14); c.lineTo(0, hdY - 22); c.lineTo(4, hdY - 14); c.lineTo(9, hdY - 20); c.lineTo(9, hdY - 9); c.closePath(); c.fill(); }
    else if (skin === 'blue') { c.strokeStyle = sc; c.lineWidth = 4; c.beginPath(); c.moveTo(-11, hdY - 2); c.lineTo(11, hdY - 6); c.stroke(); }
    else if (skin === 'shadow') { c.fillStyle = '#5ff'; c.fillRect(3, hdY - 4, 3, 3); c.fillRect(7, hdY - 4, 3, 3); }
  }
  c.restore();
}

/* ---------------- background ---------------- */
const mountains = [], hills = [], clouds = [];
(function () {
  let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) mountains.push({ x: i * 260 + rnd() * 80, w: 220 + rnd() * 200, h: 90 + rnd() * 140 });
  for (let i = 0; i < 40; i++) hills.push({ x: i * 340 + rnd() * 100, w: 300 + rnd() * 200, h: 40 + rnd() * 60 });
  for (let i = 0; i < 20; i++) clouds.push({ x: i * 420 + rnd() * 200, y: 50 + rnd() * 140, w: 90 + rnd() * 90 });
})();

function drawBG(c, cam, t, theme) {
  const th = theme || { sky0: '#cfdfee', sky1: '#f4ecd8', far: '#c6d0da', mid: '#d3c7ad', ground: '#cfc09c', line: '#111' };
  const g = c.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, th.sky0); g.addColorStop(1, th.sky1);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // sun
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(1000 - cam * 0.02, 120, 54, 0, 7); c.fill();
  // clouds
  c.fillStyle = 'rgba(255,255,255,.8)';
  for (const k of clouds) {
    const x = ((k.x - cam * 0.25 + t * 6) % 9000 + 9000) % 9000 - 200;
    if (x < -200 || x > W + 200) continue;
    c.beginPath(); c.ellipse(x, k.y, k.w, k.w * 0.28, 0, 0, 7); c.ellipse(x + k.w * 0.4, k.y - 10, k.w * 0.5, k.w * 0.25, 0, 0, 7); c.fill();
  }
  // far mountains
  c.fillStyle = th.far;
  for (const m of mountains) {
    const x = m.x - cam * 0.15;
    if (x < -300 || x > W + 300) continue;
    c.beginPath(); c.moveTo(x - m.w / 2, GROUND - 40); c.lineTo(x, GROUND - 40 - m.h); c.lineTo(x + m.w / 2, GROUND - 40); c.closePath(); c.fill();
  }
  // hills
  c.fillStyle = th.mid;
  for (const h of hills) {
    const x = h.x - cam * 0.45;
    if (x < -400 || x > W + 400) continue;
    c.beginPath(); c.ellipse(x, GROUND - 6, h.w, h.h + 20, 0, Math.PI, 0); c.fill();
  }
  // ground
  c.fillStyle = th.ground; c.fillRect(0, GROUND, W, H - GROUND);
  c.fillStyle = 'rgba(0,0,0,.07)';
  for (let i = 0; i < 14; i++) { const x = ((i * 190 - cam) % (W + 190) + W + 190) % (W + 190) - 90; c.fillRect(x, GROUND + 26 + (i % 4) * 22, 70, 5); }
  c.strokeStyle = th.line; c.lineWidth = 5; c.beginPath(); c.moveTo(0, GROUND); c.lineTo(W, GROUND); c.stroke();
}

/* ---------------- statue / mine / castle ---------------- */
function drawStatue(c, x, team, frac, o) {
  o = o || {};
  const col = team === 1 ? '#7a2a26' : '#5a5a5a', lite = team === 1 ? '#a8453f' : '#8d8d8d';
  const shake = o.shake ? (Math.random() - 0.5) * 6 : 0;
  c.save(); c.translate(x + shake, GROUND);
  // pedestal
  c.fillStyle = col; c.strokeStyle = '#111'; c.lineWidth = 5;
  c.fillRect(-54, -54, 108, 54); c.strokeRect(-54, -54, 108, 54);
  c.fillRect(-40, -92, 80, 40); c.strokeRect(-40, -92, 80, 40);
  c.fillStyle = lite; c.fillRect(-40, -92, 80, 8);
  // carved warrior
  const sc = o.big ? 2.7 : 2.1;
  c.save(); c.translate(0, -92); c.scale(sc, sc);
  c.strokeStyle = '#2a2a2a'; c.fillStyle = col; c.lineWidth = 6; c.lineCap = 'round';
  c.beginPath(); c.arc(0, -75, 11, 0, 7); c.fillStyle = lite; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(0, -62); c.lineTo(0, -34); c.moveTo(0, -34); c.lineTo(-9, 0); c.moveTo(0, -34); c.lineTo(9, 0); c.moveTo(0, -60); c.lineTo(-14, -42); c.moveTo(0, -60); c.lineTo(17, -78); c.stroke();
  c.lineWidth = 5; c.beginPath(); c.moveTo(17, -78); c.lineTo(22, -112); c.stroke();
  c.restore();
  // cracks
  c.strokeStyle = '#111'; c.lineWidth = 3;
  if (frac < 0.66) { c.beginPath(); c.moveTo(-30, -50); c.lineTo(-18, -34); c.lineTo(-26, -16); c.moveTo(20, -88); c.lineTo(28, -70); c.stroke(); }
  if (frac < 0.33) { c.beginPath(); c.moveTo(10, -50); c.lineTo(2, -30); c.lineTo(14, -6); c.moveTo(-34, -86); c.lineTo(-10, -70); c.stroke(); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-54, -54, 22, 14); }
  c.restore();
  if (!o.noBar) {
    const bw = 130, bx = x - bw / 2, by = GROUND - (o.big ? 330 : 290);
    c.fillStyle = '#111'; c.fillRect(bx - 3, by - 3, bw + 6, 16);
    c.fillStyle = '#ddd'; c.fillRect(bx, by, bw, 10);
    c.fillStyle = team === 1 ? '#e03a2e' : '#33c24b'; c.fillRect(bx, by, bw * clamp(frac, 0, 1), 10);
  }
}

function drawCastle(c, x, active, t) {
  // low wall with crenellations behind the statue + hidden archers
  c.save(); c.translate(x, GROUND);
  c.fillStyle = '#7d7468'; c.strokeStyle = '#111'; c.lineWidth = 4;
  c.fillRect(-110, -46, 220, 46); c.strokeRect(-110, -46, 220, 46);
  for (let i = -5; i <= 4; i++) { c.fillRect(i * 22 + 2, -60, 16, 14); c.strokeRect(i * 22 + 2, -60, 16, 14); }
  c.fillStyle = '#2a2520'; c.beginPath(); c.moveTo(-22, 0); c.lineTo(-22, -26); c.arc(0, -26, 22, Math.PI, 0); c.lineTo(22, 0); c.fill();
  if (active) {
    for (let i = -4; i <= 4; i += 2) { drawStick(c, { x: i * 22 + 10, y: -58, s: 0.6, type: 'archer', col: '#111', dir: 1, t: t + i, atk: ((t * 1.2 + i) % 1) < 0.5 ? ((t * 1.2 + i) % 1) * 2 : -1 }); }
  }
  c.restore();
}

function drawMine(c, x, t, team) {
  c.save(); c.translate(x, GROUND);
  c.fillStyle = team === 1 ? '#6b5a58' : '#6b6b6b'; c.strokeStyle = '#111'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(-70, 0); c.lineTo(-48, -42); c.lineTo(-14, -66); c.lineTo(26, -58); c.lineTo(58, -30); c.lineTo(76, 0); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ffd21f';
  const nug = [[-30, -22, 10], [4, -38, 12], [34, -20, 9], [-4, -12, 8], [-52, -8, 6], [52, -8, 7]];
  for (const n of nug) { c.beginPath(); c.moveTo(n[0] - n[2], n[1]); c.lineTo(n[0], n[1] - n[2]); c.lineTo(n[0] + n[2], n[1]); c.lineTo(n[0], n[1] + n[2] * 0.7); c.closePath(); c.fill(); c.lineWidth = 2.5; c.stroke(); }
  c.restore();
}

/* ---------------- hp bar over units ---------------- */
function drawHp(c, x, y, w, frac, enemy) {
  if (frac >= 0.999) return;
  c.fillStyle = '#111'; c.fillRect(x - w / 2 - 2, y - 2, w + 4, 8);
  c.fillStyle = '#ccc'; c.fillRect(x - w / 2, y, w, 4);
  c.fillStyle = enemy ? '#e03a2e' : '#33c24b'; c.fillRect(x - w / 2, y, w * clamp(frac, 0, 1), 4);
}

/* ---------------- cover (main menu) ---------------- */
function drawCover(c, t) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f6c98a'); g.addColorStop(0.45, '#fbe6c0'); g.addColorStop(1, '#e9dcc0');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(640, 330, 190, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(640, 330, 250, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 6; i++) { const x = ((i * 300 + t * 10) % 1700) - 200, y = 190 + (i % 3) * 50; c.beginPath(); c.ellipse(x, y, 90, 22, 0, 0, 7); c.ellipse(x + 40, y - 10, 50, 20, 0, 0, 7); c.fill(); }
  c.fillStyle = '#d2b48a';
  c.beginPath(); c.moveTo(0, 470); c.lineTo(180, 400); c.lineTo(340, 450); c.lineTo(560, 380); c.lineTo(760, 440); c.lineTo(980, 390); c.lineTo(1280, 450); c.lineTo(1280, 720); c.lineTo(0, 720); c.fill();
  c.fillStyle = '#b08d5f';
  c.beginPath(); c.moveTo(0, 530); c.quadraticCurveTo(300, 470, 640, 505); c.quadraticCurveTo(1000, 470, 1280, 530); c.lineTo(1280, 720); c.lineTo(0, 720); c.fill();
  c.strokeStyle = '#111'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 530); c.quadraticCurveTo(300, 470, 640, 505); c.quadraticCurveTo(1000, 470, 1280, 530); c.stroke();
  // flag poles & far army silhouettes
  c.fillStyle = '#7a1410';
  for (const fx of [90, 1190]) { c.strokeStyle = '#111'; c.lineWidth = 5; c.beginPath(); c.moveTo(fx, 520); c.lineTo(fx, 360); c.stroke(); c.beginPath(); c.moveTo(fx, 366); c.lineTo(fx + (fx < 600 ? 50 : -50), 384 + Math.sin(t * 3) * 4); c.lineTo(fx, 404); c.closePath(); c.fill(); }
  for (let i = 0; i < 7; i++) { drawStick(c, { x: 170 + i * 56, y: 508 + (i % 2) * 6, s: 0.7, type: i % 3 === 0 ? 'archer' : 'club', col: '#222', t: t + i, dir: 1 }); }
  for (let i = 0; i < 7; i++) { drawStick(c, { x: 1110 - i * 56, y: 508 + (i % 2) * 6, s: 0.7, type: i % 3 === 0 ? 'archer' : 'club', team: 1, t: t + i, dir: -1 }); }
  // heroes: knight, captain, mage
  const S = 2.5;
  drawStick(c, { x: 410, y: 500, s: S, type: 'sword', t, dir: 1, lw: 4, shield: '#333' });
  drawStick(c, { x: 640, y: 508, s: S * 1.12, type: 'captain', t: t + 1, dir: 1, lw: 4 });
  drawStick(c, { x: 870, y: 500, s: S, type: 'mage', t: t + 2, dir: -1, lw: 4 });
}

/* ---------------- ending cutscene ---------------- */
const END_SUBS = [
  [0, 3.2, 'Последняя статуя трескается и рушится...'],
  [3.2, 6.2, 'Но из обломков поднимается Гигант в шлеме!'],
  [6.2, 11, 'Армия обрушивается на него — и Гигант падает на колени!'],
  [11, 15, 'Он встаёт... и одним ударом наносит колоссальный урон!'],
  [15, 19.5, 'Капитан бросается вперёд. Гигант хватает его и хохочет...'],
  [19.5, 24, 'Но Капитан вонзает копьё — и Гигант повержен!'],
  [24, 99, '']
];
const END_LEN = 27;
function endSub(T) { for (const s of END_SUBS) if (T >= s[0] && T < s[1]) return s[2]; return ''; }

function drawEnding(c, T) {
  drawBG(c, 0, T, { sky0: '#bcc7d8', sky1: '#efe0c8', far: '#b3bccb', mid: '#c7b99c', ground: '#c4b48c', line: '#111' });
  const gx0 = 1000;
  let shakeAmt = 0;
  if (T < 3.2) shakeAmt = 3 + T * 2; else if (T > 12.8 && T < 13.8) shakeAmt = 14 * (1 - (T - 12.8)); else if (T > 20.5 && T < 22.4) shakeAmt = 6;
  c.save();
  if (shakeAmt) c.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
  // statue collapse
  if (T < 3.2) {
    if (T < 1.6) drawStatue(c, gx0, 1, 0.1, { shake: true, noBar: true, big: true });
    else {
      const f = T - 1.6;
      const parts = [[-44, -30, 40, 30], [4, -30, 44, 30], [-30, -70, 60, 34], [-6, -118, 36, 30], [-34, -150, 30, 26], [10, -170, 30, 28], [-60, -44, 26, 40]];
      parts.forEach((q, i) => {
        const dy = Math.min(f * f * 160 * (0.4 + (i % 3) * 0.3), -q[1] + 8 - (i < 2 ? 0 : 0));
        c.save(); c.translate(gx0 + q[0] + q[2] / 2 + (i - 3) * f * 22, GROUND + q[1] + dy);
        c.rotate((i % 2 ? 1 : -1) * f * 0.4 * (i % 4)); c.fillStyle = i % 2 ? '#7a2a26' : '#a8453f'; c.strokeStyle = '#111'; c.lineWidth = 4;
        c.fillRect(-q[2] / 2, 0, q[2], q[3]); c.strokeRect(-q[2] / 2, 0, q[2], q[3]); c.restore();
      });
    }
    c.fillStyle = 'rgba(120,100,80,.35)';
    for (let i = 0; i < 9; i++) { const r = 20 + i * 8 + T * 14; c.beginPath(); c.arc(gx0 + Math.sin(i * 2) * 80, GROUND - 20 - T * 8 - i * 6, r, 0, 7); c.fill(); }
  } else {
    // rubble pile
    c.fillStyle = '#8a5a52'; c.strokeStyle = '#111'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(gx0 - 120, GROUND); c.lineTo(gx0 - 60, GROUND - 26); c.lineTo(gx0 - 10, GROUND - 14); c.lineTo(gx0 + 50, GROUND - 32); c.lineTo(gx0 + 130, GROUND); c.closePath(); c.fill(); c.stroke();
  }
  // your army (left)
  const army = [['club', 0], ['club', 1], ['sword', 2], ['sword', 3], ['archer', 4], ['club', 5], ['sword', 6]];
  const gxNow = gx0 - 150 * ease(seg(T, 11.5, 14.2));
  army.forEach(([type, i]) => {
    const base = 160 + i * 52;
    const run = seg(T, 6.2, 9.4);
    let x = Math.min(base + 640 * ease(run), gx0 - 150 - (i % 4) * 26);
    let y = GROUND + (i % 2) * 12 - 4, rot = 0, alpha = 1;
    if (T > 12.9) { const k = seg(T, 12.9, 14.6); x -= 260 * k * (1 + (i % 3) * 0.2); y -= Math.sin(k * Math.PI) * 220; rot = -k * 7 * (i % 2 ? 1 : -1); alpha = 1 - ease(seg(T, 14, 15.2)); }
    if (alpha <= 0) return;
    const fighting = T > 8.6 && T < 12.9;
    drawStick(c, { x, y, s: 1, type, dir: 1, t: T + i, moving: T > 6.2 && T < 8.8, atk: fighting ? ((T * 2.2 + i * 0.37) % 1) : -1, rot, alpha, skin: 'steel' });
  });
  // giant
  let gs = 0, gxPos = gx0, squash = 1, grot = 0, laugh = false, gAtk = -1;
  if (T >= 3.2) gs = lerp(0.3, 3.1, ease(seg(T, 3.2, 6.0)));
  if (T > 9.2 && T < 10.2) squash = 1 - 0.3 * seg(T, 9.2, 9.8); else if (T >= 10.2 && T < 11.4) squash = 0.7 + 0.3 * ease(seg(T, 10.2, 11.4));
  if (T >= 11.5) gxPos = gxNow;
  if (T > 12.4 && T < 13.4) gAtk = seg(T, 12.4, 13.4);
  if (T >= 17.2 && T < 20.4) laugh = true;
  if (T >= 20.6) grot = ease(seg(T, 20.6, 22.6)) * 1.5;
  const gAlpha = T > 24 ? 1 - seg(T, 24, 26) : 1;
  if (gs > 0 && gAlpha > 0) {
    drawStick(c, { x: gxPos, y: GROUND, s: gs, type: 'giant', team: 1, dir: -1, t: T, helm: true, squash, rot: grot, shake: laugh && Math.floor(T * 9) % 2 === 0, moving: T > 11.4 && T < 14.2, atk: gAtk, alpha: gAlpha, lw: 4 });
    if (laugh && T < 20.4) {
      c.save(); c.font = 'bold 54px Impact, sans-serif'; c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = '#000'; c.fillStyle = '#fff';
      const bx = gxPos - 20, by = GROUND - 330 + Math.sin(T * 18) * 5;
      c.strokeText('ХА-ХА-ХА!', bx, by); c.fillText('ХА-ХА-ХА!', bx, by); c.restore();
    }
  }
  // shock wave on slam
  if (T > 13 && T < 14) { const k = seg(T, 13, 14); c.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; c.lineWidth = 12; c.beginPath(); c.ellipse(gxPos - 190, GROUND + 6, 40 + k * 700, 12 + k * 40, 0, 0, 7); c.stroke(); }
  if (T > 13 && T < 14.6) {
    c.save(); c.font = 'bold 70px Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffd21f'; c.strokeStyle = '#000'; c.lineWidth = 7;
    c.strokeText('-9999', 520, 300 - seg(T, 13, 14.6) * 60); c.fillText('-9999', 520, 300 - seg(T, 13, 14.6) * 60); c.restore();
  }
  // captain
  let cx = 330, cy = GROUND, crot = 0, cAtk = -1, cMove = false, cs = 1.12;
  if (T >= 15) { const k = ease(seg(T, 15, 17.2)); cx = lerp(330, gxPos - 150, k); cMove = T < 17.2; }
  if (T >= 17.2 && T < 20.5) { cx = gxPos - 120 + Math.sin(T * 6) * 3; cy = GROUND - 170 + Math.sin(T * 3) * 6; crot = Math.sin(T * 8) * 0.08; }
  if (T >= 19.6 && T < 20.8) cAtk = seg(T, 19.6, 20.6);
  if (T >= 20.8) { cx = gxPos - 210; cy = GROUND; }
  if (T < 15 && T > 12.9) cx = 330;
  drawStick(c, { x: cx, y: cy, s: cs, type: 'captain', dir: 1, t: T, moving: cMove, atk: cAtk, rot: crot, skin: 'royal', lw: 4.2 });
  // grip hand (giant fingers)
  if (T >= 17.2 && T < 20.5) { c.fillStyle = '#c8201a'; c.strokeStyle = '#111'; c.lineWidth = 4; c.beginPath(); c.ellipse(cx + 10, cy - 20, 42, 24, 0, 0, 7); c.fill(); c.stroke(); }
  // final flash
  if (T > 20.3 && T < 21.2) { c.fillStyle = 'rgba(255,255,255,' + (1 - Math.abs(T - 20.6) * 1.6) + ')'; c.fillRect(-20, -20, W + 40, H + 40); }
  // dust when giant falls
  if (T > 21.6 && T < 24) { c.fillStyle = 'rgba(120,100,80,.3)'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(gxPos + 140 + i * 30, GROUND - 20 - (T - 21.6) * 10, 30 + i * 6, 0, 7); c.fill(); } }
  c.restore();
  // fade out
  if (T > 24) { c.fillStyle = 'rgba(0,0,0,' + seg(T, 24, 26.5) + ')'; c.fillRect(0, 0, W, H); }
}

window.Art = { W, H, GROUND, drawStick, drawBG, drawStatue, drawCastle, drawMine, drawHp, drawCover, drawEnding, endSub, END_LEN, SKIN_COL };
})();
