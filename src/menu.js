// Меню «Копирки»: главный экран, выбор режима/карты, магазин, коллекция моделей, квесты, достижения и т.д.
import { SKINS, WEAPONS, WEAPON_SKINS, MAPS, MODES, PETS, EFFECTS, STICKERS, EMOTES, COIN_PACKS, QUESTS, ACHIEVEMENTS, LEADERBOARD_BOTS } from './data.js';
import { renderThumb } from './stage.js';
import { mapThumbnail } from './world.js';
import { buildCharacter, attachWeapon, updateRig } from './models/characters.js';
import { buildWeapon } from './models/weapons.js';
import { buildPet, buildCoin, buildGem, buildCrown, buildGift, buildTrophy, buildPodium, buildScroll, stickerCanvas } from './models/props.js';
import { Sfx } from './audio.js';

const BG = '#18203a';
const MODE_ICON = {
  tdm: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="19" fill="none" stroke="#fff" stroke-width="5"/><circle cx="32" cy="32" r="4" fill="#fff"/><path d="M32 4v14M32 46v14M4 32h14M46 32h14" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>',
  ffa: '<svg viewBox="0 0 64 64"><circle cx="32" cy="21" r="12" fill="#fff"/><path d="M10 58c0-14 10-22 22-22s22 8 22 22z" fill="#fff"/></svg>',
  ctf: '<svg viewBox="0 0 64 64"><path d="M8 50l-2-28 14 10 12-18 12 18 14-10-2 28z" fill="#fff"/><rect x="8" y="52" width="48" height="6" rx="2" fill="#fff"/></svg>',
  survival: '<svg viewBox="0 0 64 64"><path d="M32 6C18 6 9 16 9 28c0 8 4 13 9 16v10h8v-6h4v6h4v-6h4v6h8V44c5-3 9-8 9-16C55 16 46 6 32 6z" fill="#fff"/><circle cx="23" cy="29" r="6" fill="#d6203a"/><circle cx="41" cy="29" r="6" fill="#d6203a"/><path d="M32 34l-4 8h8z" fill="#d6203a"/></svg>',
};
const coin = '<i class="ic coin"></i>', gem = '<i class="ic gem"></i>';
const pad2 = n => String(n).padStart(2, '0');

function effectIcon(id) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  if (id === 'none') { g.strokeStyle = '#6b7aa8'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 36, 0, 7); g.moveTo(40, 88); g.lineTo(88, 40); g.stroke(); return c.toDataURL(); }
  if (id === 'confetti') { const cols = ['#ff4a6a', '#ffd23f', '#46c8ff', '#7cff6a', '#c64dff']; for (let i = 0; i < 26; i++) { g.save(); g.translate(14 + (i * 37) % 100, 14 + (i * 53) % 100); g.rotate(i); g.fillStyle = cols[i % 5]; g.fillRect(-6, -3, 12, 6); g.restore(); } return c.toDataURL(); }
  const map = { fire: 'fire', hearts: 'heart', stars: 'star' };
  return stickerCanvas(map[id], 128).toDataURL();
}

export class Menu {
  constructor({ root, renderer, save, showcase, onPlay }) {
    this.root = root; this.renderer = renderer; this.save = save; this.showcase = showcase; this.onPlay = onPlay;
    this.cur = 'main'; this.tab = 'skin'; this.shopTab = 'skins'; this.sel = { kind: null, id: null };
    try { this.pick = JSON.parse(localStorage.getItem('kopirka_pick') || 'null'); } catch (e) { this.pick = null; }
    this.pick = this.pick || { mode: 'tdm', map: 'sandbox' };
    this.cache = {}; this.mapThumbs = {};
    root.addEventListener('click', e => this.click(e));
    root.addEventListener('input', e => this.input(e));
    this.overlay = document.getElementById('overlay');
  }

  get d() { return this.save.data; }
  show() { this.root.classList.remove('hidden'); this.go(this.cur === 'none' ? 'main' : this.cur); }
  hide() { this.root.classList.add('hidden'); }

