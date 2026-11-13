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

/* ---------- Лента ---------- */
const DEMO = [
  { id: "d1", type: "ad", title: "Школа английского Lingo", text: "Говори свободно за 3 месяца. Первый урок бесплатно.", link: "https://example.com", emoji: "🗣️", bg: "linear-gradient(135deg,#34c759,#b6f2c9)", likes: 124, clicks: 980 },
  { id: "d2", type: "idea", title: "Идея: приложение для обмена книгами", text: "Фоткаешь книгу — находишь соседа, который хочет её обменять.", link: "https://example.com", emoji: "📚", bg: "linear-gradient(135deg,#ffd60a,#fff3b0)", likes: 87, clicks: 310 },
  { id: "d3", type: "course", title: "Курс: монтаж на телефоне", text: "12 коротких уроков. Сделай видео как у блогеров.", link: "https://example.com", emoji: "🎞️", bg: "linear-gradient(135deg,#0a84ff,#bfe0ff)", likes: 203, clicks: 1540 },
  { id: "d4", type: "ad", title: "GreenBox — доставка еды", text: "Свежие продукты за 30 минут. Промокод ROYOU.", link: "https://example.com", emoji: "🥗", bg: "linear-gradient(135deg,#30d158,#d9f7e4)", likes: 56, clicks: 420 },
];
let posts = store.get("royou_posts", null);
if (!posts) { posts = DEMO; store.set("royou_posts", posts); }
let liked = new Set(store.get("royou_liked", []));
let filter = "all";
const LABEL = { ad: "Реклама", idea: "Идея", course: "Курс" };

function renderFeed() {
  const list = posts.filter(p => filter === "all" || p.type === filter);
  $("#feedGrid").innerHTML = list.length ? list.map((p, i) => {
    const media = p.media
      ? (p.media.startsWith("data:video") ? `<video class="media" src="${p.media}" controls playsinline></video>` : `<img class="media" src="${p.media}" alt="">`)
      : p.cover ? `<img class="media" src="${p.cover}" alt="">`
      : `<div class="media ph" style="background:${p.bg || "var(--g3)"}">${esc(p.emoji || "✨")}</div>`;
    return `<article class="post" style="animation-delay:${i * 60}ms">${media}
      <div class="body"><span class="tag">${LABEL[p.type] || "Пост"}</span>
      <h3>${esc(p.title)}</h3><p>${esc(p.text || "")}</p>
      <div class="foot"><a class="btn small" href="${safeUrl(p.link)}" target="_blank" rel="noopener noreferrer nofollow" data-click="${p.id}">Перейти →</a>
      <span>👆 ${p.clicks}</span>
      <button data-like="${p.id}" class="${liked.has(p.id) ? "liked" : ""}">${liked.has(p.id) ? "♥" : "♡"} ${p.likes}</button></div></div></article>`;
  }).join("") : `<p class="sub">Пока пусто — стань первым!</p>`;
}
$("#feedGrid").addEventListener("click", e => {
  const lk = e.target.closest("[data-like]"), ck = e.target.closest("[data-click]");
  if (lk) {
    const p = posts.find(x => x.id === lk.dataset.like);
    if (liked.has(p.id)) { liked.delete(p.id); p.likes--; } else { liked.add(p.id); p.likes++; }
    store.set("royou_liked", [...liked]); store.set("royou_posts", posts); renderFeed();
  } else if (ck) {
    const p = posts.find(x => x.id === ck.dataset.click); p.clicks++;
    store.set("royou_posts", posts); setTimeout(renderFeed, 50);
  }
});
$("#filters").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  filter = b.dataset.f; $$("#filters button").forEach(x => x.classList.toggle("on", x === b)); renderFeed();
});

/* ---------- Создание поста ---------- */
let fileData = null, aiCover = null;
$("#fFile").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) { fileData = null; $("#preview").hidden = true; return; }
  if (f.size > 3 * 1024 * 1024) { toast("Файл больше 3 МБ — выбери меньше"); e.target.value = ""; return; }
  const r = new FileReader();
  r.onload = () => {
    fileData = r.result; aiCover = null;
    $("#preview").hidden = false;
    $("#preview").innerHTML = f.type.startsWith("video") ? `<video src="${fileData}" controls></video>` : `<img src="${fileData}" alt="">`;
  };
  r.readAsDataURL(f);
});
$("#postForm").addEventListener("submit", e => {
  e.preventDefault();
  const type = $("#fType").value;
  const p = {
    id: "p" + Date.now(), type, title: $("#fTitle").value.trim(), text: $("#fText").value.trim(),
    link: $("#fLink").value.trim(), media: fileData, cover: aiCover,
    emoji: { ad: "📣", idea: "💡", course: "🎓" }[type], likes: 0, clicks: 0
  };
  posts.unshift(p); store.set("royou_posts", posts);
  e.target.reset(); fileData = aiCover = null; $("#preview").hidden = true;
  filter = "all"; $$("#filters button").forEach(x => x.classList.toggle("on", x.dataset.f === "all"));
  renderFeed(); toast("Опубликовано! 🎉"); location.hash = "#feed";
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
  $("#aiDl").href = $("#aiCanvas").toDataURL("image/png");
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
$$("[data-buy]").forEach(b => b.onclick = () => toast("Тариф «" + b.dataset.buy + "»: подключите оплату (Stripe / ЮKassa) — см. README"));

renderFeed();
