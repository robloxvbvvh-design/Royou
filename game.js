'use strict';
/* STICK LEGEND — game logic, UI, battle simulation. Drawing lives in art.js */
(() => {
const { W, H, GROUND, drawStick, drawBG, drawStatue, drawCastle, drawMine, drawHp, drawCover, drawEnding, endSub, END_LEN } = window.Art;
const $ = (s, r = document) => r.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d'), stage = $('#stage'), ui = $('#ui');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const POPCAP = 30;

/* ============ save ============ */
const KEY = 'stick_legend_save_v1';
const defSave = () => ({ gems: 120, cleared: 0, skins: ['black'], skin: 'black', up: { statue: 0, mine: 0, dmg: 0, hp: 0, secret: 0 }, zBest: 0, tWins: 0, lastFree: 0, seenIntro: false, ending: false });
let SAVE;
try { SAVE = Object.assign(defSave(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { SAVE = defSave(); }
SAVE.up = Object.assign(defSave().up, SAVE.up || {});
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(SAVE)); } catch (e) {} };

/* ============ data ============ */
const UNITS = {
  miner:   { n: 'Шахтёр',   cost: 100,  hp: 50,   dmg: 0,  range: 0,   speed: 80, cd: 1,    spawn: 2.2, pop: 1, unlock: 0, d: 'Добывает золото' },
  club:    { n: 'Булавщик', cost: 120,  hp: 95,   dmg: 11, range: 38,  speed: 78, cd: 0.75, spawn: 2.8, pop: 1, unlock: 0, d: 'Бьёт булавой' },
  archer:  { n: 'Лучник',   cost: 300,  hp: 60,   dmg: 13, range: 340, speed: 70, cd: 1.25, spawn: 4,   pop: 2, unlock: 1, d: 'Стреляет из лука' },
  sword:   { n: 'Мечник',   cost: 200,  hp: 115,  dmg: 15, range: 40,  speed: 92, cd: 0.55, spawn: 3.2, pop: 1, unlock: 2, d: 'Быстрый, со щитом' },
  captain: { n: 'Капитан',  cost: 500,  hp: 270,  dmg: 25, range: 66,  speed: 68, cd: 0.95, spawn: 5,   pop: 3, unlock: 3, d: 'Копьё и щит', armor: 0.8 },
  mage:    { n: 'Маг',      cost: 800,  hp: 95,   dmg: 34, range: 370, speed: 62, cd: 2.2,  spawn: 7,   pop: 4, unlock: 4, d: 'Огонь, помощники, взрывы' },
  giant:   { n: 'Гигант',   cost: 1000, hp: 1000, dmg: 55, range: 74,  speed: 42, cd: 1.5,  spawn: 10,  pop: 6, unlock: 5, d: 'Бьёт всех булавой', scale: 2.3, armor: 0.85 },
  helper:  { n: 'Помощник', cost: 0,    hp: 42,   dmg: 7,  range: 32,  speed: 100, cd: 0.6,  pop: 0, scale: 0.75 },
  zombie:  { n: 'Зомби',    cost: 0,    hp: 48,   dmg: 6,  range: 32,  speed: 44, cd: 0.9,  pop: 0 },
  runner:  { n: 'Бегун',    cost: 0,    hp: 32,   dmg: 5,  range: 32,  speed: 105, cd: 0.6, pop: 0, scale: 0.9 },
  brute:   { n: 'Громила',  cost: 0,    hp: 320,  dmg: 20, range: 44,  speed: 36, cd: 1.3,  pop: 0, scale: 1.6, armor: 0.9 }
};
const UORDER = ['miner', 'club', 'archer', 'sword', 'captain', 'mage', 'giant'];
const RANGED = t => t === 'archer' || t === 'mage';

const LEVELS = [
  { n: 'Булавщики', unit: 'archer', pool: [['club', 1]], inc: 3.2, delay: 5.5, thr: 5, eHp: 1200, reward: 50, world: 2700,
    txt: ['Раса №1 — Булавщики. Грубая сила и деревянные булавы.', 'Копите золото, отправляйте шахтёров в рудник и стройте армию. Победите — и вам откроются Лучники.'] },
  { n: 'Лучники', unit: 'sword', pool: [['club', 2], ['archer', 2]], inc: 4.2, delay: 5, thr: 6, eHp: 1500, reward: 60, world: 2900,
    txt: ['Раса №2 — Лучники. Они осыпают врага стрелами издалека.', 'Подходите быстро или прячьтесь за стенами: в отступлении вас прикроют тайные лучники! После победы — Мечники.'] },
  { n: 'Мечники', unit: 'captain', pool: [['sword', 3], ['club', 1], ['archer', 2]], inc: 5, delay: 4.5, thr: 7, eHp: 1800, reward: 70, world: 3100,
    txt: ['Раса №3 — Мечники. Быстрые воины со щитами.', 'Не давайте им окружить вас. Победа откроет Капитана.'] },
  { n: 'Копейщики', unit: 'mage', pool: [['captain', 3], ['sword', 2], ['archer', 2]], inc: 5.8, delay: 4.2, thr: 8, eHp: 2200, reward: 80, world: 3300,
    txt: ['Раса №4 — Копейщики. Тяжёлая броня и длинные копья.', 'Лучше всего против них — маги и град стрел. Победа откроет Мага.'] },
  { n: 'Маги', unit: 'giant', pool: [['mage', 2], ['captain', 2], ['archer', 2], ['sword', 1]], inc: 7, delay: 3.8, thr: 9, eHp: 2700, reward: 90, world: 3500,
    txt: ['Раса №5 — Маги. Огонь, взрывы и призванные помощники.', 'Убивайте магов первыми! Победа откроет Гиганта.'] },
  { n: 'Гиганты', unit: null, pool: [['giant', 2], ['mage', 2], ['captain', 2], ['archer', 2]], inc: 8.5, delay: 3.4, thr: 10, eHp: 3500, reward: 120, world: 3800, final: true,
    txt: ['Раса №6 — Гиганты. Самая могучая раса мира, из-за которой когда-то никто не мог победить.', 'Разрушьте их статую — и война закончится навсегда.'] }
];
const TOUR = [
  { n: 'Четвертьфинал', pool: [['club', 2], ['archer', 1], ['sword', 1]], inc: 4, delay: 4.6, thr: 5, eHp: 1100 },
  { n: 'Полуфинал',     pool: [['captain', 2], ['sword', 1], ['archer', 2]], inc: 5.6, delay: 4, thr: 6, eHp: 1500 },
  { n: 'ФИНАЛ',         pool: [['giant', 1], ['mage', 2], ['captain', 2], ['archer', 1]], inc: 7.2, delay: 3.4, thr: 7, eHp: 2000 }
];
const SKINS = {
  black:  { n: 'Классика',            perk: {}, d: 'Без бонусов', price: 0 },
  steel:  { n: 'Стальной шлем',       perk: { hp: 0.12 }, d: '+12% здоровья', price: 150 },
  blue:   { n: 'Синий плащ',          perk: { dmg: 0.12 }, d: '+12% урона', price: 200 },
  green:  { n: 'Лесной бегун',        perk: { spd: 0.12 }, d: '+12% скорости', price: 200 },
  gold:   { n: 'Золотой шахтёр',      perk: { gold: 0.25 }, d: '+25% золота с рейса', price: 250 },
  shadow: { n: 'Призрак',             perk: { rng: 0.15, spd: 0.05 }, d: '+15% дальности, +5% скорости', price: 300 },
  royal:  { n: 'Королевская гвардия', perk: { hp: 0.1, dmg: 0.1 }, d: '+10% здоровья и урона', price: 400 }
};
const UPS = {
  statue: { n: 'Крепкая статуя', d: '+350 прочности вашей статуи', ic: '🗿' },
  mine:   { n: 'Добыча золота',  d: '+15% золота за рейс', ic: '⛏️' },
  dmg:    { n: 'Острое оружие',  d: '+8% урона армии', ic: '⚔️' },
  hp:     { n: 'Крепкая броня',  d: '+8% здоровья армии', ic: '🛡️' },
  secret: { n: 'Тайные лучники', d: '+2 лучника в крепости (при отступлении)', ic: '🏹' }
};
const upCost = l => 40 * (l + 1);

/* ============ sound ============ */
let AC = null; const lastSfx = {};
function sfx(k) {
  try {
    const now = performance.now(); if (lastSfx[k] && now - lastSfx[k] < 70) return; lastSfx[k] = now;
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(AC.destination);
    const n = AC.currentTime;
    const m = { hit: [200, .06, 'square', .035], shot: [520, .08, 'triangle', .03], coin: [880, .12, 'sine', .05], boom: [90, .35, 'sawtooth', .07], ui: [440, .07, 'square', .03], win: [660, .5, 'triangle', .06], err: [140, .12, 'square', .04] }[k] || [300, .05, 'square', .02];
    o.type = m[2]; o.frequency.setValueAtTime(m[0], n);
    if (k === 'boom' || k === 'hit') o.frequency.exponentialRampToValueAtTime(40, n + m[1]);
    if (k === 'coin') o.frequency.exponentialRampToValueAtTime(1320, n + m[1]);
    g.gain.setValueAtTime(m[3], n); g.gain.exponentialRampToValueAtTime(0.0001, n + m[1]); o.start(n); o.stop(n + m[1]);
  } catch (e) {}
}

/* ============ DOM helpers ============ */
function h(html, cls, id) { const d = document.createElement('div'); if (cls) d.className = cls; if (id) d.id = id; d.innerHTML = html || ''; return d; }
function btn(text, cls, fn) { const b = document.createElement('button'); b.className = 'btn ' + cls; b.innerHTML = text; b.onclick = () => { sfx('ui'); fn(); }; return b; }
const screens = {};
function addScreen(id, el) { el.classList.add('hidden'); screens[id] = el; ui.appendChild(el); return el; }
function show(id) { for (const k in screens) screens[k].classList.toggle('hidden', k !== id); gemBox.classList.toggle('hidden', !['menu', 'modes', 'levels', 'shop', 'chests'].includes(id)); }
function toast(t) {
  const d = h(t); d.style.cssText = 'position:absolute;left:50%;bottom:120px;transform:translateX(-50%);background:#111;color:#fff;padding:8px 22px;border-radius:20px;font-family:Impact,sans-serif;font-size:24px;letter-spacing:1px;z-index:50;pointer-events:none;border:3px solid #ffd21f';
  ui.appendChild(d); setTimeout(() => d.remove(), 1600);
}
const gemBox = h('', 'gembox'); ui.appendChild(gemBox);
function updGems() { gemBox.textContent = '💎 ' + SAVE.gems; }
function mini(type, skin, w, hgt, s) { const c = document.createElement('canvas'); c.width = w; c.height = hgt; drawStick(c.getContext('2d'), { x: w / 2, y: hgt - 8, s, type, dir: 1, t: 0.3, skin }); return c; }

/* ============ MENU ============ */
const menu = addScreen('menu', h('<div class="title">STICK LEGEND</div><div class="sub">ЛЕГЕНДА СТИКМЕНОВ</div>', 'screen', 'menu'));
{
  const col = h('', 'col');
  col.appendChild(btn('ИГРАТЬ', 'play', () => { buildModes(); show('modes'); }));
  const row = h('', 'row');
  row.appendChild(btn('🛒 МАГАЗИН', 'shop', () => { buildShop(); show('shop'); }));
  row.appendChild(btn('📦 СУНДУКИ', 'chest', () => { buildChests(); show('chests'); }));
  col.appendChild(row); menu.appendChild(col);
}
/* ---- modes ---- */
const modes = addScreen('modes', h('', 'screen'));
function panel(title, backTo) {
  const p = h('', 'panel'); p.appendChild(h('<h2>' + title + '</h2>'));
  const b = btn('◀ Назад', 'dark small back', () => { updGems(); show(backTo); }); p.appendChild(b); return p;
}
function buildModes() {
  modes.innerHTML = ''; const p = panel('Режимы игры', 'menu');
  const g = h('', 'grid'); g.style.cssText = 'grid-template-columns:repeat(4,1fr);align-content:center';
  const defs = [
    ['🎮 Обычный бой', 'Свободная битва против врага. Все воины открыты сразу. Выберите сложность и разрушьте вражескую статую!', openSkirm, 'skirm'],
    ['⚔️ Миссии', 'Пройдите 6 рас. Каждая победа открывает нового воина. Разрушьте статую врага!', () => { buildLevels(); show('levels'); }, 'mission'],
    ['🧟 Зомби', 'Бесконечные волны зомби. Защищайте статую как можно дольше!', startZombie, 'zombie'],
    ['🏆 Турнир', '3 раунда подряд: четвертьфинал, полуфинал и финал. Приз — гемы!', () => startTour(0), 'tour']
  ];
  for (const [t, d, fn, k] of defs) {
    const c = h('<h3 style="font-size:28px">' + t + '</h3>', 'card mode'); c.style.width = 'auto';
    const cc = document.createElement('canvas'); cc.width = 280; cc.height = 150; cc.style.cssText = 'width:100%;height:auto'; const x = cc.getContext('2d');
    x.fillStyle = k === 'zombie' ? '#c6d3b0' : '#e5d9bb'; x.fillRect(0, 0, 280, 150); x.fillStyle = '#b8a77f'; x.fillRect(0, 118, 280, 32); x.strokeStyle = '#111'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 118); x.lineTo(280, 118); x.stroke();
    if (k === 'zombie') { for (let i = 0; i < 4; i++) drawStick(x, { x: 70 + i * 55, y: 135, s: 0.75, type: i % 2 ? 'runner' : 'zombie', zomb: true, dir: -1, t: i }); drawStick(x, { x: 240, y: 135, s: .8, type: 'captain', dir: -1, t: 1 }); }
    else if (k === 'tour') { x.fillStyle = '#ffd21f'; x.strokeStyle = '#111'; x.lineWidth = 4; x.beginPath(); x.moveTo(110, 20); x.lineTo(170, 20); x.lineTo(162, 70); x.quadraticCurveTo(140, 92, 118, 70); x.closePath(); x.fill(); x.stroke(); x.fillRect(128, 84, 24, 20); x.strokeRect(128, 84, 24, 20); x.fillRect(112, 104, 56, 12); x.strokeRect(112, 104, 56, 12); drawStick(x, { x: 50, y: 135, s: .8, type: 'sword', dir: 1, t: 0 }); drawStick(x, { x: 230, y: 135, s: .8, type: 'sword', team: 1, dir: -1, t: 1 }); }
    else if (k === 'skirm') { drawStick(x, { x: 40, y: 135, s: .8, type: 'captain', dir: 1, t: 0 }); drawStick(x, { x: 85, y: 135, s: .8, type: 'archer', dir: 1, t: 1 }); drawStick(x, { x: 150, y: 135, s: .8, type: 'sword', team: 1, dir: -1, t: 2 }); drawStick(x, { x: 195, y: 135, s: .8, type: 'club', team: 1, dir: -1, t: 3 }); }
    else { drawStick(x, { x: 45, y: 135, s: .8, type: 'club', dir: 1, t: 0 }); drawStick(x, { x: 85, y: 135, s: .8, type: 'archer', dir: 1, t: 1 }); drawStick(x, { x: 195, y: 135, s: .8, type: 'club', team: 1, dir: -1, t: 2 }); drawStick(x, { x: 235, y: 135, s: .8, type: 'mage', team: 1, dir: -1, t: 3 }); }
    c.appendChild(cc); c.appendChild(h('<p>' + d + '</p>'));
    if (k === 'zombie') c.appendChild(h('<p><b>Рекорд: волна ' + SAVE.zBest + '</b></p>'));
    if (k === 'tour') c.appendChild(h('<p><b>Побед в турнире: ' + SAVE.tWins + '</b></p>'));
    c.appendChild(btn('ИГРАТЬ', 'dark small', fn)); g.appendChild(c);
  }
  p.appendChild(g); modes.appendChild(p);
}
/* ---- levels ---- */
const levels = addScreen('levels', h('', 'screen'));
function buildLevels() {
  levels.innerHTML = ''; const p = panel('Миссии — расы мира', 'modes');
  p.querySelector('.back').onclick = () => { sfx('ui'); buildModes(); show('modes'); };
  const g = h('', 'grid lvlgrid');
  LEVELS.forEach((L, i) => {
    const lock = i > SAVE.cleared, done = i < SAVE.cleared;
    const c = h('', 'card' + (lock ? ' locked' : ''));
    c.appendChild(h('<span class="tag">УРОВЕНЬ ' + (i + 1) + (done ? ' ✔' : '') + '</span>'));
    const cc = document.createElement('canvas'); cc.width = 200; cc.height = 90; const x = cc.getContext('2d');
    x.fillStyle = '#e5d9bb'; x.fillRect(0, 0, 200, 90); x.fillStyle = '#b8a77f'; x.fillRect(0, 74, 200, 16);
    const t0 = L.pool[0][0]; drawStick(x, { x: 50, y: 80, s: 0.7, type: t0, team: 1, dir: 1, t: 0 }); drawStick(x, { x: 100, y: 80, s: 0.7, type: L.pool[L.pool.length - 1][0], team: 1, dir: 1, t: 1 }); drawStick(x, { x: 150, y: 80, s: L.final ? 0.42 : 0.7, type: L.final ? 'giant' : t0, team: 1, dir: 1, t: 2, helm: L.final });
    c.appendChild(cc); c.appendChild(h('<h3>' + L.n + '</h3>'));
    c.appendChild(h('<p>' + (L.unit ? 'Откроет: <b>' + UNITS[L.unit].n + '</b>' : '<b>ФИНАЛ ИГРЫ</b>') + '<br>Награда: 💎 ' + L.reward + '</p>'));
    if (lock) c.appendChild(h('<p>🔒 Пройдите предыдущий уровень</p>')); else c.appendChild(btn(done ? 'ПОВТОР' : 'В БОЙ', 'dark small', () => startMission(i)));
    g.appendChild(c);
  });
  p.appendChild(g); levels.appendChild(p);
}
/* ---- shop ---- */
const shop = addScreen('shop', h('', 'screen'));
let shopTab = 'skins';
function buildShop() {
  shop.innerHTML = ''; const p = panel('Магазин', 'menu');
  const tabs = h('', 'tabs');
  const t1 = btn('🎭 Скины', 'dark small' + (shopTab === 'skins' ? ' sel' : ''), () => { shopTab = 'skins'; buildShop(); });
  const t2 = btn('⬆️ Прокачка', 'dark small' + (shopTab === 'up' ? ' sel' : ''), () => { shopTab = 'up'; buildShop(); });
  tabs.appendChild(t1); tabs.appendChild(t2); p.appendChild(tabs);
  if (shopTab === 'skins') {
    const g = h('', 'grid skgrid');
    for (const id in SKINS) {
      const S = SKINS[id], own = SAVE.skins.includes(id), eq = SAVE.skin === id;
      const c = h('', 'card' + (eq ? ' equipped' : ''));
      c.appendChild(mini('captain', id, 90, 110, 1)); c.appendChild(h('<h3>' + S.n + '</h3>')); c.appendChild(h('<p>' + S.d + '</p>'));
      if (eq) c.appendChild(h('<p><b>✔ Надето</b></p>'));
      else if (own) c.appendChild(btn('НАДЕТЬ', 'dark small', () => { SAVE.skin = id; persist(); buildShop(); }));
      else c.appendChild(btn('💎 ' + S.price, 'shop small', () => { if (SAVE.gems < S.price) { sfx('err'); toast('Не хватает гемов'); return; } SAVE.gems -= S.price; SAVE.skins.push(id); SAVE.skin = id; persist(); updGems(); sfx('coin'); buildShop(); }));
      g.appendChild(c);
    }
    p.appendChild(g);
  } else {
    const g = h('', 'grid upgrid');
    for (const id in UPS) {
      const U = UPS[id], l = SAVE.up[id], max = l >= 5;
      const c = h('<div style="font-size:44px">' + U.ic + '</div><h3>' + U.n + '</h3><p>' + U.d + '</p>', 'card');
      const b = h('<i style="width:' + (l * 20) + '%"></i>', 'bar'); c.appendChild(b); c.appendChild(h('<p>Уровень ' + l + ' / 5</p>'));
      if (max) c.appendChild(h('<p><b>МАКСИМУМ</b></p>'));
      else c.appendChild(btn('💎 ' + upCost(l), 'shop small', () => { if (SAVE.gems < upCost(l)) { sfx('err'); toast('Не хватает гемов'); return; } SAVE.gems -= upCost(l); SAVE.up[id]++; persist(); updGems(); sfx('coin'); buildShop(); }));
      g.appendChild(c);
    }
    p.appendChild(g);
  }
  shop.appendChild(p);
}
/* ---- chests ---- */
const chests = addScreen('chests', h('', 'screen'));
const CHESTS = [
  { id: 'free', n: 'Бесплатный', price: 0, col: '#9b6a3a', gem: [10, 30], skinP: 0.1 },
  { id: 'wood', n: 'Деревянный', price: 40, col: '#a8743a', gem: [15, 60], skinP: 0.25 },
  { id: 'gold', n: 'Золотой',    price: 120, col: '#e8b800', gem: [60, 180], skinP: 0.5 }
];
function chestIcon(col, w, hh) {
  const c = document.createElement('canvas'); c.width = w; c.height = hh; const x = c.getContext('2d');
  x.strokeStyle = '#111'; x.lineWidth = 5; x.fillStyle = col; x.beginPath(); x.roundRect(14, 46, w - 28, hh - 56, 6); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(14, 50); x.quadraticCurveTo(w / 2, 4, w - 14, 50); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#ffd21f'; x.fillRect(w / 2 - 9, 44, 18, 26); x.strokeRect(w / 2 - 9, 44, 18, 26);
  x.beginPath(); x.moveTo(14, 70); x.lineTo(w - 14, 70); x.stroke(); return c;
}
function buildChests() {
  chests.innerHTML = ''; const p = panel('Сундуки', 'menu'); const g = h('', 'grid chestgrid'); g.style.alignContent = 'center';
  const left = Math.max(0, 300000 - (Date.now() - SAVE.lastFree));
  for (const C of CHESTS) {
    const c = h('', 'card'); c.appendChild(chestIcon(C.col, 180, 130)); c.appendChild(h('<h3 style="font-size:30px">' + C.n + '</h3>'));
    c.appendChild(h('<p>💎 ' + C.gem[0] + '–' + C.gem[1] + ' или редкий скин (' + Math.round(C.skinP * 100) + '%)</p>'));
    if (C.id === 'free') {
      if (left > 0) c.appendChild(h('<p>Откроется через ' + Math.ceil(left / 60000) + ' мин.</p>')); else c.appendChild(btn('ОТКРЫТЬ', 'chest small', () => openChest(C)));
    } else c.appendChild(btn('💎 ' + C.price, 'chest small', () => { if (SAVE.gems < C.price) { sfx('err'); toast('Не хватает гемов'); return; } SAVE.gems -= C.price; updGems(); openChest(C); }));
    g.appendChild(c);
  }
  p.appendChild(g); chests.appendChild(p);
}
function openChest(C) {
  if (C.id === 'free') SAVE.lastFree = Date.now();
  let msg, sub = '';
  const notOwned = Object.keys(SKINS).filter(k => !SAVE.skins.includes(k));
  if (notOwned.length && Math.random() < C.skinP) { const k = notOwned[Math.floor(Math.random() * notOwned.length)]; SAVE.skins.push(k); msg = '🎭 ' + SKINS[k].n; sub = SKINS[k].d; }
  else { const n = Math.round(rand(C.gem[0], C.gem[1])); SAVE.gems += n; msg = '💎 +' + n; }
  persist(); updGems();
  const r = h('', 'reveal'); r.appendChild(chestIcon(C.col, 180, 130)).classList.add('shake');
  r.appendChild(h('Открываем...'));
  ui.appendChild(r); sfx('ui');
  setTimeout(() => { r.innerHTML = ''; r.appendChild(h(msg, 'big')); r.appendChild(h(sub)); r.appendChild(btn('ЗАБРАТЬ', 'chest', () => { r.remove(); buildChests(); })); sfx('win'); }, 1100);
}
/* ---- story / end / pause overlays ---- */
function story(title, paras, label, cb) {
  const s = h('', 'story'); const b = h('<h2>' + title + '</h2>' + paras.map(p => '<p>' + p + '</p>').join(''), 'box');
  const a = h('', 'actions'); a.appendChild(btn(label, 'play', () => { s.remove(); cb && cb(); })); a.lastChild.style.cssText = 'width:300px;height:70px;font-size:36px'; b.appendChild(a); s.appendChild(b); ui.appendChild(s);
}
const endEl = addScreen('end', h('', 'screen'));
endEl.id = 'end';
const pauseEl = addScreen('pause', h('', 'screen'));
{
  pauseEl.style.cssText = 'background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;z-index:22';
  pauseEl.appendChild(h('<span style="font-family:Impact;font-size:80px;color:#fff;letter-spacing:8px">ПАУЗА</span>'));
  pauseEl.appendChild(btn('Продолжить', 'shop', () => setPause(false)));
  pauseEl.appendChild(btn('В меню', 'dark', () => { leaveBattle(); }));
}

/* ============ HUD ============ */
const hud = addScreen('hud', h('', 'screen', 'hud'));
const hudRef = {};
function buildHUD() {
  hud.innerHTML = '';
  hudRef.gold = h('🪙 <span>0</span>', 'chip gold'); hudRef.pop = h('👥 <span>0</span>', 'chip pop'); hudRef.mode = h('', 'chip mode');
  hud.append(hudRef.gold, hudRef.pop, hudRef.mode);
  const tr = h('', 'tr');
  hudRef.pauseB = btn('⏸', '', () => setPause(true)); hudRef.spdB = btn('x1', '', () => { B.speed = B.speed === 1 ? 2 : 1; hudRef.spdB.textContent = 'x' + B.speed; });
  tr.append(hudRef.spdB, hudRef.pauseB); hud.appendChild(tr);
  hudRef.ub = {};
  UORDER.forEach((t, i) => {
    const d = UNITS[t]; const b = h('', 'ubtn'); b.style.left = (10 + i * 86) + 'px'; b.title = d.n + ': ' + d.d;
    b.appendChild(mini(t, null, 56, 60, 0.62)); b.appendChild(h(d.cost, 'cost')); b.appendChild(h(i + 1, 'key'));
    const q = h('', 'q'); q.style.display = 'none'; b.appendChild(q); const pr = h('', 'prog'); b.appendChild(pr);
    const lk = h('🔒<br>Ур.' + d.unlock, 'lk'); lk.style.display = 'none'; b.appendChild(lk);
    b.onpointerdown = (e) => { e.preventDefault(); buy(t); };
    hud.appendChild(b); hudRef.ub[t] = { b, q, pr, lk };
  });
  hudRef.sp = {};
  const SP = [['rain', '🏹', 'Град', '250🪙', 0], ['heal', '💚', 'Лечение', '200🪙', 0], ['rage', '🔥', 'Ярость', '2💎', 1], ['summon', '👥', 'Призыв', '3💎', 1]];
  SP.forEach(([id, ic, nm, pr, gem], i) => {
    const b = h('<div class="ic">' + ic + '</div><div class="nm">' + nm + '</div><div class="pr">' + pr + '</div>', 'sbtn' + (gem ? ' gem' : ''));
    b.style.left = (620 + i * 90) + 'px'; const cd = h('', 'cdm'); b.appendChild(cd); b.onpointerdown = (e) => { e.preventDefault(); cast(id); };
    hud.appendChild(b); hudRef.sp[id] = cd;
  });
  hudRef.st = {};
  [['defend', '🛡️', 'Защита'], ['attack', '⚔️', 'Атака'], ['garrison', '🏰', 'Отступить']].forEach(([id, ic, nm], i) => {
    const b = h('<div class="ic">' + ic + '</div>' + nm, 'stbtn'); b.style.left = (990 + i * 95) + 'px'; b.onpointerdown = (e) => { e.preventDefault(); setStance(id); };
    hud.appendChild(b); hudRef.st[id] = b;
  });
  // scroll buttons
  const l = h('◀', 'scrollhint'); l.style.left = '10px'; l.style.bottom = '112px'; const r = h('▶', 'scrollhint'); r.style.right = '10px'; r.style.bottom = '112px';
  l.onpointerdown = () => keys.left = true; r.onpointerdown = () => keys.right = true;
  hud.append(l, r);
}
function updHUD() {
  if (!B) return;
  hudRef.gold.lastChild.textContent = Math.floor(B.gold); hudRef.pop.lastChild.textContent = popUsed() + '/' + POPCAP;
  hudRef.mode.textContent = B.mode === 'zombie' ? '🧟 Волна ' + B.z.wave + ' · убито ' + B.kills : B.mode === 'skirm' ? '🎮 Бой · ' + ['Лёгкий', 'Средний', 'Сложный'][B.cfg.diff] : B.mode === 'tour' ? '🏆 ' + TOUR[B.cfg.round].n + ' (' + (B.cfg.round + 1) + '/3)' : 'Ур.' + (B.cfg.level + 1) + ' · ' + LEVELS[B.cfg.level].n;
  for (const t of UORDER) {
    const d = UNITS[t], r = hudRef.ub[t], locked = isLocked(d);
    r.lk.style.display = locked ? 'flex' : 'none';
    r.b.classList.toggle('no', !locked && (B.gold < d.cost || popUsed() + d.pop > POPCAP));
    const n = B.queue.filter(q => q === t).length; r.q.style.display = n ? 'block' : 'none'; r.q.textContent = n;
    r.pr.style.width = (B.queue[0] === t ? (1 - B.qt / d.spawn) * 100 : 0) + '%';
  }
  const CD = { rain: 30, heal: 22, rage: 40, summon: 45 };
  for (const id in hudRef.sp) hudRef.sp[id].style.height = (B.cd[id] > 0 ? B.cd[id] / CD[id] * 100 : 0) + '%';
  for (const id in hudRef.st) hudRef.st[id].classList.toggle('act', B.stance === id);
}

/* ============ BATTLE ============ */
let B = null, scene = 'menu', keys = {};
function popUsed() { let n = 0; for (const u of B.units) if (u.team === 0 && !u.dead) n += UNITS[u.type].pop; for (const q of B.queue) n += UNITS[q].pop; return n; }
function note(t) { sfx('err'); toast(t); }

function startMission(i) {
  const L = LEVELS[i];
  const go = () => beginBattle({ mode: 'mission', level: i, world: L.world, gold: 350, pool: L.pool, inc: L.inc, delay: L.delay, thr: L.thr, eHp: L.eHp, egold: 100, epop: 14 + i * 2, emHp: 1 + 0.05 * i, emDmg: 1 + 0.05 * i });
  const first = () => story('Уровень ' + (i + 1) + ': ' + L.n, L.txt, 'В БОЙ!', go);
  if (!SAVE.seenIntro && i === 0) {
    SAVE.seenIntro = true; persist();
    story('Легенда стикменов', ['Давным-давно в мире жило множество рас. Они воевали друг с другом тысячи лет, но ни одна не могла уничтожить остальных — пока не явилась самая могучая раса: Гиганты.', 'Вы — народ, решивший отделиться и стать свободным. Ваша цель — победить расы одну за другой и разрушить главную статую Гигантов.', 'Каждая победа открывает нового воина. Защищайте свою статую и уничтожайте вражескую!'], 'Далее', first);
  } else first();
}
function openSkirm() {
  const s = h('', 'story'); const b = h('<h2>Обычный бой</h2><p>Выберите сложность. Все воины доступны с самого начала.</p>', 'box');
  const a = h('', 'actions'); a.style.cssText = 'display:flex;gap:16px;justify-content:center;flex-wrap:wrap';
  [['ЛЁГКИЙ', 'chest', 0], ['СРЕДНИЙ', 'shop', 1], ['СЛОЖНЫЙ', 'play', 2]].forEach(([t, c, d]) => { const bt = btn(t, c, () => { s.remove(); startSkirm(d); }); bt.style.cssText = 'width:240px;height:70px;font-size:32px'; a.appendChild(bt); });
  const x = btn('Отмена', 'dark small', () => s.remove()); a.appendChild(x); b.appendChild(a); s.appendChild(b); ui.appendChild(s);
}
function startSkirm(d) {
  beginBattle({ mode: 'skirm', diff: d, all: true, world: 3000, gold: 500, pool: [['club', 3], ['sword', 2], ['archer', 2], ['captain', 1.5], ['mage', 1], ['giant', 0.5]],
    inc: [4, 6, 8][d], delay: [5, 4, 3.2][d], thr: [5, 7, 9][d], eHp: [1500, 2500, 3500][d], egold: 300, epop: [16, 22, 28][d], emHp: 1 + 0.15 * d, emDmg: 1 + 0.12 * d });
}
const isLocked = d => !(B && B.cfg.all) && SAVE.cleared < d.unlock;
function startZombie() { beginBattle({ mode: 'zombie', world: 2400, gold: 400 }); }
function startTour(r) { const T = TOUR[r]; beginBattle({ mode: 'tour', round: r, world: 2300, gold: 500, pool: T.pool, inc: T.inc, delay: T.delay, thr: T.thr, eHp: T.eHp, egold: 400, epop: 20, emHp: 1 + r * 0.06, emDmg: 1 + r * 0.05 }); }

function beginBattle(cfg) {
  const up = SAVE.up, sk = SKINS[SAVE.skin].perk, smax = 1500 + up.statue * 350;
  B = { cfg, mode: cfg.mode, world: cfg.world, cam: 0, time: 0, units: [], corpses: [], proj: [], fx: [], texts: [], gold: cfg.gold, queue: [], qt: 0, stance: 'defend', over: null, overT: 0, paused: false, speed: 1, idc: 0,
    rain: null, rageT: 0, cd: { rain: 0, heal: 0, rage: 0, summon: 0 }, kills: 0, shake: 0, secretT: 0, ended: false,
    pm: { hp: (1 + up.hp * 0.08) * (1 + (sk.hp || 0)), dmg: (1 + up.dmg * 0.08) * (1 + (sk.dmg || 0)), spd: 1 + (sk.spd || 0), rng: 1 + (sk.rng || 0), gold: (1 + up.mine * 0.15) * (1 + (sk.gold || 0)) },
    em: { hp: cfg.emHp || 1, dmg: cfg.emDmg || 1, spd: 1, rng: 1 },
    ps: { x: 170, hp: smax, max: smax, flash: 0 }, es: cfg.mode === 'zombie' ? null : { x: cfg.world - 170, hp: cfg.eHp, max: cfg.eHp, flash: 0 }, enemy: null, z: null };
  if (B.es) B.enemy = { gold: cfg.egold, inc: cfg.inc, pool: cfg.pool, delay: cfg.delay, timer: 6, next: null, stance: 'defend', thr: cfg.thr, popCap: cfg.epop };
  if (B.mode === 'zombie') B.z = { wave: 0, queue: [], t: 3, sp: 0 };
  spawnUnit('miner', 0, B.ps.x + 120); spawnUnit('miner', 0, B.ps.x + 160);
  buildHUD(); show('hud'); scene = 'battle'; hudRef.spdB.textContent = 'x1';
  banner(B.mode === 'mission' ? 'Уровень ' + (cfg.level + 1) : B.mode === 'tour' ? TOUR[cfg.round].n : 'Зомби-режим');
  updHUD();
}
function banner(t) { const b = h(t, 'banner'); hud.appendChild(b); setTimeout(() => b.remove(), 2300); }
function leaveBattle() { B = null; scene = 'menu'; pauseEl.classList.add('hidden'); endEl.innerHTML = ''; updGems(); show('menu'); }
function setPause(v) { if (!B || B.over) return; B.paused = v; pauseEl.classList.toggle('hidden', !v); }
function setStance(s) { if (!B || B.over) return; B.stance = s; if (s !== 'garrison') for (const u of B.units) if (u.team === 0) u.hidden = false; sfx('ui'); }

function spawnUnit(type, team, x, extra) {
  const d = UNITS[type], m = team === 0 ? B.pm : B.em, zomb = !!(extra && extra.zomb);
  const hp = d.hp * m.hp * (extra && extra.hpMul || 1);
  const u = { id: ++B.idc, type, team, zomb, x, y: GROUND + rand(-6, 16), dir: team === 0 ? 1 : -1, hp, max: hp, dmg: d.dmg * m.dmg, range: d.range * (RANGED(type) ? m.rng : 1), speed: d.speed * m.spd, s: d.scale || 1, armor: d.armor || 1,
    cd: rand(0, d.cd), atk: -1, t: rand(0, 9), flash: 0, hidden: false, moving: false, state: 'toMine', mt: 0, carry: false, mine: false, sumT: rand(3, 6), blastT: rand(7, 11), skin: team === 0 ? SAVE.skin : null };
  if (extra) Object.assign(u, extra);
  if (type === 'giant' && team === 1 && B.cfg.level === 5) u.helm = true;
  B.units.push(u); return u;
}
function hurt(u, dmg) {
  if (u.dead) return; u.hp -= dmg * u.armor; u.flash = 0.12; sfx('hit');
  if (u.hp <= 0) {
    u.dead = true; B.corpses.push({ x: u.x, y: u.y, type: u.type, team: u.team, zomb: u.zomb, dir: u.dir, s: u.s, t: 0, skin: u.skin, helm: u.helm });
    for (let i = 0; i < 6; i++) B.fx.push({ k: 'dot', x: u.x, y: u.y - 40 * u.s, vx: rand(-90, 90), vy: rand(-200, -40), life: 0.6, col: u.team === 1 ? '#c8201a' : '#222' });
    if (u.team === 1) { B.kills++; const g = u.zomb ? 10 : Math.round(UNITS[u.type].cost * 0.08); if (g) { B.gold += g; B.texts.push({ x: u.x, y: u.y - 90, t: 1, s: '+' + g, c: '#b88a00' }); } }
  }
}
function hurtStatue(team, dmg) { const s = team === 0 ? B.ps : B.es; if (!s || s.hp <= 0) return; s.hp -= dmg; s.flash = 0.1; sfx('hit'); }
function explode(x, y, r, dmg, team) {
  sfx('boom'); B.shake = Math.max(B.shake, r / 20);
  B.fx.push({ k: 'boom', x, y, r, life: 0.45, max: 0.45 });
  for (const e of B.units) if (e.team !== team && !e.dead && !e.hidden && Math.abs(e.x - x) < r + 10 * e.s) hurt(e, dmg);
  const st = team === 0 ? B.es : B.ps; if (st && Math.abs(st.x - x) < r + 40) hurtStatue(team === 0 ? 1 : 0, dmg * 0.6);
}
function arrow(x, y, tx, team, dmg) {
  const dir = Math.sign(tx - x) || 1, D = Math.abs(tx - x), v = 640, g = 900;
  const th = 0.5 * Math.asin(clamp(D * g / (v * v), 0.06, 1));
  B.proj.push({ k: 'arrow', x, y, vx: dir * v * Math.cos(th), vy: -v * Math.sin(th), team, dmg });
  sfx('shot');
}
function nearestEnemy(u, maxd) {
  let best = null, bd = maxd;
  for (const e of B.units) { if (e.team === u.team || e.dead || e.hidden) continue; const d = Math.abs(e.x - u.x); if (d < bd) { bd = d; best = e; } }
  return best;
}
function moveTo(u, tx, spd, dt) {
  const dx = tx - u.x; if (Math.abs(dx) < 3) { u.moving = false; return true; }
  u.dir = dx > 0 ? 1 : -1; u.x += u.dir * Math.min(Math.abs(dx), spd * dt); u.moving = true; return false;
}
function attack(u, tgt, statueTeam) {
  const d = UNITS[u.type]; u.cd = d.cd; u.atk = 0;
  const dmg = u.dmg * (u.team === 0 && B.rageT > 0 ? 1.6 : 1);
  const tx = tgt ? tgt.x : (statueTeam === 1 ? B.es.x : B.ps.x);
  u.dir = tx > u.x ? 1 : -1;
  if (u.type === 'archer') { arrow(u.x + u.dir * 14, u.y - 58, tx, u.team, dmg); return; }
  if (u.type === 'mage') { B.proj.push({ k: 'fire', x: u.x + u.dir * 20, y: u.y - 90 * u.s, tx, ty: GROUND - 20, team: u.team, dmg, vx: 0 }); sfx('shot'); return; }
  if (u.type === 'giant') {
    B.shake = Math.max(B.shake, 5);
    if (tgt) { for (const e of B.units) if (e.team !== u.team && !e.dead && !e.hidden && Math.abs(e.x - tgt.x) < 80) hurt(e, dmg); }
    else hurtStatue(statueTeam, dmg * 2.2);
    B.fx.push({ k: 'ring', x: tx, y: GROUND, life: 0.35, max: 0.35 }); return;
  }
  if (tgt) hurt(tgt, dmg); else hurtStatue(statueTeam, dmg);
  B.fx.push({ k: 'dot', x: tx, y: u.y - 45, vx: u.dir * 60, vy: -80, life: 0.25, col: '#ffd21f' });
}

function updateMiner(u, dt) {
  const mineX = B.ps.x + 340 + (u.id % 3) * 16 - 16, dropX = B.ps.x + 70;
  u.mine = false;
  if (u.state === 'toMine') { if (moveTo(u, mineX, u.speed, dt)) { u.state = 'mine'; u.mt = 1.4; u.dir = 1; } }
  else if (u.state === 'mine') { u.mine = true; u.moving = false; u.dir = 1; u.mt -= dt; if (u.mt <= 0) { u.state = 'toBase'; u.carry = true; } }
  else if (moveTo(u, dropX, u.speed, dt)) {
    const g = Math.round(14 * B.pm.gold); B.gold += g; u.carry = false; u.state = 'toMine'; sfx('coin');
    B.texts.push({ x: u.x, y: u.y - 90, t: 1, s: '+' + g, c: '#b88a00' });
  }
}
function updateUnit(u, dt) {
  u.t += dt; u.flash = Math.max(0, u.flash - dt); u.cd -= dt;
  if (u.atk >= 0) { u.atk += dt / 0.35; if (u.atk >= 1) u.atk = -1; }
  if (u.life !== undefined) { u.life -= dt; if (u.life <= 0) { u.dead = true; return; } }
  if (u.hidden) return;
  const d = UNITS[u.type], spd = u.speed * (u.team === 0 && B.rageT > 0 ? 1.25 : 1);
  if (u.type === 'miner' && u.team === 0) return updateMiner(u, dt);
  u.moving = false;
  const own = u.team === 0 ? B.ps : B.es, foe = u.team === 0 ? B.es : B.ps;
  const aggro = u.zomb || u.life !== undefined;
  const stance = u.team === 0 ? (aggro ? 'attack' : B.stance) : (aggro ? 'attack' : B.enemy.stance);
  if (stance === 'garrison') {
    if (u.atk < 0) { const hx = own.x + 60 + (u.id % 5) * 12; if (Math.abs(u.x - hx) > 6) moveTo(u, hx, spd * 1.1, dt); else u.hidden = true; }
    return;
  }
  const sight = RANGED(u.type) ? u.range + 20 : 270;
  let tgt = nearestEnemy(u, stance === 'attack' ? sight + 150 : sight);
  if (tgt && u.team === 0 && stance === 'defend' && Math.abs(tgt.x - own.x) > 760) tgt = null;
  if (u.type === 'mage' && u.team === 1 && !tgt) { /* enemy mages hold with army */ }
  // mage extras
  if (u.type === 'mage' && tgt) {
    u.sumT -= dt; u.blastT -= dt;
    if (u.sumT <= 0) { u.sumT = 10; for (let i = 0; i < 2; i++) spawnUnit('helper', u.team, u.x + u.dir * (24 + i * 18), { life: 20, hpMul: 1 }); B.fx.push({ k: 'ring', x: u.x, y: GROUND, life: 0.4, max: 0.4 }); }
    if (u.blastT <= 0 && Math.abs(tgt.x - u.x) < u.range) { u.blastT = 13; u.atk = 0; u.dir = tgt.x > u.x ? 1 : -1; explode(tgt.x, GROUND - 30, 140, u.dmg * 2.2, u.team); }
  }
  if (tgt) {
    const dist = Math.abs(tgt.x - u.x);
    if (dist <= u.range) { u.dir = tgt.x > u.x ? 1 : -1; if (u.cd <= 0) attack(u, tgt); }
    else moveTo(u, tgt.x - Math.sign(tgt.x - u.x) * (u.range * 0.85), spd, dt);
    return;
  }
  // no unit target
  if (stance === 'attack') {
    if (!foe) { moveTo(u, own.x, spd, dt); return; }
    const sd = Math.abs(foe.x - u.x);
    if (sd <= u.range + 55) { u.dir = foe.x > u.x ? 1 : -1; if (u.cd <= 0) attack(u, null, u.team === 0 ? 1 : 0); }
    else moveTo(u, foe.x, spd, dt);
  } else {
    const hx = u.team === 0 ? own.x + 300 + (u.id % 7) * 20 : own.x - 300 - (u.id % 7) * 20;
    moveTo(u, hx, spd, dt);
    if (!u.moving) u.dir = u.team === 0 ? 1 : -1;
  }
}

function enemyAI(dt) {
  const e = B.enemy; if (!e || B.over) return;
  e.gold += e.inc * dt; e.timer -= dt;
  let cnt = 0, pop = 0;
  for (const u of B.units) if (u.team === 1 && !u.dead && u.life === undefined) { cnt++; pop += UNITS[u.type].pop; }
  if (!e.next) { const tot = e.pool.reduce((a, p) => a + p[1], 0); let r = Math.random() * tot; for (const p of e.pool) { r -= p[1]; if (r <= 0) { e.next = p[0]; break; } } e.next = e.next || e.pool[0][0]; }
  const d = UNITS[e.next];
  if (e.timer <= 0 && e.gold >= d.cost && pop + d.pop <= e.popCap) { e.gold -= d.cost; spawnUnit(e.next, 1, B.es.x - 60); e.next = null; e.timer = e.delay * rand(0.8, 1.2); }
  if (e.stance === 'defend' && cnt >= e.thr) e.stance = 'attack';
  else if (e.stance === 'attack' && cnt <= Math.floor(e.thr / 3)) e.stance = 'defend';
}
function zombieAI(dt) {
  const z = B.z; if (!z || B.over) return;
  const alive = B.units.some(u => u.team === 1 && !u.dead);
  if (!z.queue.length && !alive) {
    z.t -= dt;
    if (z.t <= 0) {
      z.wave++; const w = z.wave; const q = [];
      for (let i = 0; i < 5 + 2 * w; i++) q.push('zombie');
      if (w >= 3) for (let i = 0; i < Math.floor(w / 2); i++) q.push('runner');
      if (w >= 4) for (let i = 0; i < Math.floor(w / 4); i++) q.push('brute');
      q.sort(() => Math.random() - 0.5); z.queue = q; z.t = 4; B.em.hp = 1 + w * 0.06; B.em.dmg = 1 + w * 0.04;
      banner('Волна ' + w); B.gold += 60; sfx('boom');
    }
  } else if (z.queue.length) {
    z.sp -= dt; if (z.sp <= 0) { z.sp = Math.max(0.25, 0.9 - z.wave * 0.03); spawnUnit(z.queue.shift(), 1, B.world - 40, { zomb: true }); }
  }
}

function buy(type) {
  if (!B || B.over || B.paused) return; const d = UNITS[type];
  if (isLocked(d)) return note('Откроется после уровня ' + d.unlock);
  if (B.gold < d.cost) return note('Не хватает золота');
  if (popUsed() + d.pop > POPCAP) return note('Лимит армии');
  if (B.queue.length >= 6) return note('Очередь полна');
  B.gold -= d.cost; B.queue.push(type); if (B.queue.length === 1) B.qt = d.spawn; sfx('ui');
}
function cast(id) {
  if (!B || B.over || B.paused) return;
  if (B.cd[id] > 0) return note('Перезарядка');
  const goldCost = { rain: 250, heal: 200 }[id], gemCost = { rage: 2, summon: 3 }[id];
  if (goldCost && B.gold < goldCost) return note('Не хватает золота');
  if (gemCost && SAVE.gems < gemCost) return note('Не хватает гемов');
  if (goldCost) B.gold -= goldCost; if (gemCost) { SAVE.gems -= gemCost; persist(); }
  if (id === 'rain') {
    let cx = B.cam + W / 2, best = 1e9;
    for (const u of B.units) if (u.team === 1 && !u.dead && Math.abs(u.x - B.ps.x) < best) { best = Math.abs(u.x - B.ps.x); cx = u.x; }
    B.rain = { t: 6, cx, acc: 0 }; B.cd.rain = 30;
  } else if (id === 'heal') {
    for (const u of B.units) if (u.team === 0 && !u.dead) { u.hp = Math.min(u.max, u.hp + u.max * 0.45); B.fx.push({ k: 'plus', x: u.x, y: u.y - 70, life: 0.9, max: 0.9 }); }
    B.ps.hp = Math.min(B.ps.max, B.ps.hp + B.ps.max * 0.1); B.cd.heal = 22; sfx('win');
  } else if (id === 'rage') { B.rageT = 12; B.cd.rage = 40; sfx('boom'); }
  else if (id === 'summon') { for (let i = 0; i < 4; i++) spawnUnit('helper', 0, B.ps.x + 90 + i * 20, { life: 25 }); B.cd.summon = 45; sfx('boom'); }
}

function endBattle(res) {
  B.over = res; B.overT = 0; B.shake = 12;
  const st = res === 'win' ? B.es : B.ps;
  for (let i = 0; i < 40; i++) B.fx.push({ k: 'dot', x: st.x + rand(-50, 50), y: GROUND - rand(10, 200), vx: rand(-220, 220), vy: rand(-400, -50), life: rand(0.8, 1.6), col: res === 'win' ? '#7a2a26' : '#555', big: true });
  if (res === 'win') for (const u of B.units) if (u.team === 1 && !u.dead) hurt(u, 1e9);
  sfx('boom');
}
function finishBattle() {
  if (B.ended) return; B.ended = true;
  const res = B.over, cfg = B.cfg; let title = '', lines = [], acts = [];
  if (cfg.mode === 'mission') {
    const L = LEVELS[cfg.level];
    if (res === 'win') {
      const first = SAVE.cleared <= cfg.level; const gems = first ? L.reward : Math.round(L.reward / 4);
      SAVE.gems += gems + Math.min(B.kills, 30); if (first) SAVE.cleared = cfg.level + 1; persist();
      if (L.final && first) { setTimeout(() => { leaveBattle(); startEnding(); }, 100); return; }
      title = 'ПОБЕДА!'; lines = ['Награда: 💎 ' + (gems + Math.min(B.kills, 30)), first && L.unit ? '🆕 Открыт новый воин: <b>' + UNITS[L.unit].n + '</b>!' : ''];
      if (cfg.level + 1 < LEVELS.length) acts.push(['СЛЕДУЮЩИЙ УРОВЕНЬ', 'shop', () => { leaveBattle(); startMission(cfg.level + 1); }]);
      else acts.push(['ЕЩЁ РАЗ', 'shop', () => { leaveBattle(); startMission(cfg.level); }]);
    } else { title = 'ПОРАЖЕНИЕ'; lines = ['Ваша статуя разрушена...']; acts.push(['ЕЩЁ РАЗ', 'shop', () => { leaveBattle(); startMission(cfg.level); }]); }
  } else if (cfg.mode === 'skirm') {
    if (res === 'win') { const g = [30, 50, 80][cfg.diff]; SAVE.gems += g; persist(); title = 'ПОБЕДА!'; lines = ['Вражеская статуя разрушена', 'Награда: 💎 ' + g]; }
    else { title = 'ПОРАЖЕНИЕ'; lines = ['Ваша статуя разрушена...']; }
    acts.push(['ЕЩЁ РАЗ', 'shop', () => { leaveBattle(); startSkirm(cfg.diff); }]);
  } else if (cfg.mode === 'zombie') {
    const w = Math.max(0, B.z.wave - 1), gems = w * 4; SAVE.gems += gems; if (w > SAVE.zBest) SAVE.zBest = w; persist();
    title = 'ВЫ ПРОДЕРЖАЛИСЬ'; lines = ['Пережито волн: <b>' + w + '</b> (рекорд ' + SAVE.zBest + ')', 'Убито зомби: ' + B.kills, 'Награда: 💎 ' + gems]; acts.push(['ЕЩЁ РАЗ', 'shop', () => { leaveBattle(); startZombie(); }]);
  } else {
    if (res === 'win') {
      if (cfg.round < 2) { title = 'РАУНД ВЫИГРАН!'; lines = ['Следующий соперник ждёт...']; acts.push(['СЛЕДУЮЩИЙ РАУНД', 'shop', () => { leaveBattle(); startTour(cfg.round + 1); }]); }
      else { SAVE.gems += 100; SAVE.tWins++; persist(); title = 'ЧЕМПИОН ТУРНИРА!'; lines = ['Награда: 💎 100', 'Побед в турнире: ' + SAVE.tWins]; acts.push(['ЕЩЁ РАЗ', 'shop', () => { leaveBattle(); startTour(0); }]); }
    } else { title = 'ВЫ ВЫБЫЛИ'; lines = ['Турнир окончен']; acts.push(['ЗАНОВО', 'shop', () => { leaveBattle(); startTour(0); }]); }
  }
  if (res === 'win') sfx('win');
  endEl.innerHTML = ''; const box = h('<h1 class="' + (res === 'win' ? 'win' : 'lose') + '">' + title + '</h1>' + lines.filter(Boolean).map(l => '<p>' + l + '</p>').join(''), 'box');
  const a = h('', 'acts'); for (const [t, c, f] of acts) a.appendChild(btn(t, c + ' small', f)); a.appendChild(btn('В МЕНЮ', 'dark small', leaveBattle)); box.appendChild(a); endEl.appendChild(box); show('end');
  hud.classList.remove('hidden');
}

function updateBattle(dt) {
  B.time += dt;
  if (!B.over) {
    if (B.queue.length) { B.qt -= dt; if (B.qt <= 0) { const t = B.queue.shift(); spawnUnit(t, 0, B.ps.x + 70); B.qt = B.queue.length ? UNITS[B.queue[0]].spawn : 0; } }
    for (const k in B.cd) if (B.cd[k] > 0) B.cd[k] -= dt;
    if (B.rageT > 0) B.rageT -= dt;
    enemyAI(dt); zombieAI(dt);
    // rain spell
    if (B.rain) { B.rain.t -= dt; B.rain.acc += dt; while (B.rain.acc > 0.06) { B.rain.acc -= 0.06; B.proj.push({ k: 'arrow', x: B.rain.cx + rand(-280, 280), y: -30, vx: 0, vy: 650, team: 0, dmg: 7 * B.pm.dmg }); } if (B.rain.t <= 0) B.rain = null; }
    // secret archers
    if (B.stance === 'garrison' && B.es || (B.stance === 'garrison' && B.z)) {
      B.secretT -= dt;
      if (B.secretT <= 0) {
        const e = nearestEnemy({ x: B.ps.x, team: 0 }, 600);
        if (e) { B.secretT = 1; const n = 3 + SAVE.up.secret * 2; for (let i = 0; i < n; i++) arrow(B.ps.x + (i - n / 2) * 18 + 10, GROUND - 76, e.x + rand(-20, 20), 0, 9 * B.pm.dmg); }
      }
    }
    for (const u of B.units) if (!u.dead) updateUnit(u, dt);
    // camera
    const sp = 900 * dt;
    if (keys.left) B.cam -= sp; if (keys.right) B.cam += sp;
    if (mouseX >= 0 && !dragging) { if (mouseX < 40) B.cam -= sp * 0.7; else if (mouseX > W - 40) B.cam += sp * 0.7; }
    if (B.es && B.es.hp <= 0) endBattle('win'); else if (B.ps.hp <= 0) endBattle('lose');
  } else { B.overT += dt; if (B.overT > 2.6) finishBattle(); }
  B.cam = clamp(B.cam, 0, B.world - W);
  B.units = B.units.filter(u => !u.dead);
  // projectiles
  for (const p of B.proj) {
    if (p.k === 'arrow') {
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.ang = Math.atan2(p.vy, p.vx);
      for (const e of B.units) if (e.team !== p.team && !e.dead && !e.hidden && Math.abs(e.x - p.x) < 12 * Math.max(1, e.s * 0.8) && p.y > e.y - 90 * e.s && p.y < e.y + 10) { hurt(e, p.dmg); p.dead = true; break; }
      const st = p.team === 0 ? B.es : B.ps;
      if (!p.dead && st && Math.abs(st.x - p.x) < 50 && p.y > GROUND - 240 && p.y < GROUND + 8) { hurtStatue(p.team === 0 ? 1 : 0, p.dmg * 0.6); p.dead = true; }
      if (p.y > GROUND + 14) p.dead = true;
    } else {
      const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy), st = 420 * dt;
      if (dist <= st) { explode(p.tx, GROUND - 20, 90, p.dmg, p.team); p.dead = true; }
      else { p.x += dx / dist * st; p.y += dy / dist * st; if (Math.random() < 0.6) B.fx.push({ k: 'dot', x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3, col: '#ff8a00' }); }
    }
  }
  B.proj = B.proj.filter(p => !p.dead && p.x > -200 && p.x < B.world + 200);
  for (const c of B.corpses) c.t += dt; B.corpses = B.corpses.filter(c => c.t < 1.9);
  for (const f of B.fx) { f.life -= dt; if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 600 * dt; } }
  B.fx = B.fx.filter(f => f.life > 0);
  for (const t of B.texts) { t.t -= dt; t.y -= 30 * dt; } B.texts = B.texts.filter(t => t.t > 0);
  B.ps.flash = Math.max(0, B.ps.flash - dt); if (B.es) B.es.flash = Math.max(0, B.es.flash - dt);
  B.shake = Math.max(0, B.shake - dt * 14);
}

