# OptiSpace v1.26.1 — Correctif de sécurité Next.js et rotation des sauvegardes

**Date :** 17 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.26.0 (17/11/2026)
**PR de mise en production :** #103

Aucune migration, aucune variable d'environnement.

---

## 🔒 Sécurité
- **Next.js 16.4.3 → 16.4.6** : corrige deux avis sur des fuites de cache entre valeurs de paramètres (versions 16.2.0 à 16.4.4) — [GHSA-mfr8-8qww-v76h](https://github.com/advisories/GHSA-mfr8-8qww-v76h), [GHSA-vc7v-qv4w-wrv8](https://github.com/advisories/GHSA-vc7v-qv4w-wrv8). Le projet n'utilise ni `'use cache'` ni `unstable_cache` : exposition faible, mais le build ne s'arrête plus sur l'alerte de sécurité.
- `eslint-config-next` aligné en 16.4.6. Version de correctif, sans changement majeur.

## 🛠️ Sauvegardes
- **Rotation automatique des branches Neon** (`scripts/neon-backup-rotate.mjs`) : `npm run backup:prod` garde les 3 dernières branches `backup-prod-*` et laisse toujours une place libre (projet Neon limité à 10 branches). Ne touche à aucune autre branche ; s'arrête avec un message clair si aucune place n'est libérable.
- Simulation sans écriture ni suppression : `BACKUP_DRY_RUN=1 npm run backup:prod`.
- Procédure : la sauvegarde se fait **avant** l'ouverture de la PR `develop → main`.

---

## 🗄️ Base de données
- Aucune migration.
- Sauvegarde faite avant l'ouverture de la PR : `backup-prod-neon-2026-11-17T21-53-45-081Z.json` (41 tables, 650 lignes, aucune table en baisse) et branche Neon `backup-prod-20261117-2153` (jusqu'au 17/12/2026) ; la rotation a supprimé `backup-prod-20261117-2033`.

## ⚠️ Points connus
- `npm audit` : 15 alertes « high » dues à `picomatch` (ReDoS), utilisé uniquement par les outils de développement (ESLint, surveillance de fichiers) ; aucune version corrigée publiée.
- ESLint : 15 erreurs déjà présentes dans des fichiers non modifiés (pages espaces, mot de passe, factures…).
- Ancien deploy hook Vercel (`xsZK…`) à désactiver dans le tableau de bord Vercel.

## ✅ Vérifications
- `tsc` 0 erreur, `npm run build` OK sans alerte de sécurité, scan des secrets ; vérifications GitHub au vert.
- Application compilée en local : redirections, page de connexion sans erreur JavaScript, Mini Apps, tableau de bord super admin connecté.
- Rotation Neon : simulation, 5 cas limites avec un faux `neonctl`, puis exécution réelle.
- **Production** : déploiement prêt ; pages principales et Mini Apps répondent, API des Mini Apps refusée sans signature (401).
