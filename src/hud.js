// Интерфейс во время боя: счёт, таймер, здоровье, патроны, хотбар, лента убийств, пауза, итоги.
import { MODES, MAPS, SKINS, ACHIEVEMENTS } from './data.js';
import { Sfx } from './audio.js';

const TPL = `
<div id="vignette"></div><div id="scope"><i></i><b></b></div>
<div id="crosshair"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i></div>
<div id="hitmarker"><i></i><i></i><i></i><i></i></div>
<div id="dmg-ind"></div>
<div class="hud-side">
  <button class="hbtn" data-h="menu" title="Пауза (Esc)">☰</button>
  <button class="hbtn" data-h="shop"><span>🛒</span><small>Магазин</small></button>
  <button class="hbtn" data-h="quests"><span>📜</span><small>Квесты</small></button>
  <button class="hbtn" data-h="settings"><span>⚙</span><small>Настройки</small></button>
</div>
<div class="hud-top"><div id="sL" class="sc a">0</div><div id="tm" class="tm">00:00</div><div id="sR" class="sc b">0</div></div>
<div id="info"></div>
<div id="feed"></div>
<div id="center"><h1></h1><p></p></div>
<div id="dead"><h2>ВЫ ПОГИБЛИ</h2><p></p></div>
<div id="toasts"></div>
<div class="hud-bl"><div class="hp"><div class="hpf" id="hpf"></div><span id="hpt">♥ 100</span></div><div id="copyb" class="copyb"><b>E</b> Копировать скин</div></div>
<div class="hud-br"><div class="wname" id="wname"></div><div class="ammo"><b id="am">30</b><span id="rs"> / 90</span></div><div id="rl">ПЕРЕЗАРЯДКА…</div></div>
<div id="hotbar"></div>
<div class="hints">WASD — бег · Пробел — прыжок · Shift — спринт · ЛКМ — огонь · ПКМ — прицел · R — перезарядка · E — копировать · V — вид · Z/X/C/B — эмоции · Esc — пауза</div>
`;

