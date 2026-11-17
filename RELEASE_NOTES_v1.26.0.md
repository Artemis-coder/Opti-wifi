# OptiSpace v1.26.0 — 4 Mini Apps Telegram et chiffres alignés sur le tableau de bord

**Date :** 17 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.25.0 (17/11/2026)
**PR de mise en production :** #102

Aucune migration, aucune variable d'environnement.

---

## ✨ Nouveautés — Bot Telegram : 4 Mini Apps

Le menu d'accueil du bot devient 4 applications au style du back-office, avec KPI et graphiques (barres, courbes, anneau), en clair ou sombre selon Telegram. Un sélecteur en haut de chaque application permet de passer de l'une à l'autre.

| Mini App | KPI et graphiques | Actions |
|---|---|---|
| **📊 Business OptiSpace** (remplace « Ouvrir OptiSpace ») | encaissé ce mois et cette année, les 6 indicateurs du tableau de bord, À traiter, onglet Stats (mêmes graphiques que le tableau de bord) et collectes des clients | approuver / refuser une demande, clients, licences à renouveler |
| **🤖 IA — Claude Code** | demandes à valider, en cours, livrées, bloquées ; demandes par semaine ; répartition par statut | valider le plan, intégrer, corriger, relancer, abandonner, nouvelle demande, mise en production |
| **💳 Paiement en ligne** | encaissé en ligne, taux de réussite, montant par jour, paiements par résultat et par réseau | bascule SasPay / manuel, transactions, revérification d'un paiement en attente |
| **🛡️ Système** | disponibilité sur 7 jours, composants en alerte, tentatives d'intrusion par jour et par type | contrôle de santé complet en direct, incident résolu / fausse alerte |

Les actions passent par les mêmes fonctions que les boutons du chat et que le back-office. Pour IA, le détail de chaque étape continue d'arriver dans la conversation.

## 🐛 Corrections
- **« Encaissé ce mois »** (Mini App et bot) = chiffre d'affaires des **licences payées**, comme « Revenus encaissés » du tableau de bord super admin. Les collectes des clients (argent de leurs points de vente WiFi) sont présentées à part.
- **API du tableau de bord** : `revenue_*` et `new_clients_*` valaient toujours 0 (dates comparées en texte). Champs non affichés sur la page ; les KPI affichés, « À traiter » et les statistiques sont inchangés.
- Une seule source pour les KPI du tableau de bord (`lib/platform-dashboard.ts`) : back-office, Mini Apps et bot affichent les mêmes chiffres.
- Graphiques du tableau de bord : ils suivent le thème réellement affiché (`data-theme`).

---

## 🔒 Sécurité
- Chaque API de Mini App (`/api/telegram/miniapp`, `/ia`, `/paiements`, `/systeme`) vérifie la signature Telegram du super admin (12 h max, 120 appels par minute et par IP).
- Affichage dans Telegram Web autorisé sur `/telegram/app` et ses sous-pages uniquement.

## 🗄️ Base de données
- Aucune migration.
- Sauvegarde : `backup-prod-neon-2026-11-17T21-35-29-211Z.json` (41 tables, 650 lignes, aucune table en baisse), prise avant la fusion (21:35:29, fusion à 21:36:04).
- Branche Neon `backup-prod-20261117-2135` (jusqu'au 17/12/2026), créée après coup à partir de la production telle qu'elle était à 21:34:22, avant la fusion (la limite de 10 branches du projet avait bloqué sa création ; `backup-prod-20261117-1933` a été supprimée pour faire de la place).

## ⚠️ Points connus
- Projet Neon à 10 branches sur 10 : la prochaine `npm run backup:prod` devra libérer une place (supprimer une ancienne `backup-prod-*`).
- Ancien deploy hook Vercel (`xsZK…`) à désactiver ; mise à jour de sécurité de Next.js à planifier.

## ✅ Vérifications
- `tsc` 0 erreur, ESLint sans erreur, `npm run build` OK, scan des secrets ; vérifications GitHub au vert.
- Dev : `/api/platform/dashboard` comparé avant / après la refonte.
- Test local avec une signature Telegram générée pour un jeton de test, sur la base dev : 4 Mini Apps, KPI et graphiques, passage d'une application à l'autre, thème sombre, en-têtes CSP.
- **Production** : déploiement prêt ; les 4 Mini Apps répondent, leurs API refusent les appels sans signature (401).
- Non vérifié : ouverture depuis le vrai bot ; actions qui modifient des données dans IA, Paiement et Système.
