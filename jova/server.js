// Jova — сервер. Без зависимостей, Node 18+.  Запуск: ANTHROPIC_API_KEY=... node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MODELS, PLANS, PLAN_ORDER } = require('./config');
const pay = require('./payments');
const { DEFS, toolsFor, WORKSPACE, walk, searchResults, pageParagraphs } = require('./tools');

const PORT = process.env.PORT || 3000;
const API_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DATA_FILE = path.join(__dirname, 'data', 'users.json');
const HOUR = 3600e3, WEEK = 7 * 24 * HOUR;

// ---------- пользователи и токены ----------
let users = {};
try { users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(users));
function getUser(id) {
  if (!/^[\w-]{8,64}$/.test(id || '')) return null;
  if (!users[id]) users[id] = { plan: 'free', usage: [] };
  const u = users[id], now = Date.now();
  if (u.until && u.until < now) { u.plan = 'free'; delete u.until; save(); }   // срок оплаты вышел
  u.usage = u.usage.filter(e => now - e.t < WEEK);
  return u;
}
function usageOf(u) {
  const now = Date.now();
  const sum = (ms) => u.usage.filter(e => now - e.t < ms).reduce((a, e) => a + e.c, 0);
  const plan = PLANS[u.plan];
  const oldest = (ms) => { const w = u.usage.filter(e => now - e.t < ms); return w.length ? Math.ceil((w[0].t + ms - now) / 60000) : 0; };
  return {
    plan: u.plan, planName: plan.name, until: u.until || null,
    hour: { used: sum(HOUR), limit: plan.hourly, resetMin: oldest(HOUR) },
    week: { used: sum(WEEK), limit: plan.weekly, resetMin: oldest(WEEK) }
  };
}
const limitHit = (usage) => usage.hour.used >= usage.hour.limit ? 'hour' : usage.week.used >= usage.week.limit ? 'week' : null;
function charge(u, model, inTok, outTok) {
  const cost = Math.ceil((inTok + outTok) * model.weight * (model.codeMultiplier || 1));
  u.usage.push({ t: Date.now(), c: cost }); save();
  return cost;
}

// ---------- запрос к модели ----------
const systemPrompt = (model) => `Ты Jova — ИИ-ассистент (${model.name}). Сегодня ${new Date().toISOString().slice(0, 10)}.
Характер: прямой, живой, с лёгким чувством юмора и без занудства. Говори по делу, без канцелярита и лишних извинений. Если не знаешь — так и скажи, не выдумывай. Отвечай на языке пользователя.
Каждый ответ ты пишешь сама под конкретный вопрос. Для свежих фактов и всего, что могло измениться, используй инструмент web_search и указывай источники. Код пиши рабочий, в блоках с указанием языка.
Если спросят, на какой технологии ты построена, скажи, что подробностей об этом у тебя нет. Не придумывай ложных фактов о своём происхождении.
${model.style}`;

function toApiMessages(msgs, model) {
  return msgs.map(m => {
    if (m.role === 'assistant') return { role: 'assistant', content: String(m.content || '') || '…' };
    const imgs = (m.images || []).slice(0, 4).map(d => {
      const x = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(d);
      if (!x) throw new Error('неподдерживаемый формат фото');
      return { type: 'image', source: { type: 'base64', media_type: x[1], data: x[2] } };
    });
    if (imgs.length && !model.features.vision) throw new Error(`${model.name} не умеет смотреть фото. Выберите Jova 3.0 или выше.`);
    return { role: 'user', content: imgs.length ? [...imgs, { type: 'text', text: String(m.content || '(см. фото)') }] : String(m.content || '') };
  });
}

async function* streamClaude(body) {
  const r = await fetch(API_BASE + '/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ ...body, stream: true })
  });
  if (!r.ok) throw new Error('модель недоступна (' + r.status + '): ' + (await r.text()).slice(0, 300));
  let buf = '';
  const dec = new TextDecoder();
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = block.split('\n').find(l => l.startsWith('data:'));
      if (data) { try { yield JSON.parse(data.slice(5)); } catch {} }
    }
  }
}

