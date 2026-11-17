# OptiSpace v1.25.0 — Mini App Telegram : le back-office dans Telegram

**Date :** 17 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.24.0 (17/11/2026)
**PR de mise en production :** #101

Aucune migration, aucune variable d'environnement.

---

## ✨ Nouveautés — Bot Telegram

### Bouton « 📱 Ouvrir OptiSpace »
- En tête du menu d'accueil du bot, et bouton de menu **« OptiSpace »** à gauche de la zone de saisie (posé au `/start` et au retour au menu principal).
- Il ouvre une page de l'application **dans Telegram** (`/telegram/app`), au style du back-office : HeroUI, tuiles de chiffres clés, étiquettes d'état, boutons et barre de navigation mobile. Le mode clair ou sombre suit celui de Telegram.

### Quatre onglets
- **Accueil** : encaissé ce mois (et mois dernier), clients actifs, demandes en attente, licences à renouveler, utilisateurs, points de vente, collectes du mois, dernières inscriptions.
- **Demandes** : une carte par demande en attente (forfait, durée, contact, licence actuelle, message), avec **Approuver** et **Refuser** après confirmation — mêmes fonctions que le back-office.
- **Clients** : recherche, forfait, fin de licence, statut ; un clic ouvre la fiche dans le back-office.
- **Licences** : expirations sous 30 jours (J-x) et clients expirés sans renouvellement.

Le chat avec l'assistant ne change pas.

---

## 🔒 Sécurité
- Chaque appel à `/api/telegram/miniapp` vérifie la **signature Telegram** (`initData`, HMAC-SHA256 dérivé du jeton du bot). Seul le compte Telegram du super admin (`TELEGRAM_CHAT_ID`) est accepté ; une ouverture reste valable 12 h ; 120 appels par minute et par IP.
- Ouverture par un autre compte : événement de sécurité `bot_stranger`.
- `frame-ancestors 'self' https://web.telegram.org` sur `/telegram/app` uniquement (Telegram Web l'affiche dans une iframe) ; les autres pages gardent `frame-ancestors 'none'`.

---

## 🗄️ Base de données
- Aucune migration.
- Sauvegarde : `backup-prod-neon-2026-11-17T20-52-04-324Z.json` (41 tables, 648 lignes, aucune table en baisse) et branche Neon `backup-prod-20261117-2052` (jusqu'au 17/12/2026). Lancée une minute après la fusion de la PR ; sans migration, elle reflète l'état d'avant la publication.

## ✅ Vérifications
- `tsc` 0 erreur, ESLint sans erreur, `npm run build` OK, scan des secrets ; vérifications GitHub au vert.
- Test local avec une signature Telegram générée pour un jeton de test, sur la base dev : 4 onglets, refus d'une demande (confirmation, toast, liste à jour ; données de test supprimées), thème sombre, signature fausse ou absente refusée (401).
- **Production** : déploiement prêt ; `/telegram/app` répond, en-tête Telegram Web en place, API refusée sans signature (401).
- Non vérifié dans cette session : l'ouverture depuis le vrai bot et le bouton « Approuver » sur une vraie demande.