  // ───────────── превью ─────────────
  th(key, build, opts) { return this.cache[key] || (this.cache[key] = renderThumb(this.renderer, build(), { key, bg: BG, ...opts })); }
  skinThumb(id) { return this.th('skin:' + id, () => { const r = buildCharacter(id); updateRig(r, 0.016, {}); return r.root; }, { w: 240, h: 320, yaw: Math.PI + 0.45, pitch: 0.08, fit: 1.12 }); }
  weaponThumb(id, sk = 'regular') { return this.th(`w:${id}:${sk}`, () => buildWeapon(id, sk), { w: 300, h: 190, yaw: -Math.PI / 2 + 0.35, pitch: 0.14, fit: 1.1 }); }
  petThumb(id) { return this.th('pet:' + id, () => buildPet(id).root, { w: 240, h: 200, yaw: -0.7, pitch: 0.18, fit: 1.1 }); }
  emoteThumb(id) { return this.th('em:' + id, () => { const r = buildCharacter(this.d.equipped.skin); r.anim.emoteT = 0.4; updateRig(r, 0.3, { emote: id }); return r.root; }, { w: 240, h: 320, yaw: Math.PI + 0.3, pitch: 0.08, fit: 1.15 }); }
  propThumb(k, build, o = {}) { return this.th('prop:' + k, build, { w: 160, h: 160, yaw: 0.6, pitch: 0.22, fit: 1.2, ...o }); }
  mapThumb(id) { return this.mapThumbs[id] || (this.mapThumbs[id] = mapThumbnail(this.renderer, id)); }

  // ───────────── общая рамка ─────────────
  top(title, back = 'main') {
    const sp = this.save.levelProgress();
    return `<div class="topbar">
      ${back ? `<button class="back" data-act="go" data-to="${back}">← Назад</button>` : ''}<h2>${title || ''}</h2><div class="sp"></div>
      <div class="lvl"><b>Ур. ${this.save.level}</b><div class="xp"><i style="width:${Math.round(sp.pct * 100)}%"></i></div></div>
      <div class="pill" id="p-coins">${coin}<b>${this.d.coins.toLocaleString('ru')}</b></div>
      <div class="pill" id="p-robux">${gem}<b>${this.d.robux.toLocaleString('ru')}</b></div>
      <button class="icon-btn" data-act="settings" title="Настройки">⚙</button></div>`;
  }
  refreshTop() { const c = this.root.querySelector('#p-coins b'), r = this.root.querySelector('#p-robux b'); if (c) c.textContent = this.d.coins.toLocaleString('ru'); if (r) r.textContent = this.d.robux.toLocaleString('ru'); }
  toast(msg, kind = '') {
    let box = document.getElementById('mtoast'); if (!box) { box = document.createElement('div'); box.id = 'mtoast'; document.body.appendChild(box); }
    const d = document.createElement('div'); d.className = 'mt ' + kind; d.textContent = msg; box.appendChild(d); setTimeout(() => d.classList.add('out'), 2200); setTimeout(() => d.remove(), 2700);
  }

  go(name, arg) {
    this.cur = name; if (arg) this.tab = arg;
    const fn = this['s_' + name]; if (!fn) return;
    this.root.className = 'screen s-' + name;
    this.root.innerHTML = fn.call(this);
    this.after?.(); this.after = null;
    this.save.rollDay();
  }

