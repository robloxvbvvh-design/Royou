"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast("Не хватает места в браузере"); } }
};
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2600);
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : "#"; } catch { return "#"; } };

/* ---------- Персонаж ---------- */
const mascotSVG = `<svg viewBox="0 0 200 200" aria-label="Талисман Royou">
  <defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fe38a"/><stop offset="1" stop-color="#0a9d4a"/></linearGradient></defs>
  <ellipse cx="100" cy="188" rx="55" ry="8" fill="rgba(0,0,0,.12)"/>
  <path d="M100 18c-8-14-26-14-30-6 14 0 22 4 30 6z" fill="#0a9d4a"/>
  <rect x="25" y="30" width="150" height="150" rx="62" fill="url(#mg)"/>
  <ellipse cx="72" cy="50" rx="30" ry="14" fill="#fff" opacity=".25"/>
  <g class="eye"><ellipse cx="72" cy="95" rx="13" ry="17" fill="#fff"/><circle cx="75" cy="98" r="8" fill="#1d1d1f"/></g>
  <g class="eye"><ellipse cx="128" cy="95" rx="13" ry="17" fill="#fff"/><circle cx="131" cy="98" r="8" fill="#1d1d1f"/></g>
  <circle cx="52" cy="125" r="9" fill="#ff8fa3" opacity=".6"/><circle cx="148" cy="125" r="9" fill="#ff8fa3" opacity=".6"/>
  <path d="M80 125q20 22 40 0" stroke="#1d1d1f" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`;
$$(".mascot").forEach(m => m.innerHTML = mascotSVG);

