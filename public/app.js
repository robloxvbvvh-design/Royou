'use strict';

const $ = (id) => document.getElementById(id);
const token = localStorage.getItem('royou_token');
if (!token) location.replace('/');

const STARTER = {
  name: 'Новый сайт',
  html: '<h1>Привет!</h1>\n<p>Это мой новый сайт. Измените этот текст.</p>\n<button id="btn">Нажми меня</button>',
  css: 'body {\n  font-family: Arial, sans-serif;\n  max-width: 640px;\n  margin: 40px auto;\n  padding: 0 16px;\n}\n\nh1 {\n  color: #4f46e5;\n}',
  js: "document.getElementById('btn').addEventListener('click', function () {\n  alert('Работает!');\n});",
};

let site = null; // сайт, открытый в редакторе
let field = 'html'; // открытая вкладка
let dirty = false;
let previewTimer = null;
let errorTimer = null;

function showError(message) {
  $('error').textContent = message;
  $('error').hidden = false;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => ($('error').hidden = true), 5000);
}

async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Нет связи с сервером');
  }
  if (res.status === 401) {
    localStorage.removeItem('royou_token');
    location.replace('/');
    throw new Error('Нужно войти заново');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Что-то пошло не так');
  return data;
}

function setDirty(value) {
  dirty = value;
  $('status').textContent = value ? 'Есть несохранённые изменения' : 'Сохранено';
}

function updatePreview() {
  $('preview').srcdoc = composeSite(site);
}

// ---------- Список ----------

async function showList() {
  $('view-editor').hidden = true;
  $('view-list').hidden = false;
  site = null;
  const { sites } = await api('GET', '/api/sites');
  $('empty').hidden = sites.length > 0;
  $('sites').replaceChildren(
    ...sites.map((item) => {
      const li = document.createElement('li');
      const open = document.createElement('button');
      open.className = 'site-card';
      const name = document.createElement('b');
      name.textContent = item.name;
      const date = document.createElement('span');
      date.className = 'muted';
      date.textContent = 'Изменён ' + new Date(item.updatedAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
      open.append(name, date);
      open.addEventListener('click', () => openSite(item.id).catch((err) => showError(err.message)));
      li.append(open);
      return li;
    })
  );
}

// ---------- Редактор ----------

function showEditor(data) {
  site = data;
  field = 'html';
  for (const tab of document.querySelectorAll('.tab')) tab.classList.toggle('active', tab.dataset.field === field);
  $('site-name').value = site.name;
  $('code-area').value = site.html;
  $('open-link').href = '/s/' + site.id;
  $('view-list').hidden = true;
  $('view-editor').hidden = false;
  setDirty(false);
  updatePreview();
}

async function openSite(id) {
  showEditor((await api('GET', '/api/sites/' + id)).site);
}

async function save() {
  $('save-btn').disabled = true;
  try {
    const data = await api('PUT', '/api/sites/' + site.id, site);
    site.name = data.site.name;
    $('site-name').value = site.name;
    setDirty(false);
  } catch (err) {
    showError(err.message);
  } finally {
    $('save-btn').disabled = false;
  }
}

$('new-btn').addEventListener('click', async () => {
  try {
    showEditor((await api('POST', '/api/sites', STARTER)).site);
  } catch (err) {
    showError(err.message);
  }
});

$('code-area').addEventListener('input', () => {
  site[field] = $('code-area').value;
  setDirty(true);
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 400);
});

// Клавиша Tab ставит отступ, а не уводит курсор из редактора.
$('code-area').addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault();
    $('code-area').setRangeText('  ', $('code-area').selectionStart, $('code-area').selectionEnd, 'end');
    $('code-area').dispatchEvent(new Event('input'));
  }
  if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    save();
  }
});

$('site-name').addEventListener('input', () => {
  site.name = $('site-name').value;
  setDirty(true);
});

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    field = tab.dataset.field;
    for (const other of document.querySelectorAll('.tab')) other.classList.toggle('active', other === tab);
    $('code-area').value = site[field];
    $('code-area').focus();
  });
}

$('save-btn').addEventListener('click', save);

$('open-link').addEventListener('click', (event) => {
  if (dirty && !confirm('Изменения не сохранены. Откроется последняя сохранённая версия. Продолжить?')) event.preventDefault();
});

$('back-btn').addEventListener('click', () => {
  if (dirty && !confirm('Изменения не сохранены. Выйти из редактора?')) return;
  showList().catch((err) => showError(err.message));
});

$('delete-btn').addEventListener('click', async () => {
  if (!confirm('Удалить сайт «' + site.name + '»? Вернуть его будет нельзя.')) return;
  try {
    await api('DELETE', '/api/sites/' + site.id);
    await showList();
  } catch (err) {
    showError(err.message);
  }
});

$('logout-btn').addEventListener('click', async () => {
  if (site && dirty && !confirm('Изменения не сохранены. Выйти?')) return;
  await api('POST', '/api/logout').catch(() => {});
  localStorage.removeItem('royou_token');
  location.replace('/');
});

window.addEventListener('beforeunload', (event) => {
  if (site && dirty) event.preventDefault();
});

(async () => {
  try {
    $('user-email').textContent = (await api('GET', '/api/me')).email;
    await showList();
  } catch (err) {
    showError(err.message);
  }
})();