  // ───────────── главный экран ─────────────
  s_main() {
    const eq = this.d.equipped;
    this.showcase.show('menu', null, { skin: eq.skin, weapon: eq.weapon, wskin: eq.wskin, pet: eq.pet }); this.showcase.setShift(0.2);
    const tiles = [
      ['quests', 'Квесты', this.propThumb('scroll', buildScroll, { yaw: 0.2 }), 'quests'], ['achievements', 'Достижения', this.propThumb('trophy', buildTrophy), 'achievements'],
      ['leaders', 'Таблица лидеров', this.propThumb('podium', buildPodium), 'leaders'], ['gifts', 'Подарки', this.propThumb('gift', buildGift), 'gifts'],
      ['collection', 'Питомцы', this.petThumb(PETS[0].id), 'pet'], ['collection', 'Эмоции', this.emoteThumb('wave'), 'emote'],
      ['collection', 'Эффекты', effectIcon('fire'), 'effect'], ['collection', 'Наклейки', stickerCanvas('crown', 128).toDataURL(), 'sticker'],
    ];
    const ready = this.save.giftReady();
    const doneQ = QUESTS.filter(q => this.save.questProgress(q) >= q.goal && !this.d.quests.claimed[q.id]).length;
    return `${this.top('', null)}
    <div class="logo"><div class="cube"></div><div class="lt"><span>ROBLOX-СТИЛЬ</span><h1>Копирка</h1><em>Копируй. Выживай. Побеждай!</em></div></div>
    <div class="menu-col">
      <button class="bigplay" data-act="go" data-to="play">▶ ИГРАТЬ</button>
      <button class="mbtn" data-act="go" data-to="shop"><span>🛒</span>Магазин</button>
      <button class="mbtn" data-act="go" data-to="collection" data-arg="skin"><span>🧍</span>Модели и скины</button>
      <button class="mbtn" data-act="go" data-to="quests"><span>📜</span>Квесты${doneQ ? `<i class="badge">${doneQ}</i>` : ''}</button>
      <button class="mbtn" data-act="go" data-to="gifts"><span>🎁</span>Подарки${ready ? '<i class="badge">!</i>' : ''}</button>
      <div class="who"><b>${SKINS.find(s => s.id === eq.skin).name}</b> · ${WEAPONS.find(w => w.id === eq.weapon).name}</div>
    </div>
    <div class="extras"><h3>Дополнительные элементы</h3><div class="tiles">${tiles.map(t => `<button class="tile" data-act="go" data-to="${t[0]}" data-arg="${t[3] === t[0] ? '' : t[3]}"><img src="${t[2]}" alt=""><span>${t[1]}</span></button>`).join('')}</div></div>
    <div class="hint-drag">Нажми «ИГРАТЬ», выбери режим и карту</div>`;
  }

  // ───────────── выбор режима и карты ─────────────
  s_play() {
    this.showcase.show('menu', null, { skin: this.d.equipped.skin, weapon: this.d.equipped.weapon, wskin: this.d.equipped.wskin, pet: null }); this.showcase.setShift(0);
    const m = MODES.find(x => x.id === this.pick.mode), mp = MAPS.find(x => x.id === this.pick.map);
    this.after = () => { // ленивые превью карт
      MAPS.forEach((mm, i) => setTimeout(() => { const img = this.root.querySelector(`[data-map="${mm.id}"] img`); if (img && this.cur === 'play') img.src = this.mapThumb(mm.id); }, 40 + i * 30));
    };
    return `${this.top('Выбор игры')}
    <div class="play-wrap">
      <h3 class="sec">Режимы</h3>
      <div class="modes">${MODES.map(x => `<button class="mode c-${x.color} ${x.id === this.pick.mode ? 'on' : ''}" data-act="mode" data-id="${x.id}"><div class="mi">${MODE_ICON[x.id]}</div><span>${x.short.replace('\n', '<br>')}</span></button>`).join('')}</div>
      <p class="mdesc"><b>${m.name}.</b> ${m.desc}</p>
      <h3 class="sec">Карты</h3>
      <div class="maps">${MAPS.map(x => `<button class="map ${x.id === this.pick.map ? 'on' : ''}" data-act="map" data-id="${x.id}" data-map="${x.id}"><img src="${this.mapThumbs[x.id] || 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='}" alt=""><span>${x.name}</span></button>`).join('')}</div>
      <p class="mdesc">${mp.desc}</p>
      <div class="startrow"><button class="btn huge green" data-act="start">⚔ В БОЙ!</button><small>${m.name} · ${mp.name}</small></div>
    </div>`;
  }

