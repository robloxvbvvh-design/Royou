// Страница «Лист моделей»: показывает все модели игры в виде превью.
import * as THREE from 'three';
import { mapThumbnail } from './world.js';
import { createRenderer, renderThumb as rt } from './stage.js';
import { MAPS, SKINS, WEAPONS, WEAPON_SKINS, PETS, STICKERS } from './data.js';
import { buildCharacter, attachWeapon, updateRig } from './models/characters.js';
import { buildWeapon } from './models/weapons.js';
import { buildCoin, buildCoinStack, buildGem, buildCrown, buildGift, buildTrophy, buildPodium, buildScroll, buildFlag, buildMedkit, buildAmmoBox, buildPet, stickerCanvas } from './models/props.js';

const renderThumb = (r, o, opts) => ({ url: rt(r, o, opts), w: opts.w, h: opts.h });
const canvas = document.createElement('canvas');
const renderer = createRenderer(canvas, { shadows: false });
const out = document.getElementById('out');

function section(title) {
  const s = document.createElement('section'); s.innerHTML = `<h2>${title}</h2><div class="grid"></div>`; out.appendChild(s);
  return s.querySelector('.grid');
}
function card(grid, imgs, name, sub) {
  const c = document.createElement('div'); c.className = 'card';
  const p = document.createElement('div'); p.className = 'pair';
  imgs.forEach(u => { const i = new Image(); i.src = u.url; const k = (imgs.length > 1 ? 190 : Math.min(250, u.w)) / u.w; i.width = u.w * k; i.height = u.h * k; p.appendChild(i); });
  c.appendChild(p); c.insertAdjacentHTML('beforeend', `<b>${name}</b>${sub ? `<small>${sub}</small>` : ''}`);
  grid.appendChild(c);
}

// 1. Скины персонажей (спереди и сзади)
let g = section('Модельки персонажей (Скины)');
for (const s of SKINS) {
  const mk = () => { const r = buildCharacter(s.id); updateRig(r, 0.016, {}); return r.root; };
  card(g, [
    renderThumb(renderer, mk(), { w: 380, h: 500, yaw: Math.PI + 0.45, pitch: 0.08, fit: 1.12 }),
    renderThumb(renderer, mk(), { w: 380, h: 500, yaw: -0.45, pitch: 0.08, fit: 1.12 }),
  ], s.name + ' скин', s.price ? s.price + ' монет' : 'бесплатно');
}

// 2. Персонажи с оружием
g = section('Персонажи с оружием (поза стрельбы)');
for (const [i, s] of SKINS.entries()) {
  const r = buildCharacter(s.id); const w = WEAPONS[[2, 0, 3, 1, 4, 2, 0][i]];
  attachWeapon(r, buildWeapon(w.id, ['regular', 'neon', 'gold', 'ice', 'demonic', 'neon', 'gold'][i]));
  updateRig(r, 0.016, { holding: true, pitch: 0.05 });
  card(g, [renderThumb(renderer, r.root, { w: 380, h: 500, yaw: -Math.PI / 2 - 0.4, pitch: 0.1, fit: 1.05 })], s.name, w.name);
}

// 3. Оружие
g = section('5 Оружий');
for (const w of WEAPONS) {
  const o = buildWeapon(w.id, 'regular');
  card(g, [renderThumb(renderer, o, { w: 330, h: 210, yaw: -Math.PI / 2 + 0.35, pitch: 0.12, fit: 1.1 })], w.short || w.name, w.price ? w.price + ' монет' : 'бесплатно');
}

// 4. Скины оружия
g = section('Примеры скинов для оружия');
for (const k of WEAPON_SKINS) {
  const o = buildWeapon('rifle', k.id);
  card(g, [renderThumb(renderer, o, { w: 330, h: 210, yaw: -Math.PI / 2 + 0.35, pitch: 0.12, fit: 1.1 })], k.name, k.price ? k.price + ' монет' : 'бесплатно');
}
g = section('Скины оружия на всех моделях');
for (const w of WEAPONS) for (const k of ['neon', 'gold', 'ice', 'demonic']) {
  const o = buildWeapon(w.id, k);
  card(g, [renderThumb(renderer, o, { w: 250, h: 160, yaw: -Math.PI / 2 + 0.35, pitch: 0.12, fit: 1.1 })], (w.short || w.name), WEAPON_SKINS.find(x => x.id === k).name);
}

// 5. Предметы
g = section('Игровая валюта и предметы');
[['Монеты', buildCoin()], ['Стопка монет', buildCoinStack()], ['Робуксы (премиум)', buildGem()], ['Корона', buildCrown()], ['Подарок', buildGift()],
 ['Достижения', buildTrophy()], ['Таблица лидеров', buildPodium()], ['Квесты', buildScroll()], ['Флаг синих', buildFlag('#3d8bff')], ['Флаг красных', buildFlag('#ff4d6d')],
 ['Аптечка', buildMedkit()], ['Патроны', buildAmmoBox()]].forEach(([n, o]) => {
  card(g, [renderThumb(renderer, o, { w: 230, h: 230, yaw: 0.6, pitch: 0.22, fit: 1.2 })], n);
});

// 6. Питомцы
g = section('Питомцы');
for (const p of PETS) card(g, [renderThumb(renderer, buildPet(p.id).root, { w: 260, h: 230, yaw: -0.7, pitch: 0.18, fit: 1.1 })], p.name, p.price + ' монет');

// 7. Наклейки
g = section('Наклейки');
for (const s of STICKERS.filter(x => x.id !== 'none')) {
  const c = document.createElement('div'); c.className = 'card';
  const cv = stickerCanvas(s.id, 120); cv.style.background = '#1a2238'; c.appendChild(cv); c.insertAdjacentHTML('beforeend', `<b>${s.name}</b>`); g.appendChild(c);
}
g = section('Карты');
for (const mp of MAPS) card(g, [{ url: mapThumbnail(renderer, mp.id), w: 480, h: 270 }], mp.name, mp.desc);
document.title = 'Копирка — лист моделей (готово)';
window.__sheetReady = true;