/* ---- battle rendering ---- */
function drawBattle() {
  const c = ctx, cam = B.cam, themes = [null, { sky0: '#d9e4ea', sky1: '#f3ead6', far: '#c9d2d8', mid: '#d6c9a8', ground: '#d2c49f', line: '#111' }, { sky0: '#e6d9cf', sky1: '#f3e2c4', far: '#d0c2c0', mid: '#d8c4a6', ground: '#cdb68f', line: '#111' }, { sky0: '#dad6e6', sky1: '#efe2d4', far: '#c4c0d2', mid: '#d3c3b0', ground: '#c9b895', line: '#111' }, { sky0: '#d6cfc6', sky1: '#e8d9c0', far: '#bdb2a8', mid: '#cdb99a', ground: '#c1ab84', line: '#111' }, { sky0: '#d2d0e8', sky1: '#e9dccc', far: '#bcb8d4', mid: '#cdbfae', ground: '#c3b392', line: '#111' }, { sky0: '#cfc2c2', sky1: '#e6cfbd', far: '#b8a6a6', mid: '#c9b09b', ground: '#bda583', line: '#111' }];
  const th = B.mode === 'zombie' ? { sky0: '#bccab6', sky1: '#e3e4c6', far: '#a9bba4', mid: '#bfc29a', ground: '#b7b389', line: '#111' } : themes[Math.min(6, (B.cfg.level != null ? B.cfg.level : B.cfg.round != null ? B.cfg.round * 2 : (B.cfg.diff || 0) * 2 + 1) + 1)];
  drawBG(c, cam, B.time, th);
  c.save();
  if (B.shake > 0.2) c.translate(rand(-B.shake, B.shake), rand(-B.shake, B.shake) * 0.6);
  c.translate(-cam, 0);
  drawMine(c, B.ps.x + 340, B.time, 0);
  if (B.es) { drawMine(c, B.es.x - 340, B.time, 1); for (let i = 0; i < 3; i++) drawStick(c, { x: B.es.x - 340 + (i - 1) * 24, y: GROUND + 4, s: 1, type: 'miner', team: 1, dir: -1, mine: true, t: B.time + i * 0.4 }); }
  drawCastle(c, B.ps.x, B.stance === 'garrison', B.time);
  if (B.ps.hp > 0 || B.over !== 'lose') drawStatue(c, B.ps.x, 0, B.ps.hp / B.ps.max, { shake: B.ps.flash > 0 });
  if (B.es && (B.es.hp > 0 || B.over !== 'win')) drawStatue(c, B.es.x, 1, B.es.hp / B.es.max, { shake: B.es.flash > 0, big: !!(B.cfg.level === 5) });
  if (B.over === 'win' && B.es) { c.fillStyle = '#7a2a26'; c.strokeStyle = '#111'; c.lineWidth = 4; c.beginPath(); c.moveTo(B.es.x - 70, GROUND); c.lineTo(B.es.x - 40, GROUND - 24); c.lineTo(B.es.x + 10, GROUND - 14); c.lineTo(B.es.x + 60, GROUND - 28); c.lineTo(B.es.x + 80, GROUND); c.closePath(); c.fill(); c.stroke(); }
  const list = [];
  for (const u of B.units) if (!u.hidden && u.x > cam - 150 && u.x < cam + W + 150) list.push(u);
  for (const k of B.corpses) list.push(k);
  list.sort((a, b) => a.y - b.y);
  for (const u of list) {
    if (u.t !== undefined && u.hp === undefined) { // corpse
      const k = Math.min(1, u.t * 3.2);
      drawStick(c, { x: u.x, y: u.y, s: u.s, type: u.type, team: u.team, zomb: u.zomb, dir: u.dir, rot: -u.dir * 1.45 * k, t: 0, alpha: 1 - Math.max(0, u.t - 1.1) / 0.8, skin: u.skin, helm: u.helm });
    } else {
      drawStick(c, { x: u.x, y: u.y, s: u.s, type: u.type, team: u.team, zomb: u.zomb, dir: u.dir, t: u.t, moving: u.moving, atk: u.atk, flash: u.flash, mine: u.mine, carry: u.carry, skin: u.skin, helm: u.helm, lw: u.s > 1.5 ? 4.6 : 4.4 });
      drawHp(c, u.x, u.y - 98 * u.s, 30 + 12 * u.s, u.hp / u.max, u.team === 1);
      if (u.team === 0 && B.rageT > 0 && u.type !== 'miner') { c.fillStyle = 'rgba(255,60,0,.8)'; c.fillRect(u.x - 3, u.y - 108 * u.s, 6, 6); }
    }
  }
  for (const p of B.proj) {
    if (p.k === 'arrow') { c.save(); c.translate(p.x, p.y); c.rotate(p.ang || 0); c.strokeStyle = p.team === 1 ? '#7a1410' : '#111'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-16, 0); c.lineTo(6, 0); c.stroke(); c.beginPath(); c.moveTo(6, -3); c.lineTo(11, 0); c.lineTo(6, 3); c.fillStyle = c.strokeStyle; c.fill(); c.restore(); }
    else { c.fillStyle = p.team === 1 ? '#ff7a00' : '#8a5cff'; c.shadowColor = c.fillStyle; c.shadowBlur = 16; c.beginPath(); c.arc(p.x, p.y, 9, 0, 7); c.fill(); c.shadowBlur = 0; }
  }
  for (const f of B.fx) {
    if (f.k === 'boom') { const k = 1 - f.life / f.max; c.fillStyle = 'rgba(255,' + Math.round(180 - k * 120) + ',30,' + (1 - k) * 0.85 + ')'; c.beginPath(); c.arc(f.x, f.y, f.r * (0.4 + k * 0.7), 0, 7); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 3; c.stroke(); }
    else if (f.k === 'ring') { const k = 1 - f.life / f.max; c.strokeStyle = 'rgba(0,0,0,' + (1 - k) + ')'; c.lineWidth = 5; c.beginPath(); c.ellipse(f.x, f.y + 4, 20 + k * 90, 6 + k * 14, 0, 0, 7); c.stroke(); }
    else if (f.k === 'plus') { c.fillStyle = 'rgba(40,200,70,' + f.life / f.max + ')'; c.font = 'bold 28px Impact'; c.fillText('+', f.x - 8, f.y - (1 - f.life / f.max) * 40); }
    else { c.fillStyle = f.col; c.globalAlpha = clamp(f.life * 2, 0, 1); c.fillRect(f.x, f.y, f.big ? 8 : 4, f.big ? 8 : 4); c.globalAlpha = 1; }
  }
  c.font = 'bold 26px Impact, sans-serif'; c.textAlign = 'center';
  for (const t of B.texts) { c.globalAlpha = clamp(t.t * 2, 0, 1); c.lineWidth = 4; c.strokeStyle = '#fff'; c.strokeText(t.s, t.x, t.y); c.fillStyle = t.c; c.fillText(t.s, t.x, t.y); } c.globalAlpha = 1;
  c.restore();
  // minimap
  const mx = 330, mw = 520, my = 10;
  c.fillStyle = 'rgba(17,17,17,.75)'; c.fillRect(mx, my, mw, 26); c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeRect(mx, my, mw, 26);
  const sx = x => mx + x / B.world * mw;
  c.fillStyle = '#4cd964'; c.fillRect(sx(B.ps.x) - 4, my + 6, 8, 14); if (B.es) { c.fillStyle = '#ff4a3a'; c.fillRect(sx(B.es.x) - 4, my + 6, 8, 14); }
  for (const u of B.units) { if (u.hidden) continue; c.fillStyle = u.team === 1 ? '#ff4a3a' : '#fff'; c.fillRect(sx(u.x) - 1.5, my + 10, 3, 6); }
  c.strokeStyle = '#ffd21f'; c.lineWidth = 2; c.strokeRect(sx(B.cam), my + 2, W / B.world * mw, 22);
  if (B.stance === 'garrison') { c.fillStyle = '#fff'; c.font = 'bold 22px Impact'; c.textAlign = 'center'; c.fillText('🏰 ТАЙНЫЕ ЛУЧНИКИ ГОТОВЫ', W / 2, 62); }
}

