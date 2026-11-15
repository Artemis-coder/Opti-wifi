# OptiSpace v1.15.0 — Claude Code dans le bot Telegram

**Date :** 15 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.14.1 (15/11/2026)
**PR de mise en production :** #85

Le bot Telegram est organisé en deux univers. Le premier est **🤖 IA — Claude Code** : vous confiez une fonctionnalité ou une correction à Claude, qui propose un plan, développe après votre accord et vous soumet le résultat. Le second est **📊 Business OptiSpace**, qui regroupe le suivi de l'activité. Rien n'est intégré ni mis en production sans votre validation.

---

## 💬 Bot Telegram : deux univers
- **Accueil** (`/menu`) : 🤖 IA — Claude Code, 📊 Business OptiSpace, ❓ Aide.
- **📊 Business OptiSpace** :
  - vue d'ensemble, demandes de licence, clients, licences à renouveler, encaissements, statut technique ;
  - 🛡️ Sécurité et 🩺 Santé de l'application ;
  - questions libres, à l'écrit ou à l'oral.
- **🤖 IA — Claude Code** (`/ia`) : ✍️ Nouvelle demande (écrite ou vocale), ⏳ En cours, ✅ À valider, 🗂️ Historique, 🚀 Mise en production.

## 🤖 Développement par Claude Code, validé depuis Telegram
1. **Demande** : vous décrivez votre besoin. Claude est réveillé dans le cloud d'Anthropic, sans dépendre d'un ordinateur allumé.
2. **Plan** : ce que Claude a compris, ce qui change pour les utilisateurs, étapes, fichiers, base de données, risques et ampleur. Vous choisissez ✅ Valider, ✏️ Modifier (à l'écrit ou à l'oral) ou ❌ Abandonner.
3. **Développement** : sur une branche dédiée, avec vérifications (types, lint, build). L'application ouvre la PR vers `develop` et vous envoie le récapitulatif, avec « Comment tester » et les points non testés. Vous choisissez ✅ Intégrer, ✏️ Corriger ou ❌ Abandonner.
4. **🚀 Mise en production** : la liste de ce qui part s'affiche, puis votre confirmation est demandée. Ensuite, la release est créée automatiquement, avec les notes de version rédigées par Claude.

**Confidentialité :** le dépôt GitHub est public, donc le contenu des demandes reste dans la base OptiSpace. Claude le lit par une API protégée. Seuls le numéro de la demande et l'action lui sont transmis au réveil.

## 🔒 Sécurité
- Jetons dédiés pour l'agent de développement et pour la routine. Une tentative avec un mauvais jeton est enregistrée comme incident.
- L'agent ne peut ni fusionner, ni pousser sur `develop` ou `main`, ni mettre en production : seuls vos boutons Telegram le peuvent.
- Accès GitHub de l'application limité au dépôt du projet (contenus et PR).

## 🗄️ Base de données
- Nouvelle table `dev_requests`, créée automatiquement à la première demande. Migration idempotente : `supabase/migrations/20261115_dev_requests.sql`. Aucune table existante modifiée.

## ⚙️ Variables d'environnement (Production)
- `GITHUB_TOKEN` : jeton GitHub limité au dépôt, à renouveler avant son expiration (1 an).
- `DEV_AGENT_TOKEN` : accès de l'agent de développement.
- `CLAUDE_DEV_ROUTINE_URL` et `CLAUDE_DEV_ROUTINE_TOKEN` : réveil de la routine `optispace-agent-dev`.

---

## ⚠️ Points connus
- Chaque demande consomme le quota de l'abonnement Claude. La routine peut aussi être réveillée au plus 30 fois par heure.
- Les migrations de base proposées par Claude sont écrites, mais jamais exécutées par lui : le propriétaire les lance avant la mise en production.
- La fonction de déclenchement des routines par API est en « research preview » chez Anthropic : son format peut évoluer.

---

## ✅ Vérifications de cette version
- `tsc` sans erreur, lint sans nouvelle erreur, build réussi.
- **En local, sur la base dev :**
  - API de l'agent : refus sans jeton ou avec un mauvais jeton ;
  - ordre des étapes respecté ;
  - branches piégées refusées ;
  - passage plan → validation → récapitulatif ;
  - données de test supprimées.
- **Lectures GitHub réelles :** comparaison des branches, dernière release, calcul de la version suivante.
- **Production :** déploiement prêt, site et API qui répondent.
- **Non testé en conditions réelles :** le circuit complet avec la routine Claude, ainsi que les fusions et la release par l'API GitHub. Le premier test se fera avec une petite demande depuis Telegram.
