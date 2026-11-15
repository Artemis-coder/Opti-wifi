# OptiSpace v1.18.0 — Paiement en ligne des licences (SasPay)

**Date :** 15 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.17.1 (15/11/2026)
**PR de mise en production :** #89

Les clients paient leur licence en ligne (Mobile Money ou carte, via SasPay) et la licence s'active
automatiquement, sans validation manuelle. Le paiement manuel reste disponible en secours.

---

## 💳 Paiement en ligne (SasPay)
- **« Passer au paiement »** (Abonnement → Me réabonner / Choisir ce forfait) : un seul bouton, le client
  choisit son opérateur ou sa carte sur la page SasPay. Plus de choix de pays ni de QR code dans ce mode.
- **Licence activée automatiquement** dès que SasPay confirme le paiement : facture « payée » émise
  (moyen et référence SasPay), notification au client et au super admin.
- **Page de retour** après paiement : « Paiement confirmé, licence activée », ou paiement en attente / non abouti.
- **Sécurité** : la licence n'est activée qu'après vérification auprès de SasPay (`verify` → SUCCESS) ;
  webhooks signés (HMAC, rejet au-delà de 5 min) ; montant toujours lu dans le forfait en base ; une seule
  activation par paiement, même si la confirmation arrive plusieurs fois.
- **Prix toujours à jour** : modifier un forfait ferme les pages SasPay encore ouvertes à l'ancien prix.
- **Montant minimum SasPay : 200 XOF** : en dessous, message clair au client.

## 🛠️ Back-office
- **Transactions** : switch **Paiement en ligne / Paiement manuel** sous les indicateurs, avec le mode actif
  pour les clients, la liste propre à chaque type et les actions « Revérifier » / « Annuler ».
- **Moyens de paiement** : choix du mode proposé aux clients (SasPay ou manuel, repli automatique sur le
  manuel si SasPay est indisponible) et bouton **« Tester la connexion SasPay »**.
- **Tableau de bord** : KPI alignés sur les chiffres réels — Revenus encaissés = paiements réussis (en ligne +
  manuels), Licences vendues = factures payées, Inscriptions = comptes clients ; total depuis le début, avec le
  chiffre de la période et l'évolution.

## 🤖 Technique
- Client SasPay serveur (`src/lib/saspay/`), garde-fou des clés : `sk_live_` seulement en production,
  `sk_test_` jamais en production.
- Rattrapage quotidien des paiements en attente (`/api/cron/saspay-reconcile`, 7 h 30).
- Règles officielles SasPay ajoutées à `AGENTS.md` et skill `saspay-integration` dans `.claude/skills`.
- Faux serveur SasPay et test de bout en bout : `scripts/saspay/`.

## 🗄️ Base de données
- Migration `supabase/migrations/20261116_online_payments.sql` (idempotente) : tables `online_payments`
  et `saspay_webhook_events`, accessibles uniquement par l'API serveur.

## 🔐 Variables d'environnement (Production)
- `SASPAY_ENABLED`, `SASPAY_API_KEY` (`sk_live_…`, scope PAYIN), `SASPAY_WEBHOOK_SECRET`.
- Webhook SasPay de production : `https://www.optiwifi.site/api/webhooks/saspay` (transactions).

## ⚠️ Points connus
- En mode Sandbox, SasPay a envoyé une vraie demande sur un vrai numéro MTN : à confirmer avec SasPay.
- Pas de remboursement en ligne : un remboursement se fait depuis le tableau de bord SasPay.

---

## ✅ Vérifications de cette version
- `tsc`, `eslint` (fichiers modifiés) et `npm run build` sans erreur.
- Test de bout en bout contre un faux SasPay (paiement, webhook signé, idempotence, échec, changement de prix).
- **Dev** : vrai paiement MTN de 200 F — licence activée en 1 s, une seule fois, facture émise.
- **Production** : sauvegarde complète (39 tables, 464 lignes), migration en une transaction (2 tables,
  8 index, RLS active, données existantes intactes), déploiement `df8665b` prêt, routes SasPay en place
  (webhook : signature exigée), secret du webhook de production chargé.
- **À confirmer en production** : clé live (« Tester la connexion SasPay ») et premier vrai paiement.