  // ───────────── магазин ─────────────
  s_shop() {
    this.showcase.show('menu', null, { skin: this.d.equipped.skin, weapon: this.d.equipped.weapon, wskin: this.d.equipped.wskin, pet: null }); this.showcase.setShift(0.28);
    const t = this.shopTab;
    let body = '';
    if (t === 'skins') body = `<div class="grid">${SKINS.map(s => this.card('skin', s)).join('')}</div>`;
    else if (t === 'weapons') body = `<div class="grid">${WEAPONS.map(s => this.card('weapon', s)).join('')}</div><h3 class="sec">Скины оружия</h3><div class="grid">${WEAPON_SKINS.map(s => this.card('wskin', s)).join('')}</div>`;
    else body = `<div class="grid">${COIN_PACKS.map(p => `<div class="card pack"><div class="pk">${p.crown ? '<img src="' + this.propThumb('crown', buildCrown) + '">' : '<img src="' + this.propThumb('coin', buildCoin, { yaw: 0.2 }) + '">'}</div><b>${p.name}</b><div class="sub">${coin} ${p.coins.toLocaleString('ru')}</div><button class="btn green" data-act="pack" data-id="${p.id}">${gem} ${p.robux}</button></div>`).join('')}
      <div class="card pack"><div class="pk"><img src="${this.propThumb('gem', buildGem, { yaw: 0.3 })}"></div><b>Робуксы</b><div class="sub">Премиум-валюта игры</div><div class="note">Их дают за подарки и квесты. Это игровая валюта — реальные деньги не нужны.</div></div></div>`;
    return `${this.top('Магазин')}<div class="panel shop"><div class="tabs">${[['skins', 'Скины'], ['weapons', 'Оружие'], ['money', 'Валюта']].map(([k, n]) => `<button class="tab ${t === k ? 'on' : ''}" data-act="shoptab" data-id="${k}">${n}</button>`).join('')}</div>${body}</div>`;
  }

  // карточка предмета
  card(kind, it, preview = false) {
    const K = this.kinds()[kind], own = it.id === null || this.save.has(K.own, it.id) || it.price === 0 || K.free;
    const eq = this.d.equipped[K.eq] === it.id;
    let img = '';
    if (kind === 'skin') img = this.skinThumb(it.id); else if (kind === 'weapon') img = this.weaponThumb(it.id, this.d.equipped.wskin);
    else if (kind === 'wskin') img = this.weaponThumb(this.d.equipped.weapon === 'knife' ? 'rifle' : 'rifle', it.id);
    else if (kind === 'pet') img = it.id ? this.petThumb(it.id) : effectIcon('none');
    else if (kind === 'effect') img = effectIcon(it.id); else if (kind === 'sticker') img = it.id === 'none' ? effectIcon('none') : stickerCanvas(it.id, 128).toDataURL();
    else if (kind === 'emote') img = this.emoteThumb(it.id);
    const status = kind === 'emote' ? '<div class="st own">' + it.key + '</div>' : eq ? '<div class="st eq">✔ Выбрано</div>' : own ? '<div class="st own">Куплено</div>' : `<div class="st price">${coin}${it.price}</div>`;
    const sel = this.sel.kind === kind && this.sel.id === it.id;
    return `<div class="card ${eq ? 'eq' : ''} ${own ? '' : 'locked'} ${sel ? 'sel' : ''}" data-act="card" data-kind="${kind}" data-id="${it.id}"><img src="${img}" alt=""><b>${kind === 'skin' && !preview ? 'Скин: ' : ''}${it.name}</b>${status}${preview ? '' : `<button class="btn ${own ? (eq ? '' : 'blue') : 'green'}" data-act="buy" data-kind="${kind}" data-id="${it.id}">${eq ? 'Выбрано' : own ? 'Выбрать' : 'Купить'}</button>`}</div>`;
  }
  kinds() {
    return {
      skin: { own: 'skins', eq: 'skin', list: SKINS, label: 'Скины' }, weapon: { own: 'weapons', eq: 'weapon', list: WEAPONS, label: 'Оружие' }, wskin: { own: 'wskins', eq: 'wskin', list: WEAPON_SKINS, label: 'Окрас оружия' },
      pet: { own: 'pets', eq: 'pet', list: [{ id: null, name: 'Без питомца', price: 0 }, ...PETS], label: 'Питомцы' }, effect: { own: 'effects', eq: 'effect', list: EFFECTS, label: 'Эффекты' },
      sticker: { own: 'stickers', eq: 'sticker', list: STICKERS, label: 'Наклейки' }, emote: { own: null, eq: 'emote', list: EMOTES, label: 'Эмоции', free: true },
    };
  }