export class Hud {
  constructor(root) {
    this.root = root; root.innerHTML = TPL; root.classList.add('hidden');
    const $ = s => root.querySelector(s); this.$ = $;
    this.el = { sL: $('#sL'), sR: $('#sR'), tm: $('#tm'), hp: $('#hpf'), hpt: $('#hpt'), am: $('#am'), rs: $('#rs'), wname: $('#wname'), rl: $('#rl'), hot: $('#hotbar'), info: $('#info'), copyb: $('#copyb'), feed: $('#feed'), toasts: $('#toasts'), center: $('#center'), dead: $('#dead'), vig: $('#vignette'), scope: $('#scope'), cross: $('#crosshair'), hit: $('#hitmarker'), ind: $('#dmg-ind') };
    this.cache = {}; this.on = {};
    this.overlay = document.getElementById('overlay');
    root.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) this.on.hbtn?.(b.dataset.h); });
  }
  set(k, v, fn) { if (this.cache[k] !== v) { this.cache[k] = v; fn(v); } }

  begin({ mode }) {
    this.root.classList.remove('hidden'); this.overlay.innerHTML = ''; this.overlay.className = '';
    this.el.feed.innerHTML = ''; this.el.toasts.innerHTML = ''; this.cache = {}; this.el.dead.classList.remove('on'); this.el.center.classList.remove('on');
    this.root.dataset.mode = mode;
    this.el.sL.className = 'sc a'; this.el.sR.className = 'sc b';
  }
  end() { this.root.classList.add('hidden'); this.overlay.innerHTML = ''; this.overlay.className = ''; }

  update(s) {
    const e = this.el;
    this.set('sL', s.left, v => { e.sL.textContent = v; }); this.set('sR', s.right, v => { e.sR.textContent = v; });
    this.set('tm', s.timer, v => { e.tm.textContent = v; });
    const hp = Math.max(0, Math.ceil(s.hp));
    this.set('hp', hp, v => { e.hp.style.width = v + '%'; e.hp.style.background = v > 60 ? 'linear-gradient(#5be86f,#2fb847)' : v > 30 ? 'linear-gradient(#ffe066,#e0a800)' : 'linear-gradient(#ff7a7a,#d93030)'; e.hpt.textContent = '♥ ' + v; });
    this.set('am', s.ammo, v => { e.am.textContent = v; }); this.set('rs', s.reserve, v => { e.rs.textContent = v === '' ? '' : ' / ' + v; });
    this.set('wn', s.weaponName, v => { e.wname.textContent = v; });
    this.set('rl', s.reloading, v => { e.rl.style.opacity = v ? 1 : 0; });
    this.set('info', s.info, v => { e.info.innerHTML = v; });
    this.set('cp', Math.ceil(s.copy), v => { e.copyb.classList.toggle('cd', v > 0); e.copyb.innerHTML = v > 0 ? `<b>E</b> Копирование через ${v} с` : '<b>E</b> Копировать скин'; });
    this.set('slots', s.slots.map(x => x.id + x.owned + x.active).join(), () => {
      e.hot.innerHTML = s.slots.map(x => `<div class="slot ${x.active ? 'on' : ''} ${x.owned ? '' : 'lock'}"><b>${x.slot}</b><span>${x.name}</span>${x.owned ? '' : '<i>🔒</i>'}</div>`).join('');
    });
    this.set('aim', s.aim, v => { e.cross.classList.toggle('aim', v); });
    this.set('scope', s.scope, v => { e.scope.classList.toggle('on', v); e.cross.style.display = v ? 'none' : ''; });
    this.set('prot', s.protect, v => { e.vig.classList.toggle('prot', v); });
    const low = s.hp < 35 && s.hp > 0; this.set('low', low, v => { e.vig.classList.toggle('low', v); });
  }

  toast(text, kind = '') {
    const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = text; this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => d.classList.add('out'), 2100); setTimeout(() => d.remove(), 2600);
  }
  feed(html) {
    const d = document.createElement('div'); d.className = 'fi'; d.innerHTML = html; this.el.feed.appendChild(d);
    while (this.el.feed.children.length > 5) this.el.feed.firstChild.remove();
    setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 4800);
  }
  hitmarker(kind) {
    const h = this.el.hit; h.className = 'on ' + kind; clearTimeout(this._ht); this._ht = setTimeout(() => { h.className = ''; }, kind === 'kill' ? 380 : 140);
  }
  damage(angle) {
    const i = this.el.ind; i.style.setProperty('--a', angle + 'rad'); i.classList.remove('on'); void i.offsetWidth; i.classList.add('on');
    this.el.vig.classList.remove('hurt'); void this.el.vig.offsetWidth; this.el.vig.classList.add('hurt');
  }
  center(text, sub = '', ms = 1200) {
    const c = this.el.center; c.querySelector('h1').textContent = text; c.querySelector('p').textContent = sub; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
    clearTimeout(this._ct); this._ct = setTimeout(() => c.classList.remove('on'), ms);
  }
  dead(secs, by) {
    const d = this.el.dead;
    if (secs == null) { d.classList.remove('on'); return; }
    d.classList.add('on'); d.querySelector('p').textContent = by ? `Вас убил: ${by}${secs > 0 ? ` · возрождение через ${Math.ceil(secs)} с` : ''}` : `Возрождение через ${Math.ceil(secs)} с`;
    this._deadBy = by || this._deadBy;
    if (!by && secs > 0) d.querySelector('p').textContent = `${this._deadBy ? 'Вас убил: ' + this._deadBy + ' · ' : ''}возрождение через ${Math.ceil(secs)} с`;
  }
  crosshairKick(k) { const c = this.el.cross; c.style.setProperty('--k', Math.min(1, k * 0.35)); c.classList.remove('kick'); void c.offsetWidth; c.classList.add('kick'); }

  // ───── пауза ─────
  pause(on) {
    const o = this.overlay;
    if (!on) { o.innerHTML = ''; o.className = ''; return; }
    o.className = 'dim';
    o.innerHTML = `<div class="modal small"><h2>Пауза</h2>
      <button class="btn big green" data-a="resume">▶ Продолжить</button>
      <button class="btn big" data-a="settings">⚙ Настройки</button>
      <button class="btn big red" data-a="quit">⏏ Выйти в меню</button></div>`;
    o.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; Sfx.play('click'); this.on[b.dataset.a]?.(); };
  }

  // ───── итоги матча ─────
  results(r) {
    const o = this.overlay; o.className = 'dim';
    const mode = MODES.find(m => m.id === r.mode), map = MAPS.find(m => m.id === r.mapId);
    const title = r.win ? 'ПОБЕДА!' : r.draw ? 'НИЧЬЯ' : (r.mode === 'survival' ? 'ВЫ ПРОДЕРЖАЛИСЬ' : 'ПОРАЖЕНИЕ');
    const score = r.mode === 'survival' ? `Волн пройдено: <b>${Math.max(0, r.wave - 1)}</b>` : r.mode === 'ffa' ? `Ваше место: <b>${r.rank}</b>` : `<b style="color:#3d8bff">${r.scoreA}</b> : <b style="color:#ff4d6d">${r.scoreB}</b>`;
    const rows = r.board.slice(0, 10).map((b, i) => `<tr class="${b.me ? 'me' : ''}"><td>${i + 1}</td><td><i class="dot ${b.team}"></i>${b.name}</td><td>${b.kills}</td><td>${b.deaths}</td></tr>`).join('');
    const ach = r.newAch.length ? `<div class="newach">🏆 Новые достижения: ${r.newAch.map(a => `<b>${a.name}</b> (+${a.coins})`).join(', ')}</div>` : '';
    o.innerHTML = `<div class="modal res ${r.win ? 'win' : ''}">
      <div class="res-h"><h1>${title}</h1><div class="res-sub">${mode.name} · ${map.name}</div><div class="res-score">${score}</div></div>
      <div class="res-grid">
        <div class="res-stats">
          <div><span>Убийства</span><b>${r.kills}</b></div><div><span>Смерти</span><b>${r.deaths}</b></div>
          <div><span>В голову</span><b>${r.headshots}</b></div><div><span>Скопировано</span><b>${r.copies}</b></div>
          <div class="rw"><span>Монеты</span><b>+${r.coinsTotal} 🪙</b></div><div class="rw"><span>Опыт</span><b>+${r.xp} XP</b></div>
        </div>
        <table class="board"><thead><tr><th>#</th><th>Игрок</th><th>У</th><th>С</th></tr></thead><tbody>${rows}</tbody></table>
      </div>${ach}
      <div class="res-btn"><button class="btn big green" data-a="again">↻ Играть ещё</button><button class="btn big" data-a="menu">В меню</button></div></div>`;
    o.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; Sfx.play('click'); this.on[b.dataset.a]?.(); };
  }
}
