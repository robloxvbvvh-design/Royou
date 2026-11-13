// Оплата подписки: ЮKassa (рубли, РФ) или Stripe. Какой провайдер включён, определяют переменные окружения.
// Оплата разовая на 30 дней: после неё тариф включается сам, когда провайдер присылает подтверждение (вебхук).
const crypto = require('crypto');
const env = process.env;
const DAYS = 30;

const provider = () => (env.YOOKASSA_SHOP_ID && env.YOOKASSA_SECRET_KEY) ? 'yookassa' : env.STRIPE_SECRET_KEY ? 'stripe' : null;

async function createCheckout({ userId, plan, price, name, base }) {
  const p = provider();
  if (p === 'yookassa') {
    const r = await fetch((env.YOOKASSA_API || 'https://api.yookassa.ru/v3') + '/payments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json', 'idempotence-key': crypto.randomUUID(),
        authorization: 'Basic ' + Buffer.from(env.YOOKASSA_SHOP_ID + ':' + env.YOOKASSA_SECRET_KEY).toString('base64')
      },
      body: JSON.stringify({
        amount: { value: price.toFixed(2), currency: 'RUB' }, capture: true,
        confirmation: { type: 'redirect', return_url: base + '/?paid=1' },
        description: `Jova ${name}, ${DAYS} дней`, metadata: { userId, plan }
      })
    });
    const j = await r.json();
    if (!r.ok || !j.confirmation) throw new Error('ЮKassa: ' + (j.description || r.status));
    return j.confirmation.confirmation_url;
  }
  if (p === 'stripe') {
    const f = new URLSearchParams({
      mode: 'payment', success_url: base + '/?paid=1', cancel_url: base + '/',
      'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': (env.STRIPE_CURRENCY || 'usd').toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(Math.round(price * 100)),
      'line_items[0][price_data][product_data][name]': `Jova ${name}, ${DAYS} дней`,
      'metadata[userId]': userId, 'metadata[plan]': plan
    });
    const r = await fetch((env.STRIPE_API || 'https://api.stripe.com') + '/v1/checkout/sessions', {
      method: 'POST', headers: { authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded' }, body: f
    });
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error('Stripe: ' + ((j.error && j.error.message) || r.status));
    return j.url;
  }
  throw new Error('оплата не подключена');
}

// Подтверждение платежа от провайдера. Возвращает { id, userId, plan } или null, если платёж не оплачен/подделан.
async function confirmWebhook(which, raw, headers) {
  if (which === 'yookassa' && provider() === 'yookassa') {
    const ev = JSON.parse(raw);
    if (ev.event !== 'payment.succeeded' || !ev.object || !ev.object.id) return null;
    // у ЮKassa нет подписи в уведомлении: статус платежа перепроверяем запросом к их API.
    const r = await fetch((env.YOOKASSA_API || 'https://api.yookassa.ru/v3') + '/payments/' + encodeURIComponent(ev.object.id), {
      headers: { authorization: 'Basic ' + Buffer.from(env.YOOKASSA_SHOP_ID + ':' + env.YOOKASSA_SECRET_KEY).toString('base64') }
    });
    const pay = await r.json();
    if (!r.ok || pay.status !== 'succeeded' || !pay.paid || !pay.metadata) return null;
    return { id: pay.id, userId: pay.metadata.userId, plan: pay.metadata.plan };
  }
  if (which === 'stripe' && provider() === 'stripe' && env.STRIPE_WEBHOOK_SECRET) {
    const sig = Object.fromEntries(String(headers['stripe-signature'] || '').split(',').map(x => x.split('=')));
    if (!sig.t || !sig.v1) return null;
    const want = crypto.createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(sig.t + '.' + raw).digest('hex');
    const ok = want.length === sig.v1.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig.v1));
    if (!ok || Math.abs(Date.now() / 1000 - Number(sig.t)) > 600) return null;
    const ev = JSON.parse(raw), o = ev.data && ev.data.object;
    if (ev.type !== 'checkout.session.completed' || !o || o.payment_status !== 'paid' || !o.metadata) return null;
    return { id: o.id, userId: o.metadata.userId, plan: o.metadata.plan };
  }
  return null;
}

module.exports = { provider, createCheckout, confirmWebhook, DAYS };
