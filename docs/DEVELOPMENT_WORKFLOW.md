# Workflow de Développement Git — OptiWifi / OptiSpace

> **Règle absolue :** La branche `main` et la base Neon de production sont **strictement protégées**. Aucune modification directe n'est tolérée sur `main`. Tout le travail s'effectue sur `develop` ou sur des branches `feature/*`.

> 📌 **Procédure à suivre pour chaque modification et chaque mise en production : [`PROCEDURE_DEPLOIEMENT.md`](./PROCEDURE_DEPLOIEMENT.md).**
> Depuis le 25/10/2026, le travail se fait directement sur `develop` ; push forcé et `vercel --prod` sont interdits
> (un push forcé du 23/10 a effacé ~30 commits de `develop` et `main`).

---

## 1. Vue d'ensemble des branches Git

| Branche | Rôle | Environnement Vercel | Base Neon associée | Accès / Droits |
|---|---|---|---|---|
| `main` | Production réelle | **Production** (`https://www.optiwifi.site`) | `production` (`ep-flat-term-***`) | Protégée — Validation explicite requise |
| `develop` | Intégration continue | **Preview** | `vercel-dev` (`ep-crimson-***`) | Branche de travail principale |
| `feature/*` | Fonctionnalités isolées | **Preview** (optionnel) | `vercel-dev` (`ep-crimson-***`) | Créée depuis `develop` |
| `release/*` | Stabilisation (optionnel) | **Preview / Staging** | `vercel-dev` ou branche dédiée | Validée avant merge `main` |

---

## 2. Procédure pour chaque nouvelle fonctionnalité

Toute nouvelle tâche ou fonctionnalité doit suivre scrupuleusement ce cycle :

```
[develop] ──(création)──> [feature/nom-feature]
                               │
                       (développement + tests locaux)
                               │
                               v
                     (Push & Vercel Preview)
                               │
                               v
                   (Pull Request vers develop)
                               │
                               v
                  [develop déployé en Preview]
```

### Étape 1 : Préparation et vérification de l'état Git
Avant toute action :
```bash
git status
git fetch origin
git switch develop
git pull --ff-only origin develop
```
*Note : Si des modifications locales existent, les préserver avec `git stash` ou les valider proprement sur la branche adéquate. Ne jamais forcer un reset.*

### Étape 2 : Création de la branche de fonctionnalité
Toujours partir de `develop` à jour :
```bash
git switch -c feature/nom-de-la-fonctionnalite
```
Exemples de nommage :
- `feature/authentication-enhancements`
- `feature/pos-bulk-export`
- `feature/mobile-scanner-v2`
- `fix/query-builder-join-alias`

### Étape 3 : Développement et validation locale
Pendant le développement :
1. Vérifier que `.env.local` pointe bien vers la base Neon de développement (`ep-crimson-shape-ayvbw15x...`).
2. Exécuter les contrôles locaux réguliers :
   ```bash
   npx tsc --noEmit
   npm run build
   ```
3. Ne jamais inclure de clés de production ni de secrets dans le code ou les commits.

### Étape 4 : Déploiement Vercel Preview
Pousser la branche de fonctionnalité vers GitHub :
```bash
git push -u origin feature/nom-de-la-fonctionnalite
```
- Vercel déclenche automatiquement un déploiement **Preview**.
- Ce déploiement utilise les variables de l'environnement Preview configurées sur Vercel (pointant sur la base Neon `vercel-dev`).
- L'URL de prévisualisation générée par Vercel permet de tester la fonctionnalité en conditions réelles sans aucun impact sur la production.

### Étape 5 : Intégration dans `develop`
Une fois la fonctionnalité validée :
1. Créer une Pull Request de `feature/nom-de-la-fonctionnalite` vers `develop`.
2. Vérifier les contrôles de build et les tests.
3. Fusionner la PR dans `develop` (sans rebase destructif).
4. Supprimer la branche de fonctionnalité locale et distante après fusion.

---

## 3. Procédure de mise en production (Passage vers `main`)

La mise en production est une opération critique et planifiée.

> ⛔ **INTERDICTION : Ne jamais fusionner automatiquement `develop` vers `main`.**

### Pré-requis pour la mise en production :
1. Validation complète sur `develop` en Vercel Preview.
2. Préparation d'une synthèse des changements (changelog / release notes).
3. Si des modifications de schéma de base de données sont requises :
   - Tester le script SQL d'abord sur la base Neon de développement.
   - S'assurer que le script est idempotent (`IF NOT EXISTS`, etc.).
   - Faire une sauvegarde de la production préalable (`npm run backup`).
4. **Validation explicite obligatoire du propriétaire du projet.**
5. Création d'une Pull Request de `develop` vers `main` (ou release tag).
6. Après validation et merge, surveiller le déploiement de production sur Vercel et vérifier le endpoint `/api/cron/health-check` et les logs.

---

## 4. Règles et Interdictions Strictes

- ❌ **JAMAIS** de commit ou de push direct sur `main`.
- ❌ **JAMAIS** de `git reset --hard` ou de `git push --force` sur les branches partagées (`main`, `develop`).
- ❌ **JAMAIS** de chaîne de connexion Neon Production dans `.env.local`, `.env.example`, ou dans le code source.
- ❌ **JAMAIS** de script de seed, reset ou migration destructive exécuté sur la base de production sans autorisation explicite et sauvegarde préalable.
- ❌ **JAMAIS** de modification de la configuration Vercel Production sans accord préalable.