/* ---------- Счётчики ---------- */
$$("[data-count]").forEach(el => {
  const to = +el.dataset.count, t0 = performance.now();
  (function tick(t) {
    const p = Math.min(1, (t - t0) / 1600);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString("ru-RU");
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
});

/* ---------- Курсы ---------- */
const COURSES = [
  { e: "🎯", t: "Первая реклама за 10 минут", d: "Заголовок, обложка, ссылка", p: 85, c: "linear-gradient(135deg,#34c759,#b6f2c9)" },
  { e: "🤖", t: "ИИ для рекламы", d: "Тексты и картинки нейросетью", p: 60, c: "linear-gradient(135deg,#0a9d4a,#5fe38a)" },
  { e: "🎬", t: "Видео, которое смотрят", d: "Первые 3 секунды решают всё", p: 40, c: "linear-gradient(135deg,#30d158,#d9f7e4)" },
  { e: "💸", t: "Монетизация сайта", d: "Подписки, клики, партнёрки", p: 25, c: "linear-gradient(135deg,#248a3d,#7ee8a2)" },
];
$("#coursesGrid").innerHTML = COURSES.map(c => `
  <article class="course" tabindex="0">
    <div class="cover" style="background:${c.c}">${c.e}</div>
    <div class="body"><h3>${c.t}</h3><p>${c.d}</p><div class="bar"><i style="width:${c.p}%"></i></div></div>
  </article>`).join("");
$$(".course").forEach((el, i) => el.onclick = () => toast("Курс «" + COURSES[i].t + "» скоро откроется"));

/* ---------- API ---------- */
async function api(path, opts = {}) {
  const r = await fetch("/api" + path, {
    method: opts.method || "GET", credentials: "same-origin",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || "Ошибка сервера"); e.status = r.status; throw e; }
  return data;
}

/* ---------- Аккаунт ---------- */
let me = null, authMode = "login";
function renderAuth() {
  $("#authArea").innerHTML = me
    ? `<span class="who" title="${esc(me.email)}">${esc(me.name)}${me.plan === "pro" ? " · Про" : ""}</span><button class="btn small ghost" id="btnLogout">Выйти</button>`
    : `<button class="btn small ghost" id="btnLogin">Войти</button>`;
}
function openAuth(mode) {
  authMode = mode || "login";
  $("#authTitle").textContent = authMode === "login" ? "Вход" : "Регистрация";
  $("#authName").parentElement.hidden = authMode === "login";
  $("#authName").required = authMode === "register";
  $("#authSubmit").textContent = authMode === "login" ? "Войти" : "Создать аккаунт";
  $("#authSwitch").textContent = authMode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти";
  $("#authPass").autocomplete = authMode === "login" ? "current-password" : "new-password";
  $("#authErr").textContent = ""; $("#authDlg").showModal(); $("#authEmail").focus();
}
$("#authArea").addEventListener("click", async e => {
  if (e.target.id === "btnLogin") openAuth("login");
  if (e.target.id === "btnLogout") { await api("/logout", { method: "POST", body: {} }); me = null; renderAuth(); loadFeed(); toast("Вы вышли"); }
});
$("#authSwitch").onclick = () => openAuth(authMode === "login" ? "register" : "login");
$("#authCancel").onclick = () => $("#authDlg").close();
$("#authForm").addEventListener("submit", async e => {
  e.preventDefault(); $("#authErr").textContent = "";
  const body = { email: $("#authEmail").value, password: $("#authPass").value };
  if (authMode === "register") body.name = $("#authName").value;
  try {
    me = (await api(authMode === "login" ? "/login" : "/register", { method: "POST", body })).user;
    $("#authDlg").close(); $("#authForm").reset(); renderAuth(); loadFeed();
    toast(authMode === "login" ? "С возвращением, " + me.name : "Аккаунт создан 🎉");
  } catch (err) { $("#authErr").textContent = err.message; }
});

/* ---------- Лента ---------- */
let posts = [], filter = "all";
const LABEL = { ad: "Реклама", idea: "Идея", course: "Курс" };
async function loadFeed() {
  try { posts = (await api("/posts")).posts; renderFeed(); }
  catch { $("#feedGrid").innerHTML = `<p class="sub">Не удалось загрузить ленту</p>`; }
}
function renderFeed() {
  const list = posts.filter(p => filter === "all" || p.type === filter);
  $("#feedGrid").innerHTML = list.length ? list.map((p, i) => {
    const media = p.media
      ? (/\.(mp4|webm)$/.test(p.media) ? `<video class="media" src="${esc(p.media)}" controls playsinline preload="metadata"></video>` : `<img class="media" src="${esc(p.media)}" alt="" loading="lazy">`)
      : `<div class="media ph" style="background:${p.bg ? esc(p.bg) : "var(--g3)"}">${esc(p.emoji || "✨")}</div>`;
    return `<article class="post" style="animation-delay:${i * 60}ms">${media}
      <div class="body"><span class="tag">${LABEL[p.type] || "Пост"} · ${esc(p.author)}</span>
      <h3>${esc(p.title)}</h3><p>${esc(p.text || "")}</p>
      <div class="foot"><a class="btn small" href="${p.go}" target="_blank" rel="noopener noreferrer nofollow" data-click="${p.id}">Перейти →</a>
      <span>👆 ${p.clicks}</span>
      <button data-like="${p.id}" class="${p.liked ? "liked" : ""}">${p.liked ? "♥" : "♡"} ${p.likes}</button>
      ${p.mine ? `<button data-del="${p.id}" title="Удалить">🗑</button>` : ""}</div></div></article>`;
  }).join("") : `<p class="sub">Пока пусто — стань первым!</p>`;
}
$("#feedGrid").addEventListener("click", async e => {
  const lk = e.target.closest("[data-like]"), dl = e.target.closest("[data-del]"), ck = e.target.closest("[data-click]");
  try {
    if (lk) {
      if (!me) return openAuth("login");
      const p = posts.find(x => x.id == lk.dataset.like), r = await api(`/posts/${p.id}/like`, { method: "POST", body: {} });
      p.liked = r.liked; p.likes = r.likes; renderFeed();
    } else if (dl) {
      if (!confirm("Удалить пост?")) return;
      await api("/posts/" + dl.dataset.del, { method: "DELETE" }); toast("Удалено"); loadFeed();
    } else if (ck) setTimeout(loadFeed, 800);
  } catch (err) { toast(err.message); }
});
$("#filters").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  filter = b.dataset.f; $$("#filters button").forEach(x => x.classList.toggle("on", x === b)); renderFeed();
});

/* ---------- Создание поста ---------- */
let fileData = null, aiCover = null;
$("#fFile").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) { fileData = null; $("#preview").hidden = true; return; }
  if (f.size > 4 * 1024 * 1024) { toast("Файл больше 4 МБ — выбери меньше"); e.target.value = ""; return; }
  const r = new FileReader();
  r.onload = () => {
    fileData = r.result; aiCover = null;
    $("#preview").hidden = false;
    $("#preview").innerHTML = f.type.startsWith("video") ? `<video src="${fileData}" controls></video>` : `<img src="${fileData}" alt="">`;
  };
  r.readAsDataURL(f);
});
$("#postForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!me) { openAuth("register"); toast("Сначала создайте аккаунт"); return; }
  const btn = e.submitter; btn && (btn.disabled = true);
  try {
    await api("/posts", { method: "POST", body: {
      type: $("#fType").value, title: $("#fTitle").value, text: $("#fText").value,
      link: $("#fLink").value, media: fileData || aiCover || undefined } });
    e.target.reset(); fileData = aiCover = null; $("#preview").hidden = true;
    filter = "all"; $$("#filters button").forEach(x => x.classList.toggle("on", x.dataset.f === "all"));
    await loadFeed(); toast("Опубликовано! 🎉"); location.hash = "#feed";
  } catch (err) { toast(err.message); }
  finally { btn && (btn.disabled = false); }
});
$("#toAI").onclick = () => { location.hash = "#ai"; $("#aiTopic").value ||= $("#fTitle").value; $("#aiTopic").focus(); };

