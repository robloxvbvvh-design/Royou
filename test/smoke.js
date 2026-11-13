"use strict";
// Сквозная проверка API на временной базе: npm test
const os = require("node:os"), fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "royou-test-"));
process.env.DATA_DIR = dir;
const { server, db, seed } = require("../server.js");

let base, cookie = "";
async function call(method, url, body, opts = {}) {
  const r = await fetch(base + url, {
    method, redirect: "manual",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie && !opts.anon ? { Cookie: cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const sc = r.headers.get("set-cookie"); if (sc && !opts.anon) cookie = sc.split(";")[0];
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, headers: r.headers };
}
const PNG = "data:image/png;base64," + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), Buffer.alloc(32)]).toString("base64");

(async () => {
  seed();
  await new Promise(r => server.listen(0, r)); base = "http://127.0.0.1:" + server.address().port;
  let r;

  r = await call("GET", "/api/posts"); assert.equal(r.status, 200); assert.equal(r.json.posts.length, 4, "демо-посты");
  r = await call("POST", "/api/posts", { type: "ad", title: "x", link: "https://a.b" }); assert.equal(r.status, 401, "без входа нельзя");
  r = await call("POST", "/api/register", { email: "bad", name: "Аня", password: "12345678" }); assert.equal(r.status, 400);
  r = await call("POST", "/api/register", { email: "a@b.co", name: "Аня", password: "short" }); assert.equal(r.status, 400);
  r = await call("POST", "/api/register", { email: "a@b.co", name: "Аня", password: "password123" }); assert.equal(r.status, 201); assert.ok(cookie.startsWith("sid="));
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  const hash = db.prepare("SELECT pass_hash FROM users WHERE email='a@b.co'").get().pass_hash;
  assert.ok(hash.startsWith("scrypt$") && !hash.includes("password123"), "пароль хранится хешем");
  r = await call("POST", "/api/register", { email: "A@b.co", name: "Аня", password: "password123" }, { anon: true }); assert.equal(r.status, 409, "дубликат email");
  r = await call("GET", "/api/me"); assert.equal(r.json.user.email, "a@b.co");

  r = await call("POST", "/api/posts", { type: "ad", title: "Мой сайт", text: "ок", link: "javascript:alert(1)" }); assert.equal(r.status, 400, "javascript: запрещён");
  r = await call("POST", "/api/posts", { type: "ad", title: "Мой сайт", link: "https://example.org", media: "data:image/png;base64," + Buffer.from("not png").toString("base64") }); assert.equal(r.status, 400, "поддельный png");
  r = await call("POST", "/api/posts", { type: "ad", title: "Мой сайт", text: "<b>ок</b>", link: "https://example.org", media: PNG }); assert.equal(r.status, 201);
  const post = r.json.post; assert.ok(post.mine && post.media.startsWith("/uploads/"));
  r = await fetch(base + post.media); assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "image/png");

  r = await call("POST", `/api/posts/${post.id}/like`, {}); assert.deepEqual(r.json, { liked: true, likes: 1 });
  r = await call("POST", `/api/posts/${post.id}/like`, {}); assert.deepEqual(r.json, { liked: false, likes: 0 });

  r = await call("GET", post.go, undefined, { anon: true }); assert.equal(r.status, 302); assert.equal(r.headers.get("location"), "https://example.org/");
  await call("GET", post.go, undefined, { anon: true });
  r = await call("GET", "/api/me/stats"); assert.equal(r.json.totalClicks, 1, "повторный клик за час не считается");

  await call("POST", "/api/posts", { type: "idea", title: "Идея 2", link: "https://example.org" });
  await call("POST", "/api/posts", { type: "idea", title: "Идея 3", link: "https://example.org" });
  r = await call("POST", "/api/posts", { type: "idea", title: "Идея 4", link: "https://example.org" }); assert.equal(r.status, 402, "лимит тарифа Старт");

  r = await call("GET", "/../server.js", undefined, { anon: true }); assert.notEqual(r.status, 200, "нет выхода из public/");
  r = await fetch(base + "/%2e%2e/server.js"); assert.notEqual(r.status, 200);
  r = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" }); assert.equal(r.status, 415, "только JSON");

  r = await call("DELETE", `/api/posts/${post.id}`); assert.equal(r.status, 200);
  await call("POST", "/api/logout", {}); cookie = "";
  r = await call("POST", "/api/login", { email: "a@b.co", password: "wrong-password" }); assert.equal(r.status, 401);
  r = await call("POST", "/api/login", { email: "a@b.co", password: "password123" }); assert.equal(r.status, 200);
  r = await call("GET", "/"); assert.equal(r.status, 200);

  console.log("Все проверки пройдены ✔");
})().catch(e => { console.error("ПРОВАЛ:", e.message); process.exitCode = 1; })
  .finally(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); setTimeout(() => process.exit(), 100); });
