// Подставной «сервер» внутри страницы: те же /api/..., но отвечает собственная модель прямо в браузере.
(function () {
  const MODELS = [
    ['jova-1.0', 'Jova 1.0', 'Своя модель. Работает прямо в браузере', 'free', { search: false, vision: false, media: false, code: false }],
    ['jova-2.0', 'Jova 2.0', 'Для чуть более сложных и повседневных задач', 'free', { search: true, vision: false, media: false, code: false }],
    ['jova-3.0', 'Jova 3.0', 'Флагман. Картинки, видео, загрузка фото', 'pro', { search: true, vision: true, media: true, code: false }],
    ['jova-4.0', 'Jova 4.0', 'Только сложные задачи: код, учёба, рассуждения', 'pro', { search: true, vision: true, media: false, code: false }],
    ['jova-5.0', 'Jova 5.0', 'Максимальная модель. Только Max', 'max', { search: true, vision: true, media: true, code: false }],
    ['jova-code', 'Jova Code', 'Видит весь проект, правит файлы. Pro и Max', 'pro', { search: true, vision: true, media: false, code: true }]
  ].map(([id, name, tagline, plan, features]) => ({ id, name, tagline, plan, features }));
  const PLANS = { free: { name: 'Free', hourly: 30000, weekly: 200000 }, pro: { name: 'Pro', hourly: 150000, weekly: 1000000 }, max: { name: 'Max', hourly: 600000, weekly: 5000000 } };
  const HOUR = 3600e3, WEEK = 7 * HOUR * 24;
  let usage = [];
  try { usage = JSON.parse(localStorage.jova_web_usage || '[]'); } catch {}
  let plan = 'free'; try { plan = localStorage.jova_web_plan || 'free'; } catch {}
  const saveU = () => { try { localStorage.jova_web_usage = JSON.stringify(usage); } catch {} };
  const state = () => { const now = Date.now(); usage = usage.filter(e => now - e.t < WEEK);
    const sum = ms => usage.filter(e => now - e.t < ms).reduce((a, e) => a + e.c, 0);
    return { plan, planName: PLANS[plan].name, until: plan === 'free' ? null : Date.now() + 30 * 864e5, hour: { used: sum(HOUR), limit: PLANS[plan].hourly, resetMin: 60 }, week: { used: sum(WEEK), limit: PLANS[plan].weekly, resetMin: 10080 } }; };
  const engine = JovaEngine(window.JOVA_PACK);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const json = o => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });

  function chat(body) {
    const enc = new TextEncoder();
    return new Response(new ReadableStream({ async start(c) {
      const send = o => c.enqueue(enc.encode('data: ' + JSON.stringify(o) + '\n\n'));
      const say = async t => { for (let i = 0; i < t.length; i += 3) { send({ type: 'text', delta: t.slice(i, i + 3) }); await sleep(18); } };
      try {
        if (body.model !== 'jova-1.0') { send({ type: 'error', code: 'error', message: 'В этой версии сайта работает только Jova 1.0. Остальные модели нужны сервер и ключ (см. README).' }); return; }
        const last = [...body.messages].reverse().find(m => m.role === 'user'), text = last ? last.content : '';
        if (!engine.isKnown(text)) { await say('Эта версия сайта работает без интернета: моя модель умеет отвечать на приветствия и рассказывать о себе и о тарифах Jova. Искать в интернете я умею в полной версии на сервере.'); send({ type: 'done' }); return; }
        const ids = []; for (const t of engine.generate(text, 200)) { ids.push(t); send({ type: 'think', ids: [t] }); await sleep(12); }
        const dec = new TextDecoder('utf-8'); await say(dec.decode(new Uint8Array(ids.flatMap(i => Array.from(engine.piece(i))))));
        usage.push({ t: Date.now(), c: engine.encode(text).length + ids.length }); saveU(); send({ type: 'usage', usage: state() }); send({ type: 'done' });
      } catch (e) { send({ type: 'error', message: e.message }); } finally { c.close(); } } }), { headers: { 'content-type': 'text/event-stream' } });
  }
  window.fetch = async (url, opts) => {
    const u = String(url);
    if (u.startsWith('/api/state')) return json({ usage: state(), ready: false, ownReady: true, devUpgrade: true, models: MODELS, plans: PLANS });
    if (u.startsWith('/api/chat')) return chat(JSON.parse(opts.body));
    if (u.startsWith('/api/plan')) { const b = JSON.parse(opts.body); if (!PLANS[b.plan]) return new Response('{}', { status: 400 }); plan = b.plan; try { localStorage.jova_web_plan = plan; } catch {} return json({ usage: state() }); }
    if (u.startsWith('/api/files')) return json({ files: [] });
    return new Response('{}', { status: 404 });
  };
})();