async function handleOwn(u, model, body, send) {
  const last = [...(body.messages || [])].reverse().find(m => m.role === 'user');
  const text = last ? last.content : '', OWN = process.env.JOVA_OWN_URL;
  const post = (p, o) => fetch(OWN + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
  const known = (await (await post('/known', { text })).json()).known;
  let sources = [];
  if (!known && body.search !== false) {
    // Своя модель не знает фактов: сначала ищем в интернете, потом она собирает ответ из найденного.
    send({ type: 'tool', name: 'web_search', input: { query: text } });
    try {
      sources = await searchResults(text, 5);
      await Promise.all(sources.slice(0, 3).map(async s => { const p = await pageParagraphs(s.url); if (p) s.snippet = (s.snippet + ' ' + p).slice(0, 3000); }));
      send({ type: 'sources', items: sources.map(s => ({ title: s.title, url: s.url })) });
    } catch (e) { send({ type: 'text', delta: 'Поиск в интернете сейчас недоступен: ' + e.message }); send({ type: 'tool_done', name: 'web_search', error: true }); return; }
    send({ type: 'tool_done', name: 'web_search', error: false });
  }
  const r = await post('/generate', { text, sources, max_tokens: model.maxTokens });
  if (!r.ok) throw new Error('собственная модель недоступна (' + r.status + ')');
  let buf = '', inTok = 0, outTok = 0; const dec = new TextDecoder();
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true }); let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (!line.startsWith('data:')) continue;
      const d = JSON.parse(line.slice(5));
      if (d.think) send({ type: 'think', ids: d.think });
      if (d.delta) send({ type: 'text', delta: d.delta });
      if (d.usage) { inTok = d.usage.input; outTok = d.usage.output; }
    }
  }
  charge(u, model, inTok, outTok); send({ type: 'usage', usage: usageOf(u) });
}

async function handleChat(req, res, body) {
  const send = (o) => res.write('data: ' + JSON.stringify(o) + '\n\n');
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  let closed = false; res.on('close', () => { closed = true; });
  try {
    const u = getUser(body.userId); if (!u) throw new Error('неизвестный пользователь');
    const model = MODELS[body.model]; if (!model) throw new Error('неизвестная модель');
    if (PLAN_ORDER[u.plan] < PLAN_ORDER[model.plan]) throw Object.assign(new Error(`${model.name} доступна с подпиской ${PLANS[model.plan].name}`), { code: 'plan' });
    if (model.provider !== 'own' && !API_KEY) throw new Error('на сервере не задан ANTHROPIC_API_KEY');
    let usage = usageOf(u), hit = limitHit(usage);
    if (hit) throw Object.assign(new Error(hit === 'hour' ? `Часовой лимит исчерпан. Обновится через ${usage.hour.resetMin} мин.` : `Недельный лимит исчерпан. Обновится через ${Math.ceil(usage.week.resetMin / 60)} ч.`), { code: 'limit' });

    if (model.provider === 'own') { await handleOwn(u, model, body, send); send({ type: 'done' }); return res.end(); }
    const messages = toApiMessages(body.messages || [], model);
    const tools = toolsFor(model, body.search !== false);

    for (let step = 0; step < 10 && !closed; step++) {
      const blocks = []; let stop = null, inTok = 0, outTok = 0;
      const req2 = { model: model.backend, max_tokens: model.maxTokens, system: systemPrompt(model), messages };
      if (tools.length) req2.tools = tools;
      for await (const ev of streamClaude(req2)) {
        if (closed) break;
        if (ev.type === 'message_start') inTok = ev.message.usage.input_tokens || 0;
        else if (ev.type === 'content_block_start') blocks[ev.index] = { ...ev.content_block, json: '', text: ev.content_block.text || '' };
        else if (ev.type === 'content_block_delta') {
          const b = blocks[ev.index];
          if (ev.delta.type === 'text_delta') { b.text += ev.delta.text; send({ type: 'text', delta: ev.delta.text }); }
          else if (ev.delta.type === 'input_json_delta') b.json += ev.delta.partial_json;
        } else if (ev.type === 'message_delta') { stop = ev.delta.stop_reason; outTok = ev.usage.output_tokens || 0; }
      }
      charge(u, model, inTok, outTok);
      send({ type: 'usage', usage: usageOf(u) });
      if (stop !== 'tool_use') break;

      const content = blocks.filter(Boolean).map(b => b.type === 'tool_use'
        ? { type: 'tool_use', id: b.id, name: b.name, input: b.json ? JSON.parse(b.json) : {} }
        : { type: 'text', text: b.text });
      messages.push({ role: 'assistant', content });
      const results = [];
      for (const c of content.filter(c => c.type === 'tool_use')) {
        send({ type: 'tool', name: c.name, input: c.input });
        let out, isErr = false;
        try {
          if (!tools.some(t => t.name === c.name)) throw new Error('инструмент недоступен для этой модели');
          out = String(await DEFS[c.name].run(c.input));
          if (c.name === 'write_file') send({ type: 'file', path: c.input.path });
          if (/^(IMAGE_URL|IMAGE_B64|VIDEO_URL):/.test(out)) { send({ type: 'media', value: out }); out = 'Готово, медиа показано пользователю.'; }
        } catch (e) { out = 'Ошибка: ' + e.message; isErr = true; }
        send({ type: 'tool_done', name: c.name, error: isErr });
        results.push({ type: 'tool_result', tool_use_id: c.id, content: out.slice(0, 20000), is_error: isErr });
      }
      messages.push({ role: 'user', content: results });
      usage = usageOf(u);
      if (limitHit(usage)) { send({ type: 'error', code: 'limit', message: 'Лимит исчерпан посреди задачи.' }); break; }
    }
    send({ type: 'done' });
  } catch (e) {
    send({ type: 'error', code: e.code || 'error', message: e.message });
  }
  res.end();
}

