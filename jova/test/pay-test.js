// Проверка оплаты на подставных ЮKassa и Stripe (настоящих ключей нет).
const http = require('http'), crypto = require('crypto'), { spawn } = require('child_process');
const paid = new Map();
const mock = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
  const j = (o, c = 200) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST' && req.url === '/yk/payments') { const o = JSON.parse(b); paid.set('pay1', { ...o, status: 'succeeded', paid: true }); paid.set('pay2', { ...o, status: 'pending', paid: false });
    return j({ id: 'pay1', confirmation: { confirmation_url: 'https://yookassa.example/pay1?amount=' + o.amount.value } }); }
  if (req.method === 'GET' && req.url.startsWith('/yk/payments/')) { const p = paid.get(req.url.split('/').pop()); return p ? j({ id: req.url.split('/').pop(), status: p.status, paid: p.paid, metadata: p.metadata }) : j({}, 404); }
  if (req.method === 'POST' && req.url === '/st/v1/checkout/sessions') return j({ url: 'https://stripe.example/cs_1', body: b });
  j({}, 404); }); }).listen(4030);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run(name, env, flow) {
  const p = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3300', NODE_ENV: 'production', ...env }, stdio: 'ignore' }); await sleep(800);
  try { console.log('--', name); await flow(); } finally { p.kill(); }
}
const api = (path, body, headers = {}) => fetch('http://localhost:3300' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const plan = async u => (await (await fetch('http://localhost:3300/api/state?user=' + u)).json());
(async () => {
  require('fs').rmSync(__dirname + '/../data/users.json', { force: true });
  await run('ЮKassa', { YOOKASSA_SHOP_ID: '1', YOOKASSA_SECRET_KEY: 'k', YOOKASSA_API: 'http://localhost:4030/yk' }, async () => {
    const U = 'ykuser-00000001';
    let r = await api('/api/checkout', { userId: U, plan: 'pro' }); console.log('checkout:', r.status, JSON.stringify(await r.json()));
    r = await api('/api/plan', { userId: U, plan: 'max' }); console.log('ручная смена при включённой оплате:', r.status, '(ожидается 403)');
    r = await api('/api/pay/yookassa', { event: 'payment.succeeded', object: { id: 'pay2' } }); console.log('неоплаченный платёж:', r.status, '(ожидается 400)');
    r = await api('/api/pay/yookassa', { event: 'payment.succeeded', object: { id: 'pay1' } }); console.log('оплаченный платёж:', r.status);
    let s = await plan(U); console.log('тариф:', s.usage.plan, 'до', new Date(s.usage.until).toISOString().slice(0, 10), 'оплата:', s.payments);
    const u1 = s.usage.until; await api('/api/pay/yookassa', { event: 'payment.succeeded', object: { id: 'pay1' } });
    s = await plan(U); console.log('повтор уведомления не продлевает:', s.usage.until === u1);
  });
  await run('Stripe', { STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'whsec_t', STRIPE_API: 'http://localhost:4030/st' }, async () => {
    const U = 'stuser-000000001';
    let r = await api('/api/checkout', { userId: U, plan: 'max' }); const j = await r.json(); console.log('checkout:', r.status, j.url);
    const ev = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', metadata: { userId: U, plan: 'max' } } } });
    const t = Math.floor(Date.now() / 1000), sig = crypto.createHmac('sha256', 'whsec_t').update(t + '.' + ev).digest('hex');
    r = await api('/api/pay/stripe', ev, { 'stripe-signature': `t=${t},v1=bad${sig.slice(3)}` }); console.log('поддельная подпись:', r.status, '(ожидается 400)');
    r = await api('/api/pay/stripe', ev, { 'stripe-signature': `t=${t},v1=${sig}` }); console.log('верная подпись:', r.status);
    console.log('тариф:', (await plan(U)).usage.plan);
  });
  mock.close();
})();
