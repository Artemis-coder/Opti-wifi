// Faux serveur SasPay pour tester l'intégration en local (aucun appel réel).
// Endpoints imités : POST /checkout-sessions/, GET /checkout-sessions/:id/status/, POST …/cancel/,
// GET /payments/:id/verify/, GET /transactions/:id/, GET /pricing/my-rates/.
// Pilotage du test : POST /mock/pay/:sessionId?result=SUCCESS|FAILED[&close=1][&sessionStatus=FAILED]
import http from 'node:http';
import { randomUUID } from 'node:crypto';
const port = Number(process.argv[2] || 4599);
const sessions = new Map();
const txs = new Map();
const send = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(code < 300 ? { success: true, data, code } : { success: false, error: data, code }));
};
http.createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  const url = new URL(req.url, `http://localhost:${port}`);
  const p = url.pathname;
  if (!p.startsWith('/mock/') && req.headers.authorization !== 'Bearer sk_test_mock') return send(res, 401, { message: 'Clé invalide', code: 'unauthorized' });
  let m;
  if (req.method === 'POST' && p === '/checkout-sessions/') {
    const b = JSON.parse(body || '{}');
    // Montant minimum (comme SasPay) : erreur de validation par champ
    if (Number(b.amount) < 100) return send(res, 400, { amount: ['Le montant minimum est de 100 XOF.'] });
    const id = randomUUID();
    const s = { id, slug: id.slice(0, 8), checkout_url: `https://pay.saspay.me/checkout/${id}`, amount: b.amount, currency: b.currency, status: 'PENDING', transaction: null, expires_at: null, metadata: b.metadata, return_url: b.return_url };
    sessions.set(id, s);
    console.log('session créée', id, b.amount, b.currency, b.return_url);
    return send(res, 201, s);
  }
  if ((m = p.match(/^\/checkout-sessions\/([^/]+)\/status\/$/))) {
    const s = sessions.get(m[1]);
    if (!s) return send(res, 404, { message: 'Session introuvable', code: 'not_found' });
    const t = s.transaction ? txs.get(s.transaction) : null;
    return send(res, 200, { id: s.id, slug: s.slug, status: s.status, transaction_id: t?.id ?? null, transaction_status: t?.status ?? null, transaction_reference: t?.reference ?? null });
  }
  if ((m = p.match(/^\/checkout-sessions\/([^/]+)\/cancel\/$/))) {
    const s = sessions.get(m[1]);
    if (!s) return send(res, 404, { message: 'introuvable', code: 'not_found' });
    if (s.status !== 'PENDING' || s.closed) return send(res, 409, { message: 'Session non en attente', code: 'not_pending' });
    s.status = 'CANCELLED';
    return send(res, 200, s);
  }
  if ((m = p.match(/^\/(payments|transactions)\/([^/]+)\/(verify\/)?$/))) {
    const t = txs.get(m[2]);
    return t ? send(res, 200, t) : send(res, 404, { message: 'Paiement introuvable', code: 'not_found' });
  }
  if (req.method === 'GET' && p === '/pricing/my-rates/') {
    return send(res, 200, [
      { country_code: 'BJ', country_name: 'Bénin', currency: 'XOF', network_code: 'mtn_bj', network_name: 'MTN MoMo Benin', payin: { available: true, otp_required: false } },
      { country_code: 'CI', country_name: "Côte d'Ivoire", currency: 'XOF', network_code: 'orange_ci', network_name: 'Orange Money CI', payin: { available: true, otp_required: true } },
    ]);
  }
  if ((m = p.match(/^\/mock\/pay\/([^/]+)$/))) {
    const s = sessions.get(m[1]);
    if (!s) return send(res, 404, { message: 'introuvable' });
    const result = url.searchParams.get('result') || 'SUCCESS';
    const id = randomUUID();
    const fee = (Number(s.amount) * 0.025).toFixed(2);
    txs.set(id, { id, reference: `TXN-MOCK-${id.slice(0, 6)}`, status: result, flow_direction: 'INBOUND', requested_amount: s.amount, debited_amount: (Number(s.amount) + Number(fee)).toFixed(2), net_amount: s.amount, currency: s.currency, network_code: 'mtn_bj' });
    s.transaction = id;
    if (result === 'SUCCESS') s.status = 'PAID';
    // close=1 : session plus annulable (cas réel après un échec) ; sessionStatus=… : statut de session forcé
    if (url.searchParams.get('close') === '1') s.closed = true;
    if (url.searchParams.get('sessionStatus')) s.status = url.searchParams.get('sessionStatus');
    console.log('paiement simulé', s.id, result, id);
    return send(res, 200, { session: s.id, transaction_id: id });
  }
  send(res, 404, { message: `Route inconnue ${req.method} ${p}`, code: 'not_found' });
}).listen(port, () => console.log(`Faux SasPay sur http://localhost:${port}`));