/* ---------- ИИ-студия ---------- */
const STYLES = {
  green: ["#0a9d4a", "#5fe38a", "#fff"], dark: ["#111", "#2c3a33", "#5fe38a"],
  sun: ["#ff9f0a", "#ff375f", "#fff"], sky: ["#0a84ff", "#64d2ff", "#fff"]
};
const TEXTS = {
  bold: t => [`${t} — то, чего ты ждал.`, `Хватит искать. Заходи и убедись сам: ${t}.`, `Только сегодня — первый шаг бесплатно 🚀`],
  friendly: t => [`Привет! Мы делаем ${t} с любовью 💚`, `Загляни к нам — тебе понравится.`, `Будем рады знакомству!`],
  pro: t => [`${t}: проверенное решение.`, `Прозрачные условия, измеримый результат.`, `Узнайте больше на сайте.`]
};
let aiState = null;

// Заготовка под настоящий ИИ: замени тело на fetch к своему серверу/API.
// Ключи API нельзя хранить в браузерном коде — вызывай через свой бэкенд.
async function generateWithAPI(/* topic, style, tone */) { return null; }

function drawCover(topic, style) {
  const cv = $("#aiCanvas"), c = cv.getContext("2d"), [a, b, fg] = STYLES[style], W = cv.width, H = cv.height;
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, a); g.addColorStop(1, b);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalAlpha = .18; c.fillStyle = "#fff";
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(Math.random() * W, Math.random() * H, 40 + Math.random() * 110, 0, 7); c.fill(); }
  c.globalAlpha = 1; c.fillStyle = fg; c.textBaseline = "middle";
  c.font = "700 64px -apple-system,Helvetica,Arial,sans-serif";
  const words = topic.split(" "), lines = []; let cur = "";
  words.forEach(w => { if ((cur + " " + w).length > 18) { lines.push(cur.trim()); cur = w; } else cur += " " + w; });
  lines.push(cur.trim());
  lines.slice(0, 4).forEach((l, i, arr) => c.fillText(l, 60, H / 2 - (arr.length - 1) * 38 + i * 76));
  c.font = "600 26px -apple-system,Helvetica,Arial,sans-serif"; c.globalAlpha = .85; c.fillText("Royou · ИИ", 60, H - 40);
}
$("#aiGo").onclick = async () => {
  const topic = $("#aiTopic").value.trim(); if (!topic) { toast("Напиши, что рекламируем"); return; }
  const style = $("#aiStyle").value, tone = $("#aiTone").value;
  let text = null;
  try { text = await generateWithAPI(topic, style, tone); } catch { /* падаем на шаблон */ }
  text ||= TEXTS[tone](topic).join("\n");
  drawCover(topic, style);
  $("#aiText").textContent = text;
  const url = $("#aiCanvas").toDataURL("image/jpeg", .85);
  aiState = { title: topic, text, cover: url }; $("#aiUse").disabled = false;
  toast("Готово ✨");
};
$("#aiUse").onclick = () => {
  if (!aiState) return;
  $("#fTitle").value = aiState.title; $("#fText").value = aiState.text.split("\n").slice(0, 2).join(" ").slice(0, 300);
  aiCover = aiState.cover; fileData = null; $("#fFile").value = "";
  $("#preview").hidden = false; $("#preview").innerHTML = `<img src="${aiCover}" alt="">`;
  location.hash = "#create"; toast("Обложка и текст добавлены в пост");
};

/* ---------- Монетизация ---------- */
function calc() {
  const cl = +$("#rClicks").value, cpc = +$("#rCpc").value, su = +$("#rSubs").value;
  $("#vClicks").textContent = cl.toLocaleString("ru-RU"); $("#vCpc").textContent = cpc; $("#vSubs").textContent = su.toLocaleString("ru-RU");
  $("#vTotal").textContent = Math.round(cl * cpc * 30 + su * 490).toLocaleString("ru-RU");
}
["#rClicks", "#rCpc", "#rSubs"].forEach(s => $(s).addEventListener("input", calc)); calc();


$$("[data-buy]").forEach(b => b.onclick = () => toast("Оплата ещё не подключена: тариф выдаётся вручную (npm run set-plan)"));
(async () => { try { me = (await api("/me")).user; } catch {} renderAuth(); loadFeed(); })();
