// Все игровые данные «Копирки»: скины, оружие, карты, режимы, магазин, квесты.
// Цены и названия взяты из референса.

export const SKINS = [
  { id: 'standard', name: 'Стандартный', price: 0, desc: 'Классический новичок: жёлтая голова, синий торс, зелёные ноги.' },
  { id: 'anime', name: 'Аниме', price: 150, desc: 'Белые волосы, чёрная худи и маска.' },
  { id: 'cool', name: 'Крутой', price: 200, desc: 'Тёмные очки, строгий костюм и красный галстук.' },
  { id: 'demon', name: 'Демон', price: 300, desc: 'Красная кожа, рога, горящие глаза и крылья.' },
  { id: 'cat', name: 'Кошка', price: 250, desc: 'Розовые волосы, кошачьи ушки и хвост.' },
  { id: 'ninja', name: 'Ниндзя', price: 399, desc: 'Чёрный костюм, маска и красная повязка.' },
  { id: 'angel', name: 'Ангел', price: 499, desc: 'Белые крылья и золотой нимб.' },
];

export const WEAPONS = [
  { id: 'pistol', name: 'Пистолет', price: 0, slot: 1, dmg: 22, rate: 4.5, auto: false, mag: 12, reserve: 60, spread: 0.010, range: 220, pellets: 1, reload: 1.1, recoil: 0.9, desc: 'Точный и надёжный. Всегда под рукой.' },
  { id: 'shotgun', name: 'Дробовик', price: 300, slot: 2, dmg: 11, rate: 1.15, auto: false, mag: 6, reserve: 30, spread: 0.075, range: 75, pellets: 8, reload: 2.3, recoil: 2.4, desc: 'Сметает всё вблизи. Восемь дробин за выстрел.' },
  { id: 'rifle', name: 'Автомат', price: 600, slot: 3, dmg: 16, rate: 10, auto: true, mag: 30, reserve: 90, spread: 0.018, range: 260, pellets: 1, reload: 1.9, recoil: 0.7, desc: 'Скорострельный. 30 патронов в магазине.' },
  { id: 'sniper', name: 'Снайперская винтовка', short: 'Снайперка', price: 900, slot: 4, dmg: 85, rate: 0.9, auto: false, mag: 5, reserve: 20, spread: 0.0012, range: 600, pellets: 1, reload: 2.7, recoil: 3.0, scope: true, zoomFov: 18, desc: 'ПКМ — прицел. Выстрел в голову убивает сразу.' },
  { id: 'knife', name: 'Нож', price: 0, slot: 5, dmg: 42, rate: 2.2, auto: true, mag: Infinity, reserve: 0, spread: 0, range: 6.5, pellets: 1, reload: 0, recoil: 0, melee: true, desc: 'Тихий и быстрый. Бьёт вплотную.' },
];

export const WEAPON_SKINS = [
  { id: 'regular', name: 'Обычный', price: 0 },
  { id: 'neon', name: 'Неоновый', price: 150 },
  { id: 'gold', name: 'Золотой', price: 300 },
  { id: 'ice', name: 'Ледяной', price: 300 },
  { id: 'demonic', name: 'Демонический', price: 450 },
];

export const MAPS = [
  { id: 'sandbox', name: 'Песочница', desc: 'Зелёная лужайка, песочница и деревья.' },
  { id: 'city', name: 'Город', desc: 'Улицы, машины и крыши, на которые можно залезть.' },
  { id: 'castle', name: 'Замок', desc: 'Каменные стены, башни, ров и мост.' },
  { id: 'lab', name: 'Лаборатория', desc: 'Стекло, реактор и серверные стойки.' },
  { id: 'sky', name: 'Небесный остров', desc: 'Парящие острова и батуты. Не упади!' },
  { id: 'arena', name: 'Арена', desc: 'Песок, трибуны и костёр по центру.' },
];

export const MODES = [
  { id: 'tdm', name: 'Командный Бой', short: 'Командный\nБой', color: 'purple', desc: 'Синие против красных. Первые до 30 убийств.' },
  { id: 'ffa', name: 'Каждый за себя', short: 'Каждый\nза себя', color: 'green', desc: 'Все против всех. Первый до 25 убийств.' },
  { id: 'ctf', name: 'Захват Флага', short: 'Захват\nФлага', color: 'orange', desc: 'Укради флаг врага и принеси на свою базу. До 3 захватов.' },
  { id: 'survival', name: 'Выживание', short: 'Выживание', color: 'red', desc: 'Волны копий-клонов. Продержись как можно дольше.' },
];