/* ============ ENDING ============ */
let endT = 0;
function startEnding() {
  scene = 'ending'; endT = 0; show('none'); $('#sub') && $('#sub').remove();
  const s = h('', '', 'sub'); ui.appendChild(s); $('#theend') && $('#theend').remove();
}
function finishEnding() {
  scene = 'idle'; $('#sub') && $('#sub').remove();
  if (!SAVE.ending) { SAVE.ending = true; SAVE.gems += 300; persist(); }
  const e = h('<h1>КОНЕЦ</h1><p>Гигант повержен. Мир свободен.</p><p style="color:#fff;font-size:22px">Награда: 💎 300 · Все воины открыты!</p>', '', 'theend');
  e.appendChild(btn('В МЕНЮ', 'shop', () => { e.remove(); scene = 'menu'; updGems(); show('menu'); }));
  ui.appendChild(e);
}

/* ============ input ============ */
let mouseX = -1, dragging = false, dragX = 0;
addEventListener('keydown', e => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true; if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (!B) return;
  const m = /^Digit(\d)$/.exec(e.code); if (m) { const t = UORDER[+m[1] - 1]; if (t) buy(t); }
  if (e.code === 'KeyQ') cast('rain'); if (e.code === 'KeyW') cast('heal'); if (e.code === 'KeyE') cast('rage'); if (e.code === 'KeyR') cast('summon');
  if (e.code === 'KeyZ') setStance('defend'); if (e.code === 'KeyX') setStance('attack'); if (e.code === 'KeyC') setStance('garrison');
  if (e.code === 'Space') { e.preventDefault(); setPause(!B.paused); }
});
addEventListener('keyup', e => { if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false; if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false; });
addEventListener('pointerup', () => { keys.left = keys.right = false; dragging = false; });
cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouseX = (e.clientX - r.left) / r.width * W; if (dragging && B) B.cam -= (e.clientX - dragX) * W / r.width; dragX = e.clientX; });
cv.addEventListener('pointerleave', () => { mouseX = -1; });
cv.addEventListener('pointerdown', e => { dragging = true; dragX = e.clientX; });
function fit() { const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')'; }
addEventListener('resize', fit); fit();

/* ============ main loop ============ */
let last = performance.now(), menuT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (scene === 'battle' && B) {
    if (!B.paused) { const n = B.speed; for (let i = 0; i < n; i++) updateBattle(dt); }
    drawBattle(); updHUD();
  } else if (scene === 'ending') {
    endT += dt; drawEnding(ctx, endT); const s = $('#sub'); if (s) s.textContent = endSub(endT); if (endT > END_LEN) finishEnding();
  } else if (scene === 'menu') { menuT += dt; drawCover(ctx, menuT); }
  requestAnimationFrame(frame);
}
updGems(); show('menu'); requestAnimationFrame(frame);
window.__game = { startSkirm, get B() { return B; }, SAVE, startMission, startZombie, startTour, startEnding, buy, cast, setStance, updateBattle, LEVELS, UNITS };
})();
