// Сохранение прогресса в localStorage.
import { QUESTS, ACHIEVEMENTS } from './data.js';

const KEY = 'kopirka_save_v1';
const fresh = () => ({
  coins: 500, robux: 25, xp: 0,
  owned: { skins: ['standard'], weapons: ['pistol', 'knife'], wskins: ['regular'], pets: [], effects: ['none'], stickers: ['none'] },
  equipped: { skin: 'standard', wskin: 'regular', weapon: 'pistol', pet: null, effect: 'none', sticker: 'none' },
  stats: { kills: 0, deaths: 0, headshots: 0, matches: 0, wins: 0, copies: 0, modesPlayed: [], bestScore: 0 },
  quests: { day: '', progress: {}, claimed: {} },
  ach: {}, gift: { last: 0, streak: 0 },
  settings: { sens: 1, fov: 75, vol: 0.7, shadows: true },
});

function merge(a, b) { for (const k of Object.keys(b)) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else a[k] = b[k]; } return a; }

class Save {
  constructor() { this.data = fresh(); this.load(); this.rollDay(); }
  load() { try { const raw = localStorage.getItem(KEY); if (raw) merge(this.data, JSON.parse(raw)); } catch (e) { /* игнорируем */ } }
  commit() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* приватный режим */ } }
  reset() { this.data = fresh(); this.rollDay(); this.commit(); }
  rollDay() { const d = new Date().toISOString().slice(0, 10); if (this.data.quests.day !== d) this.data.quests = { day: d, progress: {}, claimed: {} }; }

  get level() { return Math.floor(Math.sqrt(this.data.xp / 60)) + 1; }
  levelProgress() { const l = this.level, a = 60 * (l - 1) ** 2, b = 60 * l ** 2; return { cur: this.data.xp - a, need: b - a, pct: (this.data.xp - a) / (b - a) }; }
  has(kind, id) { return this.data.owned[kind].includes(id); }
  // покупка: возвращает true/false
  buy(kind, id, price, currency = 'coins') {
    if (this.has(kind, id)) return true;
    if (this.data[currency] < price) return false;
    this.data[currency] -= price; this.data.owned[kind].push(id); this.commit(); return true;
  }
  bump(stat, n = 1) {
    this.data.stats[stat] = (this.data.stats[stat] || 0) + n;
    this.data.quests.progress[stat] = (this.data.quests.progress[stat] || 0) + n;
  }
  questProgress(q) { return Math.min(q.goal, this.data.quests.progress[q.stat] || 0); }
  claimQuest(q) {
    if (this.data.quests.claimed[q.id] || this.questProgress(q) < q.goal) return false;
    this.data.quests.claimed[q.id] = true; this.data.coins += q.coins; this.data.robux += q.robux || 0; this.commit(); return true;
  }
  // проверка достижений; возвращает список новых
  checkAchievements() {
    const fresh = [];
    for (const a of ACHIEVEMENTS) if (!this.data.ach[a.id] && a.test(this.data.stats, this.data)) { this.data.ach[a.id] = Date.now(); this.data.coins += a.coins; fresh.push(a); }
    if (fresh.length) this.commit();
    return fresh;
  }
  giftReady() { return Date.now() - this.data.gift.last >= 20 * 3600 * 1000; }
  giftWait() { return Math.max(0, 20 * 3600 * 1000 - (Date.now() - this.data.gift.last)); }
  claimGift() {
    if (!this.giftReady()) return null;
    const g = this.data.gift; g.streak = Date.now() - g.last < 48 * 3600 * 1000 ? g.streak + 1 : 1; g.last = Date.now();
    const coins = 100 + Math.min(g.streak, 7) * 25, robux = g.streak % 3 === 0 ? 5 : 0;
    this.data.coins += coins; this.data.robux += robux; this.commit();
    return { coins, robux, streak: g.streak };
  }
}
export const save = new Save();
export { QUESTS };