export const PETS = [
  { id: 'cat', name: 'Котик', price: 200 },
  { id: 'dog', name: 'Пёсик', price: 200 },
  { id: 'dragon', name: 'Дракончик', price: 500 },
];

export const EFFECTS = [
  { id: 'none', name: 'Без эффекта', price: 0 },
  { id: 'confetti', name: 'Конфетти', price: 100 },
  { id: 'fire', name: 'Огонь', price: 200 },
  { id: 'hearts', name: 'Сердечки', price: 200 },
  { id: 'stars', name: 'Звёзды', price: 300 },
];

export const STICKERS = [
  { id: 'none', name: 'Без наклейки', price: 0, emoji: '' },
  { id: 'crown', name: 'Корона', price: 120, emoji: '👑' },
  { id: 'skull', name: 'Череп', price: 120, emoji: '💀' },
  { id: 'heart', name: 'Сердце', price: 80, emoji: '❤️' },
  { id: 'star', name: 'Звезда', price: 80, emoji: '⭐' },
  { id: 'fire', name: 'Огонь', price: 150, emoji: '🔥' },
];

export const EMOTES = [
  { id: 'wave', name: 'Привет', key: 'Z', price: 0 },
  { id: 'dance', name: 'Танец', key: 'X', price: 0 },
  { id: 'cheer', name: 'Ура!', key: 'C', price: 0 },
  { id: 'flex', name: 'Сила', key: 'B', price: 0 },
];

// Магазин: тот же набор, что на референсе («Скин: Ниндзя 399», «Скин: Ангел 499», набор монет, корона 299).
export const COIN_PACKS = [
  { id: 'pack_small', name: 'Набор монет', coins: 250, robux: 25 },
  { id: 'pack_big', name: 'Большой набор', coins: 1000, robux: 80 },
  { id: 'pack_crown', name: 'Королевский набор', coins: 3000, robux: 299, crown: true },
];

export const QUESTS = [
  { id: 'kills5', name: 'Победи 5 противников', stat: 'kills', goal: 5, coins: 80, robux: 0 },
  { id: 'head3', name: 'Сделай 3 выстрела в голову', stat: 'headshots', goal: 3, coins: 100, robux: 0 },
  { id: 'copy2', name: 'Скопируй 2 скина (клавиша E)', stat: 'copies', goal: 2, coins: 60, robux: 0 },
  { id: 'play2', name: 'Сыграй 2 матча', stat: 'matches', goal: 2, coins: 70, robux: 0 },
  { id: 'win1', name: 'Выиграй матч', stat: 'wins', goal: 1, coins: 150, robux: 5 },
];

export const ACHIEVEMENTS = [
  { id: 'first', name: 'Первая кровь', desc: 'Победи первого противника', test: s => s.kills >= 1, coins: 30 },
  { id: 'k50', name: 'Охотник', desc: '50 побед над противниками', test: s => s.kills >= 50, coins: 150 },
  { id: 'k200', name: 'Легенда арены', desc: '200 побед над противниками', test: s => s.kills >= 200, coins: 500 },
  { id: 'head25', name: 'Меткий глаз', desc: '25 выстрелов в голову', test: s => s.headshots >= 25, coins: 200 },
  { id: 'win5', name: 'Чемпион', desc: 'Выиграй 5 матчей', test: s => s.wins >= 5, coins: 250 },
  { id: 'copy10', name: 'Копирка', desc: 'Скопируй 10 скинов', test: s => s.copies >= 10, coins: 150 },
  { id: 'allmodes', name: 'Универсал', desc: 'Сыграй во всех режимах', test: s => (s.modesPlayed || []).length >= 4, coins: 200 },
  { id: 'rich', name: 'Богач', desc: 'Накопи 2000 монет', test: (s, save) => save.coins >= 2000, coins: 100 },
];

export const LEADERBOARD_BOTS = [
  ['PixelKing', 9120], ['NoobSlayer', 8450], ['CopyCat_99', 7800], ['MegaBlock', 6900], ['Sniper_Max', 6120],
  ['Dasha_Pro', 5400], ['TheCopier', 4800], ['BlockMaster', 3900], ['RobuxBoss', 3100], ['xX_Ninja_Xx', 2300],
];

export const BOT_NAMES = [
  'Алекс', 'Максим', 'Даша', 'Кирилл', 'Соня', 'Артём', 'Лиза', 'Ваня', 'Катя', 'Тимур', 'Миша', 'Ника',
  'PixelKing', 'NoobSlayer', 'CopyCat', 'MegaBlock', 'Ninja_X', 'ProGamer', 'BlockBoy', 'RoboMax',
];

export const TEAM_COLORS = { A: '#3d8bff', B: '#ff4d6d' };