  // ───────────── коллекция моделей (3D-просмотр) ─────────────
  s_collection() {
    const kinds = this.kinds(); const k = kinds[this.tab] ? this.tab : 'skin'; this.tab = k;
    const K = kinds[k]; const eq = this.d.equipped;
    if (!this.sel.id || this.sel.kind !== k) { this.sel = { kind: k, id: k === 'emote' ? 'wave' : (eq[K.eq] ?? K.list[0].id) }; }
    this.preview();
    this.showcase.setShift(0.18);
    const list = K.list; const it = list.find(x => x.id === this.sel.id) || list[0];
    const own = k === 'emote' || it.id === null || this.save.has(K.own, it.id) || it.price === 0;
    const isEq = eq[K.eq] === it.id;
    const desc = it.desc || (k === 'wskin' ? 'Меняет окраску всего оружия.' : k === 'pet' ? 'Бегает за тобой по карте.' : k === 'effect' ? 'Проигрывается, когда ты побеждаешь противника.' : k === 'sticker' ? 'Значок над твоей головой.' : k === 'emote' ? `Клавиша ${it.key} в игре.` : '');
    const tabs = Object.entries(kinds).map(([id, v]) => `<button class="tab ${id === k ? 'on' : ''}" data-act="coltab" data-id="${id}">${v.label}</button>`).join('');
    return `${this.top('Модели и скины')}
    <div class="panel coll"><div class="tabs">${tabs}</div>
      <div class="grid small">${list.map(x => this.card(k, x, true)).join('')}</div>
      <div class="infobox"><h3>${it.name}</h3><p>${desc}</p>${k === 'weapon' ? this.statsHTML(it) : ''}
        ${k === 'emote' ? `<button class="btn blue" data-act="playemote" data-id="${it.id}">▶ Показать</button>` : `<button class="btn big ${own ? (isEq ? '' : 'blue') : 'green'}" data-act="buy" data-kind="${k}" data-id="${it.id}">${isEq ? '✔ Выбрано' : own ? 'Выбрать' : `Купить за ${it.price}`}</button>`}</div>
    </div>`;
  }
  statsHTML(w) {
    const bar = (n, v, max) => `<div class="stat"><span>${n}</span><div><i style="width:${Math.min(100, v / max * 100)}%"></i></div><b>${v}</b></div>`;
    if (w.melee) return bar('Урон', w.dmg, 100) + bar('Скорость', w.rate, 12);
    return bar('Урон', w.dmg * w.pellets, 100) + bar('Скорострельность', w.rate, 12) + bar('Магазин', w.mag, 30) + bar('Дальность', w.range, 300);
  }
  preview() {
    const eq = this.d.equipped, { kind, id } = this.sel;
    const ctx = { skin: eq.skin, weapon: eq.weapon, wskin: eq.wskin };
    if (kind === 'skin') this.showcase.show('skin', id, ctx);
    else if (kind === 'weapon') this.showcase.show('weapon', id, ctx);
    else if (kind === 'wskin') this.showcase.show('wskin', id, { ...ctx, weapon: eq.weapon === 'knife' ? 'rifle' : eq.weapon });
    else if (kind === 'pet') id ? this.showcase.show('pet', id, ctx) : this.showcase.show('menu', null, ctx);
    else if (kind === 'effect') this.showcase.show('effect', id, ctx);
    else if (kind === 'sticker') id === 'none' ? this.showcase.show('menu', null, ctx) : this.showcase.show('sticker', id, ctx);
    else if (kind === 'emote') this.showcase.show('emote', id, ctx);
  }

