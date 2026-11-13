// Инструменты, которые Jova вызывает сама: поиск в интернете, чтение страниц, файлы проекта, генерация медиа.
const fs = require('fs');
const path = require('path');

const WORKSPACE = path.resolve(process.env.JOVA_WORKSPACE || path.join(__dirname, 'workspace'));
fs.mkdirSync(WORKSPACE, { recursive: true });

const stripHtml = (h) => h
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim();

// Структурированный поиск: [{title, url, snippet}]. Без ключа — HTML-выдача DuckDuckGo, с TAVILY_API_KEY — Tavily.
async function searchResults(query, n = 6) {
  if (process.env.TAVILY_API_KEY) {
    const r = await fetch(process.env.TAVILY_URL || 'https://api.tavily.com/search', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.TAVILY_API_KEY },
      body: JSON.stringify({ query, max_results: n })
    });
    if (!r.ok) throw new Error('поиск недоступен: ' + r.status);
    const j = await r.json();
    return (j.results || []).map(x => ({ title: x.title || '', url: x.url, snippet: (x.content || '').slice(0, 900) }));
  }
  const r = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), { headers: { 'user-agent': 'Mozilla/5.0 JovaBot' } });
  if (!r.ok) throw new Error('поиск недоступен: ' + r.status);
  const html = await r.text();
  const out = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && out.length < n) {
    let url = m[1];
    const u = /uddg=([^&]+)/.exec(url); if (u) url = decodeURIComponent(u[1]);
    out.push({ title: stripHtml(m[2]), url, snippet: stripHtml(m[3]) });
  }
  return out;
}
// Текст абзацев страницы (для «своей» модели, которой нужен подробный контекст).
async function pageParagraphs(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 JovaBot' }, signal: ctl.signal });
    if (!r.ok) return '';
    const html = await r.text(), ps = [];
    for (const m of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) { const x = stripHtml(m[1]); if (x.length > 60) ps.push(x); if (ps.join(' ').length > 2500) break; }
    return ps.join(' ');
  } catch { return ''; } finally { clearTimeout(t); }
}
async function webSearch({ query }) {
  const res = await searchResults(query);
  return res.map(x => `${x.title}\n${x.url}\n${x.snippet.slice(0, 400)}`).join('\n\n') || 'Ничего не найдено';
}

async function fetchUrl({ url }) {
  if (!/^https?:\/\//i.test(url)) throw new Error('нужен http(s) адрес');
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 JovaBot' }, redirect: 'follow' });
  if (!r.ok) throw new Error('страница вернула ' + r.status);
  const t = await r.text();
  return stripHtml(t).slice(0, 8000);
}

// Все пути проекта проверяются: выйти за пределы workspace нельзя.
function safe(rel) {
  const p = path.resolve(WORKSPACE, rel || '.');
  if (p !== WORKSPACE && !p.startsWith(WORKSPACE + path.sep)) throw new Error('путь вне проекта');
  return p;
}
function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out); else out.push(path.relative(base, full));
  }
  return out;
}
const listFiles = async () => walk(WORKSPACE).join('\n') || '(проект пуст)';
const readFile = async ({ path: p }) => {
  const f = safe(p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) throw new Error('файла нет');
  return fs.readFileSync(f, 'utf8').slice(0, 60000);
};
const writeFile = async ({ path: p, content }) => {
  const f = safe(p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  return `Записано ${p} (${content.length} символов)`;
};

async function generateImage({ prompt }) {
  const ep = process.env.JOVA_IMAGE_ENDPOINT;
  if (!ep) throw new Error('генерация картинок не подключена: задайте JOVA_IMAGE_ENDPOINT и JOVA_IMAGE_KEY (OpenAI-совместимый /images/generations)');
  const r = await fetch(ep, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (process.env.JOVA_IMAGE_KEY || '') },
    body: JSON.stringify({ model: process.env.JOVA_IMAGE_MODEL || undefined, prompt, n: 1 })
  });
  if (!r.ok) throw new Error('сервис картинок ответил ' + r.status);
  const j = await r.json(); const d = j.data && j.data[0];
  if (!d) throw new Error('пустой ответ сервиса картинок');
  return d.url ? `IMAGE_URL:${d.url}` : `IMAGE_B64:${d.b64_json}`;
}
async function generateVideo({ prompt }) {
  const ep = process.env.JOVA_VIDEO_ENDPOINT;
  if (!ep) throw new Error('генерация видео не подключена: задайте JOVA_VIDEO_ENDPOINT (POST {prompt} → {url})');
  const r = await fetch(ep, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (process.env.JOVA_VIDEO_KEY || '') },
    body: JSON.stringify({ prompt })
  });
  if (!r.ok) throw new Error('сервис видео ответил ' + r.status);
  const j = await r.json(); if (!j.url) throw new Error('сервис видео не вернул url');
  return `VIDEO_URL:${j.url}`;
}

const DEFS = {
  web_search: { description: 'Поиск в интернете. Используй для свежих фактов, новостей, цен, всего, что могло измениться.', schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, run: webSearch },
  fetch_url: { description: 'Открыть страницу по ссылке и прочитать её текст.', schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }, run: fetchUrl },
  list_files: { description: 'Список всех файлов проекта пользователя.', schema: { type: 'object', properties: {} }, run: listFiles },
  read_file: { description: 'Прочитать файл проекта по относительному пути.', schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }, run: readFile },
  write_file: { description: 'Создать или полностью перезаписать файл проекта.', schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }, run: writeFile },
  generate_image: { description: 'Создать картинку по описанию.', schema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] }, run: generateImage },
  generate_video: { description: 'Создать короткое видео по описанию.', schema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] }, run: generateVideo }
};

function toolsFor(model, searchOn) {
  const names = [];
  if (searchOn && model.features.search) names.push('web_search', 'fetch_url');
  if (model.features.code) names.push('list_files', 'read_file', 'write_file');
  if (model.features.media) names.push('generate_image', 'generate_video');
  return names.map(n => ({ name: n, description: DEFS[n].description, input_schema: DEFS[n].schema }));
}

module.exports = { DEFS, toolsFor, WORKSPACE, walk, searchResults, pageParagraphs };
