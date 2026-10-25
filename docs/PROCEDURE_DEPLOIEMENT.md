# Procédure de déploiement — OptiWifi / OptiSpace

> À suivre pour **chaque** modification, par un humain comme par un agent IA.
> Elle complète [`DEVELOPMENT_WORKFLOW.md`](./DEVELOPMENT_WORKFLOW.md) et [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md).

## Pourquoi cette procédure

Le **23/10/2026 à 15:12 UTC**, `develop` puis `main` ont été réinitialisés par **push forcé** (`0c85278 → 7225f8b`) pour revenir à l'état du 22/10.
Environ **30 commits** (39 fichiers, ~3 300 lignes) ont disparu des deux branches : montant net après commission, horodatage exact,
quotas, suppression d'utilisateur, page Paramètres, gestion des administrateurs, durcissement de `/api/db` et des routes IA…
La production a ensuite été redéployée **à la main avec le CLI Vercel**, sans que personne ne voie la perte.
Ces commits sont conservés localement dans la branche `recovery/avant-push-force-2026-10-23`.

Trois pratiques en sont la cause ; elles sont désormais **interdites** :

1. **Push forcé** sur `develop` ou `main` (`git push --force`, `git reset --hard` puis push).
2. **Déploiement en production avec le CLI** (`vercel --prod`) : il envoie les fichiers du disque, y compris les modifications non commitées et les fichiers `.env*`.
3. **Travail resté en local** : branches jamais poussées, `git stash` oubliés, autres worktrees.

## Les branches et leurs environnements

| Branche | Rôle | Déploiement | Base Neon | URL |
|---|---|---|---|---|
| `develop` | Branche de travail unique | Automatique à chaque push (Preview) | `vercel-dev` (`ep-crimson-shape`) | https://dev.optiwifi.site |
| `main` | Production | Automatique à la fusion d'une PR | `production` (`ep-flat-term`) | https://www.optiwifi.site |

On travaille **directement sur `develop`** (pas de branche par fonctionnalité). `main` ne reçoit **que** des PR `develop → main`.

## 1. Avant de commencer

```bash
git status                       # rien de non commité qui traîne
git stash list                   # doit être vide (sinon : commiter ou jeter en connaissance de cause)
git switch develop
git pull --ff-only origin develop
```

- `--ff-only` échoue si l'historique a divergé : **s'arrêter et demander**, ne jamais forcer.
- `.env.local` doit pointer sur la base dev (`ep-crimson-shape`).

## 2. Développer

```bash
npm run dev
npx tsc --noEmit
npx eslint <fichiers modifiés>
npm run build                     # obligatoire avant tout push : c'est ce que Vercel exécute
```

- `npm run dev` n'exécute pas exactement la même chose que Vercel : **toujours valider avec `npm run build`**.
- Les tests qui créent des données se font **uniquement sur la base dev**, et les données de test sont supprimées à la fin.
- **Aucune donnée de test en production.**

## 3. Commiter et pousser sur `develop`

```bash
git add <fichiers>                # jamais « git add . » à l'aveugle
git diff --cached                 # relire : pas de secret, pas de .env, pas de fichier inattendu
git commit -m "type(zone): description"
git push origin develop           # jamais --force
```

- Pousser **au moins une fois par jour** : un travail non poussé n'existe pas pour l'équipe.
- Après le push, vérifier que **le build Vercel est « Ready »** et que `dev.optiwifi.site` pointe sur le nouveau commit :
  ```bash
  vercel ls                       # dernier déploiement Preview de develop : ● Ready
  ```
  Si le build est en **Error** : corriger et repousser immédiatement (le site garde l'ancienne version tant que le build échoue).
- Tester sur https://dev.optiwifi.site (connexion super admin et connexion client).

## 4. Mettre en production (`develop → main`)

**Prérequis :** tout est validé sur `dev.optiwifi.site` et le propriétaire du projet donne son accord explicite.

1. **Sauvegarder la production** (lecture seule, fichier hors Git dans `scripts/backups/`).
   > `npm run backup` est **obsolète** (il utilise encore l'API Supabase) : utiliser une sauvegarde Neon directe
   > (`SELECT *` de toutes les tables dans une transaction en lecture seule) en attendant qu'il soit réécrit.
2. **Migrations de base** : si la PR contient des fichiers dans `supabase/migrations/` :
   - les tester d'abord sur la base dev ;
   - les écrire **idempotentes** (`IF NOT EXISTS`, `CREATE OR REPLACE`…) et les exécuter dans **une seule transaction** ;
   - les exécuter sur la production **avant** la fusion, avec accord explicite, puis vérifier le résultat.
3. **Ouvrir la PR** :
   ```bash
   gh pr create --base main --head develop --title "Mise en production : …"
   ```
   La description liste les changements, les migrations et les vérifications faites.
4. **Fusionner la PR sur GitHub** (bouton *Merge pull request*, pas de *squash* ni de *rebase*) : Vercel déploie la production automatiquement.
5. **Resynchroniser `develop`** avec la fusion :
   ```bash
   git switch develop
   git pull --ff-only origin develop
   git merge --ff-only origin/main  # sinon : git merge origin/main (commit de fusion), jamais de reset
   git push origin develop
   ```
6. **Vérifier la production** :
   - `vercel ls --prod` (ou le dashboard) : déploiement de `main` **Ready** ;
   - `https://www.optiwifi.site/api/cron/health-check` ;
   - connexion super admin → `/platform/dashboard` ; connexion client → `/dashboard`, avec uniquement ses propres données ;
   - navigation privée ou `Cmd+Shift+R` pour éviter l'ancienne version en cache du navigateur.

## 5. En cas de problème en production : revenir en arrière sans rien perdre

| Besoin | Méthode | Interdit |
|---|---|---|
| Revenir tout de suite à la version précédente | Vercel → *Deployments* → déploiement précédent → **Instant Rollback** (aucun changement Git) | `git push --force` |
| Annuler un commit dans le code | `git revert <sha>` sur `develop`, puis PR `develop → main` | `git reset --hard` + push |
| Retrouver un commit « perdu » | `git reflog`, puis `git branch recovery/<nom> <sha>` | — |

## 6. Interdictions

- ❌ `git push --force` / `--force-with-lease` sur `develop` ou `main`.
- ❌ `git reset --hard` sur une branche déjà poussée.
- ❌ `vercel --prod` (déploiement de production depuis le disque).
- ❌ Commit ou push direct sur `main`.
- ❌ Fichiers `.env*`, sauvegardes, cookies ou secrets dans Git ou dans un déploiement.
- ❌ Données de test, scripts de seed ou opérations destructives sur la base de production.
- ❌ Branches ou stashes laissés en local plus d'une journée.

## 7. Savoir si une modification est en production

```bash
git fetch origin
git branch -r --contains <sha>       # doit lister origin/main
vercel ls --prod                     # le commit du dernier déploiement de production
```

## 8. Protections à activer sur GitHub (à faire par le propriétaire du dépôt)

*Settings → Branches → Add branch protection rule* pour `main` **et** `develop` :

- **Block force pushes** (empêche une nouvelle perte d'historique) ;
- **Restrict deletions** ;
- pour `main` : **Require a pull request before merging** et **Require status checks to pass** (check « Vercel »).