  // ───────────── квесты ─────────────
  s_quests() {
    this.showcase.show('gift', null, {}); this.showcase.setShift(0.3);
    const rows = QUESTS.map(q => { const p = this.save.questProgress(q), done = p >= q.goal, cl = this.d.quests.claimed[q.id];
      return `<div class="row"><div class="ic-q">📜</div><div class="rb"><b>${q.name}</b><div class="bar"><i style="width:${p / q.goal * 100}%"></i></div><small>${p} / ${q.goal}</small></div><div class="rw">${coin}${q.coins}${q.robux ? ` ${gem}${q.robux}` : ''}</div><button class="btn ${cl ? '' : done ? 'green' : 'dis'}" data-act="claim" data-id="${q.id}">${cl ? 'Получено' : done ? 'Забрать' : 'В процессе'}</button></div>`; }).join('');
    return `${this.top('Ежедневные квесты')}<div class="panel list"><p class="muted">Квесты обновляются каждый день. Играй, чтобы выполнять их.</p>${rows}</div>`;
  }
  s_achievements() {
    this.showcase.show('menu', null, { skin: this.d.equipped.skin, weapon: this.d.equipped.weapon, wskin: this.d.equipped.wskin }); this.showcase.setShift(0.3);
    const n = ACHIEVEMENTS.filter(a => this.d.ach[a.id]).length;
    return `${this.top('Достижения')}<div class="panel list"><p class="muted">Открыто: ${n} из ${ACHIEVEMENTS.length}</p>${ACHIEVEMENTS.map(a => { const ok = this.d.ach[a.id]; return `<div class="row ${ok ? 'ok' : 'lockd'}"><div class="ic-q">${ok ? '🏆' : '🔒'}</div><div class="rb"><b>${a.name}</b><small>${a.desc}</small></div><div class="rw">${coin}${a.coins}</div></div>`; }).join('')}</div>`;
  }
  s_leaders() {
    this.showcase.show('menu', null, { skin: this.d.equipped.skin, weapon: this.d.equipped.weapon, wskin: this.d.equipped.wskin }); this.showcase.setShift(0.3);
    const me = this.d.xp; const rows = [...LEADERBOARD_BOTS.map(([n, s]) => ({ n, s })), { n: 'Вы', s: me, me: true }].sort((a, b) => b.s - a.s);
    return `${this.top('Таблица лидеров')}<div class="panel list"><table class="board big"><thead><tr><th>#</th><th>Игрок</th><th>Очки</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${i + 1}</td><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] + ' ' : ''}${r.n}</td><td>${r.s.toLocaleString('ru')}</td></tr>`).join('')}</tbody></table>
      <div class="mystats"><div><span>Убийства</span><b>${this.d.stats.kills}</b></div><div><span>Смерти</span><b>${this.d.stats.deaths}</b></div><div><span>В голову</span><b>${this.d.stats.headshots}</b></div><div><span>Матчей</span><b>${this.d.stats.matches}</b></div><div><span>Побед</span><b>${this.d.stats.wins}</b></div></div></div>`;
  }
  s_gifts() {
    this.showcase.show('gift', null, {}); this.showcase.setShift(0.25);
    const ready = this.save.giftReady(), w = this.save.giftWait(), h = Math.floor(w / 3600000), m = Math.floor(w % 3600000 / 60000);
    return `${this.top('Подарки')}<div class="panel gift"><h3>Ежедневный подарок</h3><p>Заходи каждый день — награда растёт. Серия: <b>${this.d.gift.streak}</b> дн.</p>
      <button class="btn huge ${ready ? 'green' : 'dis'}" data-act="gift">${ready ? '🎁 Открыть подарок' : `Следующий через ${h} ч ${pad2(m)} мин`}</button></div>`;
  }

  // ───────────── настройки ─────────────
  openSettings(then) {
    const s = this.d.settings; const o = this.overlay; o.className = 'dim';
    o.innerHTML = `<div class="modal small"><h2>Настройки</h2>
      <label>Чувствительность мыши <b id="v-sens">${s.sens.toFixed(2)}</b><input type="range" min="0.3" max="2.5" step="0.05" value="${s.sens}" data-set="sens"></label>
      <label>Угол обзора (FOV) <b id="v-fov">${s.fov}</b><input type="range" min="60" max="105" step="1" value="${s.fov}" data-set="fov"></label>
      <label>Громкость <b id="v-vol">${Math.round(s.vol * 100)}%</b><input type="range" min="0" max="1" step="0.05" value="${s.vol}" data-set="vol"></label>
      <label class="chk"><input type="checkbox" data-set="shadows" ${s.shadows ? 'checked' : ''}> Тени (влияют на производительность)</label>
      <button class="btn big green" data-oact="close">Готово</button>
      <button class="link" data-oact="reset">Сбросить прогресс</button></div>`;
    this._after = then;
    o.onclick = e => {
      const b = e.target.closest('[data-oact]'); if (!b) return;
      if (b.dataset.oact === 'close') { o.innerHTML = ''; o.className = ''; this.save.commit(); this._after?.(); }
      if (b.dataset.oact === 'reset' && confirm('Сбросить весь прогресс: монеты, скины, достижения?')) { this.save.reset(); o.innerHTML = ''; o.className = ''; this.go('main'); }
    };
    o.oninput = e => {
      const t = e.target, k = t.dataset.set; if (!k) return; const v = t.type === 'checkbox' ? t.checked : parseFloat(t.value); s[k] = v;
      const lab = o.querySelector('#v-' + k); if (lab) lab.textContent = k === 'vol' ? Math.round(v * 100) + '%' : k === 'sens' ? v.toFixed(2) : v;
      if (k === 'vol') Sfx.setVolume(v);
    };
  }

  // ───────────── события ─────────────
  input() { /* ползунки в оверлее обрабатываются отдельно */ }

  click(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act; Sfx.init(); if (a !== 'card') Sfx.play('click');
    const d = this.d;
    switch (a) {
      case 'go': this.go(b.dataset.to, b.dataset.arg || undefined); if (b.dataset.arg) { this.sel = { kind: null, id: null }; } break;
      case 'settings': this.openSettings(); break;
      case 'mode': this.pick.mode = b.dataset.id; this.savePick(); this.go('play'); break;
      case 'map': this.pick.map = b.dataset.id; this.savePick(); this.go('play'); break;
      case 'start': this.savePick(); this.onPlay({ mode: this.pick.mode, mapId: this.pick.map }); break;
      case 'shoptab': this.shopTab = b.dataset.id; this.go('shop'); break;
      case 'coltab': this.tab = b.dataset.id; this.sel = { kind: null, id: null }; this.go('collection'); break;
      case 'card': { // выбор карточки в коллекции (просмотр)
        if (this.cur !== 'collection') { const k = b.dataset.kind; if (k === 'emote') this.showcase.show('emote', b.dataset.id, { skin: d.equipped.skin }); break; }
        this.sel = { kind: b.dataset.kind, id: b.dataset.id === 'null' ? null : b.dataset.id }; Sfx.play('click'); this.go('collection'); break;
      }
      case 'playemote': this.showcase.show('emote', b.dataset.id, { skin: d.equipped.skin, weapon: d.equipped.weapon, wskin: d.equipped.wskin }); break;
      case 'buy': { e.stopPropagation(); this.buy(b.dataset.kind, b.dataset.id === 'null' ? null : b.dataset.id); break; }
      case 'pack': { const p = COIN_PACKS.find(x => x.id === b.dataset.id); if (d.robux < p.robux) { this.toast('Не хватает робуксов. Забирай подарки и квесты!', 'bad'); break; } d.robux -= p.robux; d.coins += p.coins; this.save.commit(); Sfx.play('buy'); this.toast(`+${p.coins} монет`, 'good'); this.go('shop'); break; }
      case 'claim': { const q = QUESTS.find(x => x.id === b.dataset.id); if (this.save.claimQuest(q)) { Sfx.play('coin'); this.toast(`Награда получена: +${q.coins} монет`, 'good'); this.go('quests'); } break; }
      case 'gift': { const r = this.save.claimGift(); if (r) { Sfx.play('win'); this.toast(`Подарок: +${r.coins} монет${r.robux ? ` и +${r.robux} робуксов` : ''}!`, 'good'); this.go('gifts'); } break; }
    }
  }
  savePick() { try { localStorage.setItem('kopirka_pick', JSON.stringify(this.pick)); } catch (e) { /* ignore */ } }

  buy(kind, id) {
    const K = this.kinds()[kind], list = K.list, it = list.find(x => x.id === id); if (!it) return;
    const d = this.d;
    if (kind === 'emote') return;
    const own = id === null || this.save.has(K.own, id) || it.price === 0;
    if (!own) {
      if (d.coins < it.price) { Sfx.play('empty'); this.toast('Не хватает монет — выигрывай матчи и выполняй квесты', 'bad'); return; }
      this.save.buy(K.own, id, it.price); Sfx.play('buy'); this.toast(`Куплено: ${it.name}`, 'good'); this.save.checkAchievements();
    }
    if (kind === 'pet' && d.equipped.pet === id && id !== null) { /* повторный выбор — оставляем */ }
    d.equipped[K.eq] = id; this.save.commit(); if (own) Sfx.play('click');
    this.go(this.cur);
  }
}
