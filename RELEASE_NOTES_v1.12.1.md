# OptiSpace v1.12.1 — Corrections de sécurité (rapport Herald)

**Date :** 14 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.12.0 (13/11/2026)

Version de maintenance : elle corrige les points relevés par l'analyse Herald du 14/11/2026. Aucune nouveauté fonctionnelle, aucune migration, aucune variable d'environnement.

---

## 🔒 Sécurité
- **API publique du site vitrine** (`/api/public/site-content`) : l'en-tête CORS `Access-Control-Allow-Origin: *` est retiré. Le site vitrine lit cette route côté serveur, aucun navigateur tiers n'a besoin de l'appeler.
- **Dépendances de développement** : `typescript-eslint` passe en 8.72.2 et `minimatch` est forcé en version 11 (faille de déni de service GHSA-g3hv-75wg-m249). `npm audit` : 0 vulnérabilité.
- **Dépôt** : les fichiers de cookies curl (`cookies.txt`, `*.cookies`), qui contiennent des jetons de session, sont ignorés par Git.

## 🛠️ Corrections
- **Plateforme > Factures** et **Plateforme > Paiements** : un échec de chargement affiche maintenant un message d'erreur, au lieu d'une liste vide sans explication.
- **Connexion** : l'échec du démarrage du mode hors ligne est journalisé au lieu de rester silencieux.

## 📋 Analyse du rapport Herald
- **Fichiers `.env` versionnés** : faux positif. Aucun fichier `.env` réel n'est dans Git, ni aujourd'hui ni dans l'historique. Seuls les `.env.example` le sont.
- **CVE Python (Pillow, filelock, certifi, fsspec, mcp…)**, requêtes SQL formatées, routes sans authentification et chemins `/tmp` : tous dans le dossier `agents/`, un dépôt d'outils tiers ignoré par Git et non déployé.

## 🗄️ Base de données
Aucune migration.

---

## ✅ Vérifications de cette version
- `tsc` 0 erreur ; lint sans nouvelle erreur ; `npm run build` réussi ; `npm audit` 0 vulnérabilité ; scan des secrets.
- Local et dev.optiwifi.site : `/api/public/site-content` répond 200 avec le contenu et les forfaits, sans en-tête CORS.
- Production : sauvegarde complète en lecture seule (36 tables) avant la mise en production.
