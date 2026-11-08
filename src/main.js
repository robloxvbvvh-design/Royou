// Точка входа «Копирки»: связывает рендерер, меню, игру и интерфейс.
import { createRenderer } from './stage.js';
import { save } from './save.js';
import { Hud } from './hud.js';
import { Game } from './game.js';
import { Showcase } from './showcase.js';
import { Menu } from './menu.js';
import { Sfx } from './audio.js';
import { QUESTS } from './data.js';

const canvas = document.getElementById('c');
const renderer = createRenderer(canvas, { shadows: save.data.settings.shadows });
const hud = new Hud(document.getElementById('hud'));
const game = new Game(renderer, hud, save);
const showcase = new Showcase(renderer);
const loading = document.getElementById('loading');
let mode = 'menu', lastOpts = null;

const menu = new Menu({ root: document.getElementById('screen'), renderer, save, showcase, onPlay });

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); game.resize(w, h); showcase.resize(w, h);
}
window.addEventListener('resize', resize); resize();

function onPlay(opts) {
  lastOpts = opts; Sfx.init(); menu.hide(); loading.classList.add('on');
  setTimeout(() => {
    try { renderer.shadowMap.enabled = save.data.settings.shadows; game.start(opts); mode = 'game'; }
    catch (err) { console.error(err); menu.show(); menu.toast('Не удалось запустить карту: ' + err.message, 'bad'); }
    loading.classList.remove('on');
  }, 40);
}
function toMenu() {
  game.stop(); hud.end(); mode = 'menu'; menu.cur = 'main'; menu.show();
}

hud.on = {
  resume: () => game.pause(false),
  quit: () => toMenu(),
  menu: () => toMenu(),
  again: () => { hud.end(); onPlay(lastOpts); },
  settings: () => { menu.openSettings(() => { if (game.paused) hud.pause(true); }); },
  hbtn: h => {
    if (h === 'menu') game.pause(true);
    else if (h === 'settings') { game.pause(true); menu.openSettings(() => hud.pause(true)); }
    else { game.pause(true); showQuick(h); }
  },
};
function showQuick(h) {
  const o = document.getElementById('overlay'); o.className = 'dim';
  const body = h === 'quests'
    ? QUESTS.map(q => `<div class="row"><div class="rb"><b>${q.name}</b><div class="bar"><i style="width:${save.questProgress(q) / q.goal * 100}%"></i></div></div><small>${save.questProgress(q)}/${q.goal}</small></div>`).join('')
    : `<p class="muted">Магазин откроется в главном меню. Монеты за убийства уже на твоём счёте: <b>${save.data.coins}</b>.</p>`;
  o.innerHTML = `<div class="modal"><h2>${h === 'quests' ? 'Квесты дня' : 'Магазин'}</h2><div class="list">${body}</div><button class="btn big green" data-q="1">Закрыть</button></div>`;
  o.onclick = e => { if (e.target.closest('[data-q]')) hud.pause(true); };
}

window.addEventListener('keydown', e => {
  if (mode !== 'game') return;
  if ((e.code === 'Escape' || e.code === 'KeyP') && game.active && game.state !== 'ended' && !game.paused) game.pause(true);
});

// вращение модели мышью в меню
let dragging = false, lx = 0;
canvas.addEventListener('pointerdown', e => { if (mode === 'menu') { dragging = true; lx = e.clientX; } });
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointermove', e => { if (dragging && mode === 'menu') { showcase.drag(e.clientX - lx); lx = e.clientX; } });
document.getElementById('screen').addEventListener('pointerdown', e => { if (e.target === e.currentTarget && mode === 'menu') { dragging = true; lx = e.clientX; } });

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mode === 'game') game.frame(dt);
  else { showcase.update(dt); showcase.render(); }
}

menu.show(); requestAnimationFrame(loop);

// ?mode=ctf&map=city — быстрый запуск; ?autostart=1 — сразу в бой
const q = new URLSearchParams(location.search);
if (q.get('mode') || q.get('map')) { menu.pick.mode = q.get('mode') || menu.pick.mode; menu.pick.map = q.get('map') || menu.pick.map; }
if (q.get('autostart')) onPlay({ mode: menu.pick.mode, mapId: menu.pick.map });

window.__kopirka = { game, menu, save, showcase, hud, renderer, get mode() { return mode; } };
