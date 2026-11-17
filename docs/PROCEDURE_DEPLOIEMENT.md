# Procédure de déploiement — OptiWifi / OptiSpace

> À suivre pour **chaque** modification, par un humain comme par un agent IA.
> Elle complète [`DEVELOPMENT_WORKFLOW.md`](./DEVELOPMENT_WORKFLOW.md) et [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md).

## Pourquoi cette procédure

Le **23/10/2026 à 15:12 UTC**, `develop` puis `main` ont été réinitialisés par **push forcé** (`0c85278 → 7225f8b`) pour revenir à l'état du 22/10.
Environ **30 commits** (39 fichiers, ~3 300 lignes) ont disparu des deux branches : montant net après commission, horodatage exact,
quotas, suppression d'utilisateur, page Paramètres, gestion des administrateurs, durcissement de `/api/db` et des routes IA…
La production a ensuite été redéployée **à la main avec le CLI Vercel**, sans que personne ne voie la perte.
Ces commits sont conservés localement (Mac du propriétaire, pas sur GitHub) dans l'étiquette `archive/recovery/avant-push-force-2026-10-23`.
Pour la ressortir en branche : `git switch -c recovery/avant-push-force-2026-10-23 archive/recovery/avant-push-force-2026-10-23`.

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

1. **Sauvegarder la production (double sauvegarde)** — obligatoire à **chaque** mise en production, même sans migration :
   ```bash
   npm run backup:prod
   ```
   La commande fait deux sauvegardes indépendantes :

   | | Où | Contenu | Durée de vie | Sert à |
   |---|---|---|---|---|
   | **1. Fichier JSON** | Mac, `scripts/backups/` (exclu de Git) | Toutes les tables du schéma `public`, lues en lecture seule | Jusqu'à suppression manuelle | Copie hors de Neon : relire ou réinsérer des lignes précises |
   | **2. Branche Neon** `backup-prod-AAAAMMJJ-HHMM` | Projet Neon `opti-wifi-db`, enfant de `production` | Copie instantanée complète (schéma + données), sans calcul | Supprimée par Neon après **30 jours** | Restauration complète en quelques secondes |

   - Le fichier JSON refuse toute autre base que la production (`ep-flat-term`). L'adresse de la base est lue depuis Vercel
     dans un dossier temporaire, jamais affichée ni écrite dans le projet.
   - Il compare avec la sauvegarde précédente : en cas de **« ATTENTION, lignes en moins »**, s'arrêter et comprendre avant de publier.
   - La branche Neon est créée **sans calcul** (aucun coût de calcul) et **sans secret** dans la sortie ; la commande vérifie qu'elle existe.
   - Prérequis : CLI Vercel et `neonctl` connectés au compte du projet.
   - Si c'est un agent IA qui la lance, il lui faut l'**autorisation explicite** du propriétaire pour lire la base de production.
   - `npm run backup` (ancien script Supabase) est **obsolète** : ne plus l'utiliser.
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
5. **Resynchroniser `develop`** avec la fusion (après **chaque** PR fusionnée dans `main`, PR de documentation comprise) :
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
7. **Créer la release GitHub** (obligatoire après **chaque** mise en production validée) : elle fige l'état de la production avant de continuer.
   - Version : `vX.Y.Z` (Y = nouveautés, Z = corrections seules), à la suite de `gh release list`.
   - Notes dans `RELEASE_NOTES_vX.Y.Z.md` (même format que les précédentes : changements, base de données, variables, points connus, vérifications) et lien « Version actuelle » du `README.md` mis à jour, commités sur `develop`.
   ```bash
   gh release create vX.Y.Z --target "$(git rev-parse origin/main)" \
     --title "vX.Y.Z — …" --notes-file RELEASE_NOTES_vX.Y.Z.md --latest
   ```
   Plusieurs PR fusionnées le même jour peuvent être regroupées dans une seule release, créée sur le dernier commit de `main`.

## 5. En cas de problème en production : revenir en arrière sans rien perdre

| Besoin | Méthode | Interdit |
|---|---|---|
| Revenir tout de suite à la version précédente | Vercel → *Deployments* → déploiement précédent → **Instant Rollback** (aucun changement Git) | `git push --force` |
| Annuler un commit dans le code | `git revert <sha>` sur `develop`, puis PR `develop → main` | `git reset --hard` + push |
| Données de production abîmées (base) | Console Neon → projet `opti-wifi-db` → branche `production` → **Restore** depuis la dernière branche `backup-prod-…` (ou `neonctl branches restore production backup-prod-… --preserve-under-name production-avant-restauration`), **avec accord explicite** et après une sauvegarde de l'état actuel | Restaurer sans garder l'état actuel |
| Récupérer quelques lignes seulement | Lire le fichier JSON de `scripts/backups/` (ou la branche `backup-prod-…`) et réinsérer les lignes concernées par une requête paramétrée | Écraser toute la base pour quelques lignes |
| Retrouver un commit « perdu » | `git reflog`, puis `git branch recovery/<nom> <sha>` | — |
| Ranger une vieille branche non fusionnée | `git tag archive/<nom> <branche>`, vérifier l'étiquette, puis `git branch -D <branche>` | Suppression sans archive |

## 6. Interdictions

- ❌ `git push --force` / `--force-with-lease` sur `develop` ou `main`.
- ❌ `git reset --hard` sur une branche déjà poussée.
- ❌ Supprimer une branche dont la PR n'est pas **MERGED** sur GitHub (`gh pr view <n> --json state`).
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
