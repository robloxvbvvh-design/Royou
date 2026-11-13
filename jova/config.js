// Тарифы, модели и лимиты Jova. Всё, что можно менять, лежит здесь.
// Каждая модель Jova — это реальная языковая модель за API. Подменить можно переменными окружения.
const env = process.env;

const MODELS = {
  'jova-1.0': {
    name: 'Jova 1.0', tagline: 'Базовая модель для повседневных задач',
    backend: env.JOVA_BACKEND_1 || 'claude-haiku-5-5', plan: 'free', weight: 1, maxTokens: 2048,
    provider: env.JOVA_OWN_URL ? 'own' : 'anthropic', // 'own' — собственная модель из ./own (без внешнего API)
    features: { search: true, vision: false, media: false, code: false },
    style: 'Отвечай коротко и по делу. Ты для повседневных вопросов.'
  },
  'jova-2.0': {
    name: 'Jova 2.0', tagline: 'Для чуть более сложных и повседневных задач',
    backend: env.JOVA_BACKEND_2 || 'claude-sonnet-5-5', plan: 'free', weight: 2, maxTokens: 4096,
    features: { search: true, vision: false, media: false, code: false },
    style: 'Думай аккуратно, объясняй по шагам, когда задача нетривиальная.'
  },
  'jova-3.0': {
    name: 'Jova 3.0', tagline: 'Флагман. Картинки, видео, загрузка фото',
    backend: env.JOVA_BACKEND_3 || 'claude-sonnet-5-5', plan: 'pro', weight: 3, maxTokens: 6144,
    features: { search: true, vision: true, media: true, code: false },
    style: 'Ты флагманская модель. Можешь смотреть фотографии пользователя и создавать картинки и видео через инструменты.'
  },
  'jova-4.0': {
    name: 'Jova 4.0', tagline: 'Только сложные задачи: код, учёба, рассуждения',
    backend: env.JOVA_BACKEND_4 || 'claude-opus-5-5', plan: 'pro', weight: 5, maxTokens: 8192,
    features: { search: true, vision: true, media: false, code: false },
    style: 'Ты решаешь сложные задачи: программирование, математику, учёбу. Рассуждай глубоко, проверяй себя, код пиши рабочий и полный.'
  },
  'jova-5.0': {
    name: 'Jova 5.0', tagline: 'Максимальная модель. Только Max',
    backend: env.JOVA_BACKEND_5 || 'claude-fable-5-2', plan: 'max', weight: 10, maxTokens: 12000,
    features: { search: true, vision: true, media: true, code: false },
    style: 'Ты самая мощная модель Jova. Решай самые тяжёлые задачи, обучай коду, разбирай проекты целиком.'
  },
  'jova-code': {
    name: 'Jova Code', tagline: 'Видит весь проект, правит файлы. Pro и Max',
    backend: env.JOVA_BACKEND_CODE || 'claude-opus-5-5', plan: 'pro', weight: 5, codeMultiplier: 2, maxTokens: 8192,
    features: { search: true, vision: true, media: false, code: true },
    style: 'Ты Jova Code, агент для программирования. Сначала посмотри структуру проекта (list_files), прочитай нужные файлы (read_file), потом вноси правки (write_file) целыми файлами. Не гадай про содержимое — читай. В конце коротко опиши, что изменил.'
  }
};

const PLAN_ORDER = { free: 0, pro: 1, max: 2 };

// Лимиты в «жетонах Jova»: реальные токены (вход + выход) × вес модели.
// Jova Code дополнительно умножается на codeMultiplier, поэтому лимит у него кончается быстрее.
const PLANS = {
  free: { name: 'Free', price: 0,                                  hourly:   30000, weekly:   200000 },
  pro:  { name: 'Pro',  price: Number(env.JOVA_PRICE_PRO || 499),  hourly:  150000, weekly:  1000000 },
  max:  { name: 'Max',  price: Number(env.JOVA_PRICE_MAX || 1990), hourly:  600000, weekly:  5000000 }
};

module.exports = { MODELS, PLANS, PLAN_ORDER };
