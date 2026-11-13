"use strict";
/* Royou — сервер без внешних зависимостей: Node 22.5+, встроенная SQLite. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PUBLIC = path.join(__dirname, "public");
const UPLOADS = path.join(DATA_DIR, "uploads");
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const SESSION_DAYS = 30;
const FREE_POSTS_PER_30D = 3;
const MAX_BODY = 6 * 1024 * 1024;
const MAX_MEDIA = 4 * 1024 * 1024;

fs.mkdirSync(UPLOADS, { recursive: true });
const db = new DatabaseSync(process.env.DB_FILE || path.join(DATA_DIR, "royou.db"));
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  pass_hash TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', link TEXT NOT NULL,
  media TEXT, emoji TEXT, bg TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS likes(
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(post_id,user_id));
CREATE TABLE IF NOT EXISTS clicks(
  id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_post ON clicks(post_id, viewer, created_at);
`);

/* ---------- утилиты ---------- */
const now = () => Date.now();
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`;
}
function checkPassword(pw, stored) {
  const [alg, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt") return false;
  const h = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(h, Buffer.from(hashHex, "hex"));
}
const DUMMY_HASH = hashPassword("dummy-password-for-timing");

const clientIp = req => (TRUST_PROXY && req.headers["x-forwarded-for"]?.split(",")[0].trim()) || req.socket.remoteAddress || "?";

const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const t = now(), b = (buckets.get(key) || []).filter(x => t - x < windowMs);
  if (b.length >= max) throw new HttpError(429, "Слишком много попыток. Попробуйте позже.");
  b.push(t); buckets.set(key, b);
}
setInterval(() => { const t = now(); for (const [k, v] of buckets) if (!v.some(x => t - x < 3600e3)) buckets.delete(k); }, 600e3).unref();

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach(p => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function setSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(sha(token), userId, now() + SESSION_DAYS * 864e5);
  const secure = process.env.COOKIE_SECURE === "1" || req.headers["x-forwarded-proto"] === "https";
  res.setHeader("Set-Cookie", `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure ? "; Secure" : ""}`);
}
function currentUser(req) {
  const t = parseCookies(req).sid; if (!t) return null;
  const row = db.prepare("SELECT u.id,u.email,u.name,u.plan,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?").get(sha(t));
  if (!row) return null;
  if (row.expires_at < now()) { db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha(t)); return null; }
  return row;
}
const requireUser = req => { const u = currentUser(req); if (!u) throw new HttpError(401, "Нужно войти в аккаунт"); return u; };
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, plan: u.plan });

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(req.headers["content-type"] || "")) return reject(new HttpError(415, "Ожидается JSON"));
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > MAX_BODY) { reject(new HttpError(413, "Слишком большой запрос")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(new HttpError(400, "Некорректный JSON")); } });
    req.on("error", reject);
  });
}

/* ---------- валидация ---------- */
const str = (v, max, min = 0) => { if (typeof v !== "string") throw new HttpError(400, "Неверные данные"); v = v.trim(); if (v.length < min || v.length > max) throw new HttpError(400, `Длина поля: от ${min} до ${max} символов`); return v; };
function cleanLink(v) {
  v = str(v, 500, 1);
  let u; try { u = new URL(v); } catch { throw new HttpError(400, "Некорректная ссылка"); }
  if (!/^https?:$/.test(u.protocol)) throw new HttpError(400, "Ссылка должна начинаться с http:// или https://");
  return u.href;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- медиа ---------- */
const MEDIA = {
  "image/png": ["png", b => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))],
  "image/jpeg": ["jpg", b => b[0] === 0xff && b[1] === 0xd8],
  "image/webp": ["webp", b => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP"],
  "image/gif": ["gif", b => b.subarray(0, 3).toString() === "GIF"],
  "video/mp4": ["mp4", b => b.subarray(4, 8).toString() === "ftyp"],
  "video/webm": ["webm", b => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))],
};
const EXT_TYPE = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm" };
function saveMedia(dataUrl) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m || !MEDIA[m[1]]) throw new HttpError(400, "Допустимы png, jpg, webp, gif, mp4, webm");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_MEDIA) throw new HttpError(413, "Файл больше 4 МБ");
  const [ext, magic] = MEDIA[m[1]];
  if (!magic(buf)) throw new HttpError(400, "Содержимое файла не совпадает с типом");
  const name = crypto.randomBytes(16).toString("hex") + "." + ext;
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return "/uploads/" + name;
}

/* ---------- посты ---------- */
function postsQuery(user, where = "", params = []) {
  const uid = user ? user.id : 0;
  const rows = db.prepare(`
    SELECT p.id,p.type,p.title,p.text,p.link,p.media,p.emoji,p.bg,p.created_at,p.user_id,u.name AS author,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) AS likes,
      (SELECT COUNT(*) FROM clicks c WHERE c.post_id=p.id) AS clicks,
      EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked
    FROM posts p JOIN users u ON u.id=p.user_id ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT 100`).all(uid, ...params);
  return rows.map(r => ({ id: r.id, type: r.type, title: r.title, text: r.text, media: r.media, emoji: r.emoji, bg: r.bg,
    author: r.author, likes: r.likes, clicks: r.clicks, liked: !!r.liked, mine: r.user_id === uid, created_at: r.created_at, go: "/go/" + r.id }));
}

/* ---------- API ---------- */
async function api(req, res, url) {
  const m = req.method, p = url.pathname;
  let mt;

  if (m === "GET" && p === "/api/me") { const u = currentUser(req); return send(res, 200, { user: u ? publicUser(u) : null }); }

  if (m === "POST" && p === "/api/register") {
    rateLimit("reg:" + clientIp(req), 10, 3600e3);
    const b = await readJson(req);
    const email = str(b.email, 120, 3).toLowerCase(), name = str(b.name, 40, 2), pw = str(b.password, 200);
    if (!EMAIL_RE.test(email)) throw new HttpError(400, "Некорректный email");
    if (pw.length < 8) throw new HttpError(400, "Пароль: минимум 8 символов");
    if (db.prepare("SELECT 1 FROM users WHERE email=?").get(email)) throw new HttpError(409, "Этот email уже зарегистрирован");
    const r = db.prepare("INSERT INTO users(email,name,pass_hash,created_at) VALUES(?,?,?,?)").run(email, name, hashPassword(b.password), now());
    setSession(req, res, Number(r.lastInsertRowid));
    return send(res, 201, { user: { id: Number(r.lastInsertRowid), email, name, plan: "free" } });
  }

  if (m === "POST" && p === "/api/login") {
    rateLimit("login:" + clientIp(req), 10, 600e3);
    const b = await readJson(req);
    const email = str(b.email, 120, 3).toLowerCase(), pw = str(b.password, 200, 1);
    rateLimit("loginm:" + email, 10, 600e3);
    const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
    const ok = checkPassword(pw, u ? u.pass_hash : DUMMY_HASH) && u;
    if (!ok) throw new HttpError(401, "Неверный email или пароль");
    setSession(req, res, u.id);
    return send(res, 200, { user: publicUser(u) });
  }

  if (m === "POST" && p === "/api/logout") {
    const t = parseCookies(req).sid;
    if (t) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha(t));
    res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return send(res, 200, { ok: true });
  }

  if (m === "GET" && p === "/api/posts") {
    const type = url.searchParams.get("type");
    const user = currentUser(req);
    return send(res, 200, { posts: ["ad", "idea", "course"].includes(type) ? postsQuery(user, "WHERE p.type=?", [type]) : postsQuery(user) });
  }

  if (m === "POST" && p === "/api/posts") {
    const user = requireUser(req);
    rateLimit("post:" + user.id, 20, 3600e3);
    const b = await readJson(req);
    const type = ["ad", "idea", "course"].includes(b.type) ? b.type : (() => { throw new HttpError(400, "Неверный тип"); })();
    const title = str(b.title, 80, 2), text = str(b.text ?? "", 300), link = cleanLink(b.link);
    if (user.plan === "free") {
      const n = db.prepare("SELECT COUNT(*) n FROM posts WHERE user_id=? AND created_at>?").get(user.id, now() - 30 * 864e5).n;
      if (n >= FREE_POSTS_PER_30D) throw new HttpError(402, `На тарифе «Старт» доступно ${FREE_POSTS_PER_30D} поста за 30 дней. Подключите «Про».`);
    }
    const media = b.media ? saveMedia(b.media) : null;
    const emoji = { ad: "📣", idea: "💡", course: "🎓" }[type];
    const r = db.prepare("INSERT INTO posts(user_id,type,title,text,link,media,emoji,created_at) VALUES(?,?,?,?,?,?,?,?)").run(user.id, type, title, text, link, media, emoji, now());
    return send(res, 201, { post: postsQuery(user, "WHERE p.id=?", [Number(r.lastInsertRowid)])[0] });
  }

  if ((mt = /^\/api\/posts\/(\d+)$/.exec(p)) && m === "DELETE") {
    const user = requireUser(req), id = +mt[1];
    const post = db.prepare("SELECT media FROM posts WHERE id=? AND user_id=?").get(id, user.id);
    if (!post) throw new HttpError(404, "Пост не найден");
    db.prepare("DELETE FROM posts WHERE id=?").run(id);
    if (post.media) fs.rm(path.join(UPLOADS, path.basename(post.media)), () => {});
    return send(res, 200, { ok: true });
  }

  if ((mt = /^\/api\/posts\/(\d+)\/like$/.exec(p)) && m === "POST") {
    const user = requireUser(req), id = +mt[1];
    if (!db.prepare("SELECT 1 FROM posts WHERE id=?").get(id)) throw new HttpError(404, "Пост не найден");
    const del = db.prepare("DELETE FROM likes WHERE post_id=? AND user_id=?").run(id, user.id);
    if (!del.changes) db.prepare("INSERT INTO likes VALUES(?,?)").run(id, user.id);
    const likes = db.prepare("SELECT COUNT(*) n FROM likes WHERE post_id=?").get(id).n;
    return send(res, 200, { liked: !del.changes, likes });
  }

  if (m === "GET" && p === "/api/me/stats") {
    const user = requireUser(req);
    const rows = db.prepare(`SELECT p.id,p.title,
      (SELECT COUNT(*) FROM clicks c WHERE c.post_id=p.id) clicks,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) likes
      FROM posts p WHERE p.user_id=? ORDER BY p.created_at DESC`).all(user.id);
    return send(res, 200, { posts: rows, totalClicks: rows.reduce((s, r) => s + r.clicks, 0) });
  }

  throw new HttpError(404, "Не найдено");
}

/* ---------- переход по рекламе: считаем клик на сервере ---------- */
function goRoute(req, res, id) {
  const post = db.prepare("SELECT id,link FROM posts WHERE id=?").get(id);
  if (!post) { res.writeHead(404); return res.end("Not found"); }
  const viewer = sha(clientIp(req) + "|" + (req.headers["user-agent"] || "")).slice(0, 24);
  const recent = db.prepare("SELECT 1 FROM clicks WHERE post_id=? AND viewer=? AND created_at>?").get(post.id, viewer, now() - 3600e3);
  if (!recent) db.prepare("INSERT INTO clicks(post_id,viewer,created_at) VALUES(?,?,?)").run(post.id, viewer, now());
  res.writeHead(302, { Location: post.link, "Referrer-Policy": "no-referrer" });
  res.end();
}

/* ---------- статика ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4", ".png": "image/png" };
function serveFile(req, res, file, type, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end("Not found"); }
    const head = { "Content-Type": type, "Content-Length": st.size, "Cache-Control": cache, "X-Content-Type-Options": "nosniff" };
    res.writeHead(200, head);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { res.writeHead(400); return res.end(); }
  if (rel.startsWith("/uploads/")) {
    const name = path.basename(rel), ext = path.extname(name).slice(1);
    if (!EXT_TYPE[ext]) { res.writeHead(404); return res.end(); }
    return serveFile(req, res, path.join(UPLOADS, name), EXT_TYPE[ext], "public, max-age=31536000, immutable");
  }
  if (rel === "/") rel = "/index.html";
  const file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  serveFile(req, res, file, TYPES[path.extname(file)] || "application/octet-stream", "no-cache");
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; media-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  try {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    let g;
    if ((g = /^\/go\/(\d+)$/.exec(url.pathname)) && req.method === "GET") return goRoute(req, res, +g[1]);
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Метод не поддерживается");
    serveStatic(req, res, url.pathname);
  } catch (e) {
    if (res.headersSent) return res.end();
    if (e instanceof HttpError) return send(res, e.code, { error: e.message });
    console.error(e); send(res, 500, { error: "Внутренняя ошибка сервера" });
  }
});

/* ---------- демо-данные для пустой базы ---------- */
function seed() {
  if (db.prepare("SELECT COUNT(*) n FROM posts").get().n) return;
  const r = db.prepare("INSERT INTO users(email,name,pass_hash,plan,created_at) VALUES(?,?,?,?,?)").run("team@royou.local", "Команда Royou", "disabled$x$x", "pro", now());
  const uid = Number(r.lastInsertRowid);
  const ins = db.prepare("INSERT INTO posts(user_id,type,title,text,link,emoji,bg,created_at) VALUES(?,?,?,?,?,?,?,?)");
  [["ad", "Школа английского Lingo", "Говори свободно за 3 месяца. Первый урок бесплатно.", "🗣️", "linear-gradient(135deg,#34c759,#b6f2c9)"],
   ["idea", "Идея: приложение для обмена книгами", "Фоткаешь книгу — находишь соседа, который хочет её обменять.", "📚", "linear-gradient(135deg,#ffd60a,#fff3b0)"],
   ["course", "Курс: монтаж на телефоне", "12 коротких уроков. Сделай видео как у блогеров.", "🎞️", "linear-gradient(135deg,#0a84ff,#bfe0ff)"],
   ["ad", "GreenBox — доставка еды", "Свежие продукты за 30 минут. Промокод ROYOU.", "🥗", "linear-gradient(135deg,#30d158,#d9f7e4)"],
  ].forEach(([t, ti, tx, e, bg], i) => ins.run(uid, t, ti, tx, "https://example.com", e, bg, now() - i * 1000));
}

if (require.main === module) {
  seed();
  server.listen(PORT, () => console.log(`Royou: http://localhost:${PORT}`));
}
module.exports = { server, db, seed };
