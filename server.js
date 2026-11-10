'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { composeSite } = require('./public/compose.js');

if (fs.existsSync(path.join(__dirname, '.env'))) process.loadEnvFile(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const CODE_TTL_MS = 10 * 60 * 1000; // код живёт 10 минут
const RESEND_WAIT_MS = 60 * 1000; // повторная отправка не чаще раза в минуту
const MAX_CODE_ATTEMPTS = 5;
const MAX_CODES_PER_IP_PER_HOUR = 10;
const MAX_SITES_PER_USER = 20;
const MAX_BODY_BYTES = 600 * 1024;
const MAX_FIELD_CHARS = 200 * 1000;

// ---------- Хранилище ----------

let db = { tokens: {}, sites: {} };
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

function saveDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

// ---------- Почта ----------

const smtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
let transporter = null;
if (smtpReady) {
  const port = Number(process.env.SMTP_PORT) || 465;
  transporter = require('nodemailer').createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendCode(email, code) {
  if (!transporter) {
    console.log(`[почта не настроена] код для ${email}: ${code}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: `${code} — ваш код для входа в Royou`,
    text: `Ваш код для входа: ${code}\n\nКод действует 10 минут. Если вы не запрашивали код, просто не отвечайте на это письмо.`,
    html: `<div style="font-family:Arial,sans-serif;font-size:16px;color:#1c1b22">
      <p>Ваш код для входа в Royou:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>
      <p style="color:#6b6a75">Код действует 10 минут. Если вы не запрашивали код, просто не отвечайте на это письмо.</p>
    </div>`,
  });
}

// ---------- Коды входа (в памяти) ----------

const pendingCodes = new Map(); // email -> { hash, expires, attempts, sentAt }
const ipHits = new Map(); // ip -> [время запросов]

function ipAllowed(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (hits.length >= MAX_CODES_PER_IP_PER_HOUR) return false;
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of pendingCodes) if (entry.expires < now) pendingCodes.delete(email);
}, 60 * 1000).unref();

// ---------- Вспомогательное ----------

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Слишком большой запрос'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const data = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
        resolve(data);
      } catch {
        reject(Object.assign(new Error('Неверный формат запроса'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function currentUser(req) {
  const match = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || '');
  if (!match) return null;
  const hash = sha256(match[1]);
  return Object.hasOwn(db.tokens, hash) ? db.tokens[hash] : null;
}

function cleanField(value, limit) {
  return typeof value === 'string' ? value.slice(0, limit) : '';
}

function publicSite(id, site) {
  return { id, name: site.name, html: site.html, css: site.css, js: site.js, updatedAt: site.updatedAt };
}

// ---------- API ----------

async function handleApi(req, res, route) {
  if (route === '/api/auth/request-code' && req.method === 'POST') {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    if (!email) return sendJson(res, 400, { error: 'Введите правильный адрес почты' });

    const existing = pendingCodes.get(email);
    const now = Date.now();
    if (existing && now - existing.sentAt < RESEND_WAIT_MS) {
      const wait = Math.ceil((RESEND_WAIT_MS - (now - existing.sentAt)) / 1000);
      return sendJson(res, 429, { error: `Код уже отправлен. Повторить можно через ${wait} с` });
    }
    if (!ipAllowed(req.socket.remoteAddress)) {
      return sendJson(res, 429, { error: 'Слишком много запросов. Попробуйте позже' });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    pendingCodes.set(email, { hash: sha256(code), expires: now + CODE_TTL_MS, attempts: 0, sentAt: now });
    try {
      await sendCode(email, code);
    } catch (err) {
      pendingCodes.delete(email);
      console.error('Не удалось отправить письмо:', err.message);
      return sendJson(res, 502, { error: 'Не удалось отправить письмо. Попробуйте позже' });
    }
    return sendJson(res, 200, { ok: true, mailConfigured: smtpReady });
  }

  if (route === '/api/auth/verify' && req.method === 'POST') {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const code = String(body.code || '').trim();
    const entry = email && pendingCodes.get(email);
    if (!entry || entry.expires < Date.now()) {
      return sendJson(res, 400, { error: 'Код устарел. Запросите новый' });
    }
    entry.attempts += 1;
    if (entry.attempts > MAX_CODE_ATTEMPTS) {
      pendingCodes.delete(email);
      return sendJson(res, 400, { error: 'Слишком много попыток. Запросите новый код' });
    }
    const ok = crypto.timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(entry.hash));
    if (!ok) return sendJson(res, 400, { error: 'Неверный код' });

    pendingCodes.delete(email);
    const token = crypto.randomBytes(24).toString('base64url');
    db.tokens[sha256(token)] = email;
    saveDb();
    return sendJson(res, 200, { token, email });
  }

  const email = currentUser(req);
  if (!email) return sendJson(res, 401, { error: 'Нужно войти заново' });

  if (route === '/api/me' && req.method === 'GET') return sendJson(res, 200, { email });

  if (route === '/api/logout' && req.method === 'POST') {
    const token = /^Bearer\s+(\S+)$/.exec(req.headers.authorization)[1];
    delete db.tokens[sha256(token)];
    saveDb();
    return sendJson(res, 200, { ok: true });
  }

  if (route === '/api/sites' && req.method === 'GET') {
    const sites = Object.entries(db.sites)
      .filter(([, site]) => site.owner === email)
      .map(([id, site]) => ({ id, name: site.name, updatedAt: site.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return sendJson(res, 200, { sites });
  }

  if (route === '/api/sites' && req.method === 'POST') {
    const count = Object.values(db.sites).filter((site) => site.owner === email).length;
    if (count >= MAX_SITES_PER_USER) {
      return sendJson(res, 400, { error: `Можно создать не больше ${MAX_SITES_PER_USER} сайтов` });
    }
    const body = await readJson(req);
    const id = crypto.randomBytes(6).toString('base64url');
    db.sites[id] = {
      owner: email,
      name: cleanField(body.name, 80).trim() || 'Новый сайт',
      html: cleanField(body.html, MAX_FIELD_CHARS),
      css: cleanField(body.css, MAX_FIELD_CHARS),
      js: cleanField(body.js, MAX_FIELD_CHARS),
      updatedAt: Date.now(),
    };
    saveDb();
    return sendJson(res, 201, { site: publicSite(id, db.sites[id]) });
  }

  const siteMatch = /^\/api\/sites\/([\w-]{1,32})$/.exec(route);
  if (siteMatch) {
    const id = siteMatch[1];
    const site = Object.hasOwn(db.sites, id) ? db.sites[id] : null;
    if (!site || site.owner !== email) return sendJson(res, 404, { error: 'Сайт не найден' });

    if (req.method === 'GET') return sendJson(res, 200, { site: publicSite(id, site) });

    if (req.method === 'PUT') {
      const body = await readJson(req);
      site.name = cleanField(body.name, 80).trim() || 'Без названия';
      site.html = cleanField(body.html, MAX_FIELD_CHARS);
      site.css = cleanField(body.css, MAX_FIELD_CHARS);
      site.js = cleanField(body.js, MAX_FIELD_CHARS);
      site.updatedAt = Date.now();
      saveDb();
      return sendJson(res, 200, { site: publicSite(id, site) });
    }

    if (req.method === 'DELETE') {
      delete db.sites[id];
      saveDb();
      return sendJson(res, 200, { ok: true });
    }
  }

  return sendJson(res, 404, { error: 'Не найдено' });
}

// ---------- Страницы ----------

const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  // У конструктора нет строгой политики: её унаследовал бы предпросмотр сайта.
  // Предпросмотр изолирован атрибутом sandbox у iframe.
  '/app': ['app.html', 'text/html; charset=utf-8', "frame-ancestors 'none'"],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/login.js': ['login.js', 'text/javascript; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/compose.js': ['compose.js', 'text/javascript; charset=utf-8'],
};

const PAGE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
const STRICT_CSP = "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'";

const server = http.createServer(async (req, res) => {
  try {
    const route = new URL(req.url, 'http://localhost').pathname;

    if (route.startsWith('/api/')) return await handleApi(req, res, route);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end();
    }

    // Опубликованные сайты пользователей. Заголовок sandbox изолирует их
    // от основного сайта: чужой код не может прочитать токены посетителей.
    const published = /^\/s\/([\w-]{1,32})\/?$/.exec(route);
    if (published && Object.hasOwn(db.sites, published[1])) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': 'sandbox allow-scripts allow-forms allow-popups allow-modals',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      });
      return res.end(composeSite(db.sites[published[1]]));
    }

    const file = Object.hasOwn(STATIC_FILES, route) ? STATIC_FILES[route] : null;
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Страница не найдена');
    }
    res.writeHead(200, {
      ...PAGE_HEADERS,
      'Content-Security-Policy': file[2] || STRICT_CSP,
      'Content-Type': file[1],
      'Cache-Control': 'no-cache',
    });
    return res.end(fs.readFileSync(path.join(PUBLIC_DIR, file[0])));
  } catch (err) {
    if (!err.status) console.error(err);
    if (!res.headersSent) sendJson(res, err.status || 500, { error: err.status ? err.message : 'Ошибка сервера' });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Сайт запущен: http://localhost:${PORT}`);
  if (!smtpReady) console.log('Почта не настроена: коды входа будут печататься здесь, в консоли. См. .env.example');
});
