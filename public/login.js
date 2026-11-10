'use strict';

const $ = (id) => document.getElementById(id);
const steps = ['step-start', 'step-email', 'step-code', 'step-token', 'step-token-login'];
let email = '';

function show(step) {
  for (const id of steps) $(id).hidden = id !== step;
  $('error').hidden = true;
  const input = $(step).querySelector('input');
  if (input) input.focus();
}

function showError(message) {
  $('error').textContent = message;
  $('error').hidden = false;
}

async function post(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    throw new Error('Нет связи с сервером');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Что-то пошло не так');
  return data;
}

// Блокирует кнопку формы на время запроса, чтобы не отправить дважды.
function onSubmit(formId, handler) {
  $(formId).addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type=submit]');
    button.disabled = true;
    $('error').hidden = true;
    try {
      await handler();
    } catch (err) {
      showError(err.message);
    } finally {
      button.disabled = false;
    }
  });
}

async function requestCode() {
  const data = await post('/api/auth/request-code', { email });
  $('email-shown').textContent = email;
  $('dev-note').hidden = data.mailConfigured;
  $('code').value = '';
  show('step-code');
}

$('start-btn').addEventListener('click', () => show('step-email'));
$('token-link').addEventListener('click', () => show('step-token-login'));
for (const button of document.querySelectorAll('.back')) {
  button.addEventListener('click', () => show(button.closest('section').id === 'step-code' ? 'step-email' : 'step-start'));
}

onSubmit('email-form', async () => {
  email = $('email').value.trim();
  await requestCode();
});

$('resend-btn').addEventListener('click', async () => {
  $('error').hidden = true;
  try {
    await requestCode();
  } catch (err) {
    showError(err.message);
  }
});

onSubmit('code-form', async () => {
  const data = await post('/api/auth/verify', { email, code: $('code').value.trim() });
  localStorage.setItem('royou_token', data.token);
  $('token-value').textContent = data.token;
  show('step-token');
});

$('copy-btn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('token-value').textContent);
    $('copy-btn').textContent = 'Скопировано';
  } catch {
    showError('Не получилось скопировать. Выделите токен и скопируйте вручную');
  }
});

onSubmit('token-form', async () => {
  const token = $('token-input').value.trim();
  const res = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + token } }).catch(() => null);
  if (!res) throw new Error('Нет связи с сервером');
  if (!res.ok) throw new Error('Такой токен не найден');
  localStorage.setItem('royou_token', token);
  location.href = '/app';
});

// Если человек уже входил, сразу отправляем его в конструктор.
(async () => {
  const token = localStorage.getItem('royou_token');
  if (!token) return;
  const res = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + token } }).catch(() => null);
  if (res && res.ok) location.href = '/app';
  else if (res && res.status === 401) localStorage.removeItem('royou_token');
})();
