# Intégration SasPay — paiement en ligne des licences OptiWifi

> Statut (16/11/2026) : **intégration codée et testée en local** (faux serveur SasPay, 16 contrôles OK).
> Reste : clés SasPay de test puis de production, création du webhook dans le tableau de bord SasPay.
> Source : documentation officielle https://docs.saspay.me (lue le 15/11/2026) et sa spécification
> OpenAPI (`/api-reference/openapi.json`), qui fait foi. Aucun endpoint ni champ ci-dessous n'est inventé.

---

## 1. Objectif

Aujourd'hui, un client paie sa licence **hors ligne** (numéro mobile money / QR affiché par
`payment_methods`), saisit une référence, puis un super admin valide la demande
(`license_requests` → `activateLicense`). Délai, erreurs de référence, travail manuel.

Avec SasPay :

1. Le client choisit son forfait sur `/subscription` et clique **« Payer en ligne »**.
2. Il est redirigé vers la page de paiement hébergée SasPay (mobile money ou carte).
3. Dès que SasPay confirme le paiement, **la licence s'active automatiquement** (même fonction
   `activateLicense` que l'admin), la facture est générée et le client est notifié.
4. Le paiement manuel actuel reste disponible en secours (rien n'est supprimé).

---

## 2. Ce que propose SasPay (résumé utile pour nous)

| Élément | Valeur |
|---|---|
| URL de base | `https://api.saspay.me/api/v1` |
| Authentification | `Authorization: Bearer sk_test_…` (sandbox) / `sk_live_…` (production) — **serveur uniquement** |
| Portée de clé | `PAYIN`, `PAYOUT`, `BOTH` → nous n'avons besoin que de **`PAYIN`** |
| Enveloppe | `{ success, data, code }` ou `{ success:false, error:{message,code}, code }` |
| Montants | chaînes décimales (`"15000.00"`), jamais de flottants |
| Limite | 300 requêtes/min par compte (`429` au-delà) |
| Pays/réseaux | BJ, CI, SN, TG, BF, ML, NE, CM, GN, CD, GH, NG, KE, RW, UG, TZ, ZM, MW + `card` (Visa/Mastercard, USD) |

### Deux façons d'encaisser

| Mode | Endpoint | Quand |
|---|---|---|
| **Checkout hébergé** (retenu) | `POST /checkout-sessions/` → `checkout_url` | Le client choisit lui-même son réseau, saisit son numéro, gère l'OTP éventuel sur la page SasPay. Zéro UI de paiement à maintenir. |
| Softpay (push direct) | `POST /payments/softpay/` | Plus tard, si on veut payer sans quitter l'app. Oblige à gérer : choix du réseau, `checkout_url` non vide (Wave, Orange, carte), OTP pré-paiement (Orange CI/BF), `confirm-otp` (Wizall, Coris)… |

**Choix : checkout hébergé** pour la V1. Moins de code, moins de cas particuliers, et SasPay gère
l'OTP et la sélection du réseau. Le softpay pourra venir en V2.

### Statuts

- Session de checkout : `PENDING` → `PAID` / `CANCELLED` / expirée.
- Transaction : `PENDING` → `SUCCESS` / `FAILED` (`CANCELLED` existe mais n'est jamais atteint).

### Webhooks

- Créés **uniquement depuis le tableau de bord** SasPay (Développeur → Webhooks), pas par API.
- En-têtes : `X-Webhook-Signature` (HMAC-SHA256 hex de `"{timestamp}.{corps brut}"`),
  `X-Webhook-Timestamp` (secondes Unix), `X-Webhook-Event`.
- Rejeter si l'horodatage s'écarte de plus de **300 s**. Comparaison en temps constant.
- 5 tentatives (immédiat, +30 s, +5 min, +30 min, +2 h), timeout 15 s, puis `FAILED` définitif.
- Événements utiles : `transaction.success`, `transaction.failed`, `webhook.test`.
- Le `signing_secret` n'est affiché **qu'une fois** (création ou rotation).

### Point d'attention découvert dans la doc

Le payload `transaction.success` contient l'**id de transaction**, pas l'id de session de checkout,
et la doc ne garantit pas que nos `metadata` de session soient recopiées sur la transaction.
À la création d'une session, `transaction` vaut `null`. **On ne peut donc pas relier un webhook
à notre commande par son seul contenu.** → voir la stratégie de rapprochement (§ 5).

---

## 3. Architecture cible

```
Client (/subscription)
   │  « Payer en ligne » (forfait choisi)
   ▼
POST /api/payments/saspay/checkout          (auth client, serveur)
   │  1. vérifie forfait actif, aucune demande/paiement en cours
   │  2. INSERT online_payments (status 'pending', montant = prix du forfait en BDD)
   │  3. POST SasPay /checkout-sessions/ (amount, currency, return_url, metadata)
   │  4. UPDATE online_payments SET checkout_session_id, checkout_url
   ▼
redirection navigateur → https://pay.saspay.me/checkout/…
   │
   │ paiement OK ──► SasPay redirige (3 s) vers return_url
   │                 /subscription/paiement?ref=<online_payment_id>
   │                 → la page appelle GET /api/payments/saspay/status?ref=…  (déclenche une synchro)
   │
   └──────────────► SasPay envoie le webhook
                    POST /api/webhooks/saspay   (public, signature HMAC obligatoire)
                    → déclenche la synchro des paiements en attente

             syncOnlinePayment(id)  ← point UNIQUE de décision (src/lib/saspay/sync.ts)
               1. GET /checkout-sessions/{id}/status/  → transaction_id, statuts
               2. si transaction_id : GET /payments/{transaction_id}/verify/  (vérité gateway)
               3. si SUCCESS et montant/devise conformes :
                  transaction SQL idempotente → activateLicense(...) + facture + notification
               4. si FAILED / CANCELLED / expirée : marquer l'échec, notifier

Cron (filet de sécurité) /api/cron/saspay-reconcile  une fois par jour (7 h 30)
   → syncOnlinePayment sur les paiements 'pending' de moins de 48 h
```

**Règle d'or** : on n'active jamais une licence sur la foi du webhook ou du retour navigateur. Les
deux ne font que **déclencher** une vérification serveur auprès de SasPay
(`/payments/{id}/verify/` renvoie `SUCCESS`).

---

## 4. Modèle de données (migration idempotente)

Nouvelle table dédiée — on ne réutilise pas `payments` (héritage, enum différent) pour garder la
traçabilité SasPay complète. Script à ajouter à `supabase/neon_schema.sql`, testé d'abord sur
Neon **dev** (`ep-crimson-…`), puis production après `npm run backup` et accord explicite.

```sql
CREATE TABLE IF NOT EXISTS online_payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id              UUID NOT NULL REFERENCES subscription_plans(id),
  requested_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  provider             VARCHAR(20) NOT NULL DEFAULT 'saspay',
  environment          VARCHAR(10) NOT NULL CHECK (environment IN ('SANDBOX', 'LIVE')),
  amount               DECIMAL(12, 2) NOT NULL,
  currency             VARCHAR(3) NOT NULL,
  duration_months      INT NOT NULL CHECK (duration_months BETWEEN 1 AND 36),
  status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'expired')),
  checkout_session_id  VARCHAR(64) UNIQUE,
  checkout_url         TEXT,
  transaction_id       VARCHAR(64) UNIQUE,
  transaction_reference VARCHAR(100),
  amount_charged       DECIMAL(12, 2),       -- ce que le client a payé (frais inclus)
  amount_net           DECIMAL(12, 2),       -- ce que nous recevons
  network              VARCHAR(40),
  subscription_id      UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id           UUID REFERENCES invoices(id) ON DELETE SET NULL,
  failure_reason       TEXT,
  last_checked_at      TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_online_payments_org ON online_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_online_payments_pending ON online_payments(status, created_at)
  WHERE status = 'pending';
-- Un seul paiement en ligne en cours par organisation (anti double-clic / double onglet)
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_payments_one_pending
  ON online_payments(organization_id) WHERE status = 'pending';

-- Journal brut des webhooks reçus (audit + rejeu), sans données sensibles
CREATE TABLE IF NOT EXISTS saspay_webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   VARCHAR(60) NOT NULL,
  transaction_id VARCHAR(64),
  signature_ok BOOLEAN NOT NULL,
  payload      JSONB,
  received_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Et pour l'activation automatique : `activateLicense` exige aujourd'hui un `platformUserId`
(colonne `processed_by` + `platform_audit_logs`). Deux options :

- **A (recommandée)** : rendre `platformUserId` optionnel (`null` = « système / paiement en ligne »).
  `license_requests.processed_by` et `platform_audit_logs.platform_user_id` acceptent déjà `NULL`
  (vérifié dans `neon_schema.sql`) : aucune migration nécessaire, ajouter `new_data.source = 'saspay'`.
- B : créer un utilisateur plateforme technique « Paiement en ligne ».

---

## 5. Stratégie de rapprochement (le cœur de la fiabilité)

Comme le webhook ne contient pas notre identifiant de commande :

1. À la création, on stocke `checkout_session_id` (renvoyé par SasPay) et on passe
   `metadata: { online_payment_id, organization_id }` (utile au support SasPay, non utilisé pour décider).
2. `syncOnlinePayment(id)` interroge `GET /checkout-sessions/{session}/status/`, qui renvoie
   `transaction_id` + `transaction_status` dès que le client a payé → on enregistre `transaction_id`.
3. Puis `GET /payments/{transaction_id}/verify/` (SasPay re-vérifie auprès de l'opérateur).
4. Webhook reçu (`transaction.success` / `.failed`) :
   - si `data.id` correspond déjà à un `transaction_id` connu → synchro de ce paiement ;
   - sinon → synchro de **tous** les paiements `pending` récents (peu nombreux : un seul par
     organisation grâce à l'index unique).
5. Retour navigateur (`return_url`, la page interroge toutes les 4 s pendant 2 min), bouton
   « Revérifier » du back-office et cron quotidien déclenchent la même synchro. Le cron est
   quotidien car les crons Vercel plus fréquents demandent un plan payant ; le webhook et la page de
   retour couvrent le temps réel.

### Contrôles avant activation (dans une transaction SQL)

- `verify.status === 'SUCCESS'` et `flow_direction === 'INBOUND'` ;
- `requested_amount` == `online_payments.amount` et `currency` identique (le prix vient de **notre**
  BDD, jamais du navigateur) ;
- `UPDATE online_payments SET status='succeeded' … WHERE id=$1 AND status='pending' RETURNING id`
  → si 0 ligne, c'est déjà traité : **on s'arrête** (idempotence face aux webhooks rejoués,
  au cron et au retour navigateur simultanés) ;
- puis `activateLicense({ organizationId, planId, durationMonths, trial: false, platformUserId: null, note: 'Paiement SasPay <reference>' })`,
  facture marquée `paid` avec `payment_reference = transaction_reference`, notification client +
  super admins (« Licence activée automatiquement »), événement PostHog `license_paid_online`.

---

## 6. Fichiers à créer / modifier

| Fichier | Rôle |
|---|---|
| `src/lib/saspay/client.ts` | `saspayFetch()` : base URL, `Authorization`, timeout 15 s, déballage de l'enveloppe, erreurs typées (`401/403/404/409/410/422/429`), aucun log de la clé |
| `src/lib/saspay/webhook.ts` | `verifySaspaySignature(rawBody, sig, ts, secret)` (HMAC, 300 s, `timingSafeEqual`) |
| `src/lib/saspay/sync.ts` | `syncOnlinePayment(id)` + `syncPendingPayments()` — seul endroit qui décide |
| `src/app/api/payments/saspay/checkout/route.ts` | `POST` client authentifié → crée paiement + session, renvoie `checkout_url` |
| `src/app/api/payments/saspay/status/route.ts` | `GET ?ref=` client authentifié (son organisation uniquement) → synchro + statut |
| `src/app/api/webhooks/saspay/route.ts` | `POST` public, lit `await request.text()` (corps **brut**), vérifie, journalise, déclenche la synchro, répond `200` vite |
| `src/app/api/cron/saspay-reconcile/route.ts` | Cron protégé par `CRON_SECRET` + ajout dans `vercel.json` |
| `src/app/(dashboard)/subscription/paiement/page.tsx` | Page de retour : « Paiement en cours de vérification… » puis succès/échec |
| `src/app/(dashboard)/subscription/page.tsx` / `LicenseRequestDialog.tsx` | Bouton « Payer en ligne (Mobile Money / Carte) » à côté du paiement manuel |
| `src/lib/platform-actions.ts` | `platformUserId` optionnel (option A) |
| `src/proxy.ts` | Ajouter `/api/webhooks/saspay` et `/api/cron/saspay-reconcile` à la liste des routes publiques (comme `/api/telegram/webhook`) — sinon SasPay reçoit une redirection vers la connexion |
| `src/app/platform/payments/page.tsx` | Onglet « Paiements en ligne » (statut, réseau, montants brut/net, lien transaction) |
| `supabase/neon_schema.sql` | Migration § 4 |

---

## 7. Variables d'environnement

| Variable | Local / Preview (Neon dev) | Production |
|---|---|---|
| `SASPAY_API_KEY` | `sk_test_…` (clé SANDBOX, scope PAYIN) | `sk_live_…` (scope PAYIN) |
| `SASPAY_WEBHOOK_SECRET` | secret du webhook de test | secret du webhook de prod |
| `SASPAY_API_BASE_URL` | `https://api.saspay.me/api/v1` | idem |
| `SASPAY_ENABLED` | `true` | `false` tant que non validé, puis `true` |

Garde-fou à ajouter (dans l'esprit de `src/lib/env-guard.ts`) : **refuser une clé `sk_live_` hors
`VERCEL_ENV === 'production'`** et une clé `sk_test_` en production. Le bouton « Payer en ligne »
est masqué si `SASPAY_ENABLED !== 'true'`.

Rien de tout cela n'est commité : `.env.local` en local, `vercel env add … preview|production`.

---

## 8. Sécurité (alignée sur `docs/CHECK_SECURITE.md`)

- Clé SasPay uniquement côté serveur, jamais en `NEXT_PUBLIC_*`, jamais dans les logs.
- Montant et devise lus en BDD depuis `subscription_plans`, jamais depuis la requête client.
- Route `checkout` et `status` : utilisateur authentifié + `organization_id` du profil ; un client
  ne peut voir/synchroniser que ses propres paiements.
- Webhook : signature + fraîcheur obligatoires, sinon `401` et ligne `signature_ok = false`
  (alerte Telegram si répétée, via le module d'alertes d'intrusion existant).
- Webhook ne fait **jamais** confiance au statut du payload : il déclenche `verify`.
- Idempotence par `UPDATE … WHERE status='pending'` + index uniques (`checkout_session_id`, `transaction_id`).
- `return_url` construite côté serveur à partir de l'URL du site (pas de paramètre client) → pas
  d'open redirect.
- Messages d'erreur client génériques (`toast.error`), détails SasPay journalisés côté serveur.

---

## 9. Plan de mise en œuvre

### Étape 0 — Pendant la validation du compte (maintenant)
- [x] Lecture de la doc et choix d'architecture (ce document).
- [ ] Compléter le KYC sur app.saspay.me (dossier `BUSINESS` : RCCM, IFU, pièce d'identité).
- [ ] Demander au support SasPay : une clé **SANDBOX** est-elle utilisable avant validation du KYC ?
      Les `metadata` d'une session sont-elles recopiées sur la transaction / le webhook ?
      Quels réseaux sont testables en sandbox et avec quels numéros ?
- [ ] Décider du mode de frais (`ADD_ON` : le client paie les frais ; `DEDUCTED` : on les absorbe).
- [ ] Coder toute l'intégration sur `develop` avec des tests unitaires de la signature et de la
      synchro (réponses SasPay simulées) — possible **sans** clé.

### Étape 1 — Sandbox (dès réception d'une clé `sk_test_`)
- [ ] `SASPAY_API_KEY` (test) + `SASPAY_ENABLED=true` dans `.env.local` et Vercel **Preview**.
- [ ] Créer dans le tableau de bord un webhook vers l'URL Preview
      `https://<preview>/api/webhooks/saspay`, abonné à `transaction.success`, `transaction.failed` ;
      copier le secret immédiatement.
- [ ] Migration § 4 sur Neon dev.
- [ ] Scénarios : paiement réussi, échec, abandon, double clic, webhook rejoué, webhook à signature
      fausse (doit être rejeté), webhook jamais reçu (le cron doit rattraper), `webhook.test`.

### Étape 2 — Production (compte validé, accord explicite)
- [ ] Clé `sk_live_` (scope PAYIN) + nouveau webhook de prod vers `https://www.optiwifi.site/api/webhooks/saspay`.
- [ ] `npm run backup`, migration sur Neon prod, merge `develop` → `main` selon `PROCEDURE_DEPLOIEMENT.md`.
- [ ] Premier paiement réel de faible montant, vérification facture + licence + notifications.
- [ ] `SASPAY_ENABLED=true` en production.

### Plus tard (V2)
- Softpay intégré à l'app (sans redirection).
- Renouvellement en un clic depuis le rappel d'expiration (`/api/cron/licence-reminders` envoie le
  lien de paiement).
- Liens de paiement SasPay (`/payment-links/`) pour les ventes de tickets aux clients finaux.
- Payouts (commissions collecteurs) — nécessite IP whitelistée, incompatible avec les IP dynamiques
  de Vercel sans IP statique : à étudier séparément.

---

## 10. Codes d'erreur à gérer

| HTTP | Cas | Réaction |
|---|---|---|
| `401` | clé invalide/expirée | alerte admin, bouton masqué, message générique au client |
| `403` | scope insuffisant / compte suspendu | alerte admin |
| `409` | état déjà terminal | considérer comme déjà traité, relancer `verify` |
| `410` | session expirée | `online_payments.status = 'expired'`, proposer un nouveau paiement |
| `422` | `no_route_available`, `invalid_method`… | message « moyen de paiement indisponible, réessayez ou payez manuellement » |
| `429` | limite de débit | backoff, le cron reprendra |
| réseau / timeout | issue inconnue | ne rien conclure : la synchro suivante tranchera |

---

## 11. Implémentation (ce qui existe dans le code)

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261116_online_payments.sql` | Tables `online_payments`, `saspay_webhook_events` (appliquée sur Neon **dev** le 16/11/2026 ; **pas encore en production**) |
| `src/lib/saspay/client.ts` | Appels SasPay + garde-fou des clés (`getSaspayConfig`) |
| `src/lib/saspay/webhook.ts` | Vérification HMAC + fraîcheur 300 s |
| `src/lib/saspay/payments.ts` | `startOnlinePayment`, `syncOnlinePayment` (seul point qui active une licence), `syncPendingPayments` |
| `src/app/api/payments/saspay/checkout` | `GET` : paiement en ligne proposé ? `POST { planId }` : URL de paiement |
| `src/app/api/payments/saspay/status` | `GET ?ref=` : statut + vérification (page de retour) |
| `src/app/api/webhooks/saspay` | Webhook SasPay |
| `src/app/api/cron/saspay-reconcile` | Rattrapage quotidien |
| `src/app/api/platform/online-payments` | Back-office : liste, état de la config, « Revérifier » |
| `src/components/payments/LicenseRequestDialog.tsx` | Bouton « Payer en ligne » (au-dessus du paiement manuel) |
| `src/app/(dashboard)/subscription/paiement/page.tsx` | Page de retour après paiement |
| `src/components/platform/OnlinePaymentsSection.tsx` | Section « Paiements en ligne (SasPay) » dans Transactions |
| `src/lib/platform-actions.ts`, `src/lib/invoices.ts` | Activation sans admin (`platformUserId: null`), moyen et référence reportés sur la facture |

Règles d'accès : seuls l'administrateur du client (pas collecteur ni compte point de vente) peut
payer ; organisation suspendue refusée ; refus si une demande de licence manuelle est déjà en attente.
Un seul paiement en cours par organisation : un second clic dans les 30 min reprend la même session.

### Test local

```bash
# Terminal 1 : faux SasPay ; Terminal 2 : app branchée dessus (configs dans .claude/launch.json)
node scripts/saspay/mock-server.mjs 4599
# puis : node --env-file=.env.local scripts/saspay/e2e-test.mjs   (base dev, remise en état automatique)
```

### Mise en service

1. **Preview / dev** : dans Vercel (environnement Preview) et `.env.local` : `SASPAY_ENABLED=true`,
   `SASPAY_API_KEY=sk_test_…`, `SASPAY_WEBHOOK_SECRET=…`.
2. Tableau de bord SasPay → Développeur → Webhooks : URL `https://<domaine>/api/webhooks/saspay`,
   événements `transaction.success`, `transaction.failed` (et `webhook.test`). Copier le secret
   immédiatement (affiché une seule fois). Un webhook par environnement.
3. Faire un vrai paiement de test, vérifier dans Transactions → « Paiements en ligne (SasPay) ».
4. **Production** (accord explicite) : `npm run backup`, migration sur Neon prod, variables
   Production avec la clé `sk_live_…`, webhook de prod vers `https://www.optiwifi.site/api/webhooks/saspay`.

---

## 12. Interrupteur SasPay / paiement manuel (super admin)

Back-office → **Moyens de paiement** → « Mode de paiement des licences » :
- **Paiement en ligne (SasPay)** : le client ne voit qu'un bouton « Passer au paiement » ;
- **Paiement manuel** : QR code, numéro, justificatif WhatsApp, validation par l'admin.

Réglage stocké dans `platform_settings.payment_mode` (une valeur par base : dev et production
indépendants, sans redéploiement). Si SasPay est choisi mais indisponible (clé absente, clé live hors
production…), les clients voient automatiquement le paiement manuel et l'écran l'indique.
Les paiements SasPay déjà en cours continuent d'être vérifiés quel que soit le mode.

### Obtenir une clé de test (Sandbox)

Si le tableau de bord SasPay ne propose pas de clé « Sandbox / Test », la créer avec le même appel
que le tableau de bord, depuis son propre terminal (identifiants saisis localement, jamais stockés) :

```bash
node scripts/saspay/create-sandbox-key.mjs
```
