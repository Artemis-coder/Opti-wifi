#!/usr/bin/env node
// Crée une clé API SasPay de TEST (SANDBOX, préfixe sk_test_, scope PAYIN) quand le tableau de
// bord ne propose pas l'option. Même appels que le tableau de bord (doc : /account-setup) :
//   POST /auth/login/  →  POST /merchant-api-keys/ { environment: "SANDBOX", scope: "PAYIN" }
// À lancer soi-même dans un terminal : l'e-mail et le mot de passe sont saisis ici et envoyés
// uniquement à api.saspay.me. Rien n'est enregistré. La clé s'affiche une seule fois.
//
//   node scripts/saspay/create-sandbox-key.mjs
import readline from 'node:readline';

const API = 'https://api.saspay.me/api/v1';

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Masque la saisie du mot de passe
      rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : s.replace(/[^\r\n]/g, '•'));
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function call(method, path, { token, body, merchantId } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(merchantId ? { 'X-Merchant-Id': merchantId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    const err = json?.error;
    const msg = typeof err?.message === 'string' ? err.message : JSON.stringify(err ?? json ?? res.status);
    throw new Error(`${method} ${path} → HTTP ${res.status} : ${msg}`);
  }
  return json?.data ?? json;
}

const list = (data) => (Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []);

try {
  console.log('Création d’une clé SasPay de TEST (sk_test_, sans argent réel)\n');
  const email = await ask('E-mail SasPay : ');
  const password = await ask('Mot de passe SasPay : ', { hidden: true });

  let login = await call('POST', '/auth/login/', { body: { email, password } });
  if (login?.pending_2fa_token) {
    const code = await ask('Code de double authentification : ');
    login = await call('POST', '/auth/login/verify-2fa/', { body: { pending_2fa_token: login.pending_2fa_token, code } });
  }
  const token = login?.tokens?.access;
  if (!token) throw new Error('Connexion SasPay : jeton absent de la réponse');

  // Marchand visé (s'il y en a plusieurs : choix)
  let merchantId;
  try {
    const merchants = list(await call('GET', '/merchants/', { token }));
    if (merchants.length > 1) {
      merchants.forEach((m, i) => console.log(`  ${i + 1}. ${m.name} (${m.kyc_status ?? '?'})`));
      const n = Number(await ask('Numéro du marchand OptiWifi : '));
      merchantId = merchants[n - 1]?.id;
    } else merchantId = merchants[0]?.id;
  } catch {
    // Liste indisponible : le marchand actif du compte est utilisé
  }

  const key = await call('POST', '/merchant-api-keys/', {
    token,
    merchantId,
    body: { name: 'OptiWifi dev (test)', environment: 'SANDBOX', scope: 'PAYIN', ...(merchantId ? { merchant: merchantId } : {}) },
  });
  if (!key?.secret?.startsWith('sk_test_')) {
    throw new Error(`Clé inattendue (préfixe ${String(key?.secret).slice(0, 8)}…) : vérifiez dans le tableau de bord`);
  }
  console.log('\n✅ Clé de TEST créée. Copiez-la maintenant, elle ne sera plus jamais affichée :\n');
  console.log(`   ${key.secret}\n`);
  console.log('Collez-la dans Vercel → Settings → Environment Variables → SASPAY_API_KEY (Preview uniquement),');
  console.log('à la place de la clé sk_live_ actuelle. Ne la partagez pas dans le chat.');
} catch (err) {
  console.error(`\n❌ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
}