// ---------- HTTP ----------
const readRaw = (req) => new Promise((ok, no) => {
  let s = ''; req.on('data', c => { s += c; if (s.length > 25e6) { no(new Error('слишком большой запрос')); req.destroy(); } });
  req.on('end', () => ok(s));
});
const readBody = async (req) => JSON.parse((await readRaw(req)) || '{}');
function applyPaid(p) {
  const u = p && ['pro', 'max'].includes(p.plan) ? getUser(p.userId) : null;
  if (!u) return false;
  u.paid = u.paid || [];
  if (u.paid.includes(p.id)) return true;                                   // повторное уведомление
  const keep = u.plan === p.plan && u.until > Date.now() ? u.until : Date.now();   // продление идёт от конца срока
  u.plan = p.plan; u.until = keep + pay.DAYS * 864e5; u.paid.push(p.id); save();
  return true;
}
const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const u = getUser(url.searchParams.get('user')); if (!u) return json(res, 400, { error: 'bad user' });
      return json(res, 200, {
        usage: usageOf(u), ready: !!API_KEY, ownReady: !!process.env.JOVA_OWN_URL, devUpgrade: process.env.NODE_ENV !== 'production' && !pay.provider(), payments: pay.provider(),
        models: Object.entries(MODELS).map(([id, m]) => ({ id, name: m.name, tagline: m.tagline, plan: m.plan, features: m.features })),
        plans: PLANS
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') return handleChat(req, res, await readBody(req));
    if (req.method === 'POST' && url.pathname === '/api/checkout') {
      const b = await readBody(req), u = getUser(b.userId), plan = PLANS[b.plan];
      if (!u || !plan || !plan.price) return json(res, 400, { error: 'bad request' });
      if (!pay.provider()) return json(res, 503, { error: 'оплата не подключена' });
      const base = process.env.PUBLIC_URL || ('http://' + req.headers.host);
      try { return json(res, 200, { url: await pay.createCheckout({ userId: b.userId, plan: b.plan, price: plan.price, name: plan.name, base }) }); }
      catch (e) { return json(res, 502, { error: e.message }); }
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/pay/')) {
      const raw = await readRaw(req);
      let ok = null; try { ok = await pay.confirmWebhook(url.pathname.split('/').pop(), raw, req.headers); } catch {}
      if (ok) applyPaid(ok);
      res.writeHead(ok ? 200 : 400); return res.end();
    }
    if (req.method === 'POST' && url.pathname === '/api/plan') {
      // Ручное переключение тарифа — только для разработки и только пока оплата не подключена.
      if (process.env.NODE_ENV === 'production' || pay.provider()) return json(res, 403, { error: 'оплата не подключена' });
      const b = await readBody(req), u = getUser(b.userId);
      if (!u || !PLANS[b.plan]) return json(res, 400, { error: 'bad request' });
      u.plan = b.plan; save(); return json(res, 200, { usage: usageOf(u) });
    }
    if (req.method === 'GET' && url.pathname === '/api/files') return json(res, 200, { files: walk(WORKSPACE) });
    if (req.method === 'GET' && url.pathname === '/api/file') {
      const f = path.resolve(WORKSPACE, url.searchParams.get('path') || '');
      if (!f.startsWith(WORKSPACE + path.sep) || !fs.existsSync(f)) return json(res, 404, { error: 'нет файла' });
      return json(res, 200, { content: fs.readFileSync(f, 'utf8') });
    }
    if (req.method === 'GET') {
      const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const f = path.resolve(__dirname, 'public', rel);
      if (!f.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); res.end();
  } catch (e) { if (!res.headersSent) json(res, 500, { error: e.message }); else res.end(); }
}).listen(PORT, () => console.log(`Jova на http://localhost:${PORT}  (ключ модели: ${API_KEY ? 'есть' : 'НЕ ЗАДАН'})`));
