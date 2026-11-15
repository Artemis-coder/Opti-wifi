// Test de bout en bout du paiement en ligne contre le faux SasPay (base Neon DEV uniquement).
// Remet la base dans son état initial à la fin.
import { neon } from '@neondatabase/serverless';
import { createHmac } from 'node:crypto';
const u = process.env.DATABASE_URL;
if (!u?.includes('ep-crimson-shape')) throw new Error('Base de dev attendue');
const sql = neon(u);
const APP = 'http://localhost:3400', MOCK = 'http://localhost:4599', SECRET = 'whsec_local_mock';
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const start = new Date();
const [{ organization_id: org }] = await sql.query(`SELECT organization_id FROM profiles WHERE email = $1`, [process.env.DEV_TEST_CLIENT_EMAIL]);
const before = await sql.query(`SELECT id, status FROM subscriptions WHERE organization_id = $1`, [org]);
const current = (await sql.query(`SELECT plan_id FROM subscriptions WHERE organization_id = $1 AND status = 'active' ORDER BY end_date DESC LIMIT 1`, [org]))[0];

try {
  const login = await fetch(`${APP}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.DEV_TEST_CLIENT_EMAIL, password: process.env.DEV_TEST_CLIENT_PASSWORD }) });
  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  ok(login.ok && cookie, 'connexion du client de démo');
  const api = (path, init = {}) => fetch(`${APP}${path}`, { ...init, headers: { ...(init.headers || {}), cookie, 'Content-Type': 'application/json' } });

  const en = await (await api('/api/payments/saspay/checkout')).json();
  ok(en.data?.enabled === true, 'paiement en ligne proposé');

  const c1 = await api('/api/payments/saspay/checkout', { method: 'POST', body: JSON.stringify({ planId: current.plan_id }) });
  const j1 = await c1.json();
  ok(c1.ok && j1.data.checkoutUrl?.startsWith('https://'), `session créée (${j1.data?.checkoutUrl})`);
  const ref = j1.data.id;
  const row = (await sql.query(`SELECT amount, currency, checkout_session_id, status FROM online_payments WHERE id = $1`, [ref]))[0];
  ok(row.amount === '20000.00' && row.currency === 'XOF' && row.status === 'pending', `montant pris en base : ${row.amount} ${row.currency}`);

  const j2 = await (await api('/api/payments/saspay/checkout', { method: 'POST', body: JSON.stringify({ planId: current.plan_id }) })).json();
  ok(j2.data?.resumed === true && j2.data.id === ref, 'double clic : même session reprise');

  const bad = await api('/api/payments/saspay/checkout', { method: 'POST', body: JSON.stringify({ planId: 'pas-un-uuid' }) });
  ok(bad.status === 400, 'forfait invalide refusé');

  const s0 = await (await api(`/api/payments/saspay/status?ref=${ref}`)).json();
  ok(s0.data?.status === 'pending', 'statut en attente avant paiement');

  const other = await fetch(`${APP}/api/payments/saspay/status?ref=${ref}`);
  ok(other.status === 401, 'statut inaccessible sans session');

  const paid = await (await fetch(`${MOCK}/mock/pay/${row.checkout_session_id}?result=SUCCESS`, { method: 'POST' })).json();

  // Webhooks : signature fausse, trop ancienne, puis valide
  const body = JSON.stringify({ event: 'transaction.success', data: { id: paid.transaction_id, status: 'SUCCESS' } });
  const ts = String(Math.floor(Date.now() / 1000));
  const sign = (t) => createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
  const w1 = await fetch(`${APP}/api/webhooks/saspay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': 'deadbeef', 'X-Webhook-Timestamp': ts }, body });
  ok(w1.status === 401, 'webhook à signature fausse refusé (401)');
  const old = String(Number(ts) - 600);
  const w2 = await fetch(`${APP}/api/webhooks/saspay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': sign(old), 'X-Webhook-Timestamp': old }, body });
  ok(w2.status === 401, 'webhook rejoué 10 min plus tard refusé (401)');
  const w3 = await fetch(`${APP}/api/webhooks/saspay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': sign(ts), 'X-Webhook-Timestamp': ts, 'X-Webhook-Event': 'transaction.success' }, body });
  ok(w3.status === 200, 'webhook valide accepté (200)');

  let after;
  for (let i = 0; i < 15; i++) {
    after = (await sql.query(`SELECT status, subscription_id, invoice_id, network, amount_charged, transaction_reference FROM online_payments WHERE id = $1`, [ref]))[0];
    if (after.subscription_id) break;
    await sleep(1000);
  }
  ok(after.status === 'succeeded' && after.subscription_id && after.invoice_id, `licence activée par le webhook (réseau ${after.network}, payé ${after.amount_charged})`);

  // Retour navigateur + webhook rejoué : aucune double activation
  const s1 = await (await api(`/api/payments/saspay/status?ref=${ref}`)).json();
  ok(s1.data?.status === 'succeeded' && s1.data.license_activated && s1.data.invoice_id, 'page de retour : paiement confirmé, licence active, facture');
  await fetch(`${APP}/api/webhooks/saspay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': sign(ts), 'X-Webhook-Timestamp': ts }, body });
  await sleep(2000);
  const subs = await sql.query(`SELECT id FROM subscriptions WHERE organization_id = $1 AND created_at >= $2`, [org, start]);
  ok(subs.length === 1, `une seule licence créée malgré webhook rejoué et retour navigateur (${subs.length})`);
  const inv = (await sql.query(`SELECT amount, status, payment_method, payment_reference FROM invoices WHERE id = $1`, [after.invoice_id]))[0];
  ok(inv.status === 'paid' && inv.amount === '20000.00' && inv.payment_method === 'SasPay (mtn_bj)' && inv.payment_reference === after.transaction_reference, `facture ${inv.amount} XOF, ${inv.payment_method}, réf. ${inv.payment_reference}`);

  // Paiement échoué : pas de licence, nouvelle tentative possible
  const c3 = await (await api('/api/payments/saspay/checkout', { method: 'POST', body: JSON.stringify({ planId: current.plan_id }) })).json();
  const row3 = (await sql.query(`SELECT checkout_session_id FROM online_payments WHERE id = $1`, [c3.data.id]))[0];
  await fetch(`${MOCK}/mock/pay/${row3.checkout_session_id}?result=FAILED`, { method: 'POST' });
  const s3 = await (await api(`/api/payments/saspay/status?ref=${c3.data.id}`)).json();
  const subs2 = await sql.query(`SELECT id FROM subscriptions WHERE organization_id = $1 AND created_at >= $2`, [org, start]);
  ok(s3.data?.status === 'pending' && subs2.length === 1, 'opérateur refuse : aucune licence, la session reste ouverte pour réessayer');
} finally {
  // Remise en état de la base de dev
  const newSubs = (await sql.query(`SELECT id FROM subscriptions WHERE organization_id = $1 AND created_at >= $2`, [org, start])).map((r) => r.id);
  await sql.query(`DELETE FROM online_payments WHERE organization_id = $1 AND created_at >= $2`, [org, start]);
  if (newSubs.length) {
    await sql.query(`DELETE FROM invoices WHERE subscription_id = ANY($1::uuid[])`, [newSubs]);
    await sql.query(`DELETE FROM payments WHERE subscription_id = ANY($1::uuid[])`, [newSubs]);
    await sql.query(`DELETE FROM platform_audit_logs WHERE entity_id::text = ANY($1::text[])`, [newSubs]);
    await sql.query(`DELETE FROM subscriptions WHERE id = ANY($1::uuid[])`, [newSubs]);
  }
  for (const s of before) await sql.query(`UPDATE subscriptions SET status = $2 WHERE id = $1`, [s.id, s.status]);
  await sql.query(`DELETE FROM notifications WHERE created_at >= $1 AND type IN ('license.activated', 'payment.received', 'payment.issue')`, [start]);
  await sql.query(`DELETE FROM saspay_webhook_events WHERE received_at >= $1`, [start]);
  const check = await sql.query(`SELECT id, status FROM subscriptions WHERE organization_id = $1`, [org]);
  console.log(check.length === before.length && check.every((c) => before.find((b) => b.id === c.id)?.status === c.status) ? '🧹 base de dev remise en état' : '⚠️ remise en état incomplète');
}
