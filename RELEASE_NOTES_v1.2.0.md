# OptiSpace v1.2.0 — Back-office Super Admin, licences et sécurité multi-tenant

**Date :** 25 octobre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.1.3 (24/10/2026)
**PR de mise en production :** #8, #10, #12

Cette version refond l'espace super administrateur autour de la gestion des clients et des licences, **isole strictement les données de chaque client**, restaure les améliorations perdues le 23/10 et corrige plusieurs failles de sécurité.

---

## ✨ Nouveautés

### Back-office Super Admin (`/platform`)
- **Tableau de bord « À traiter »** : inscriptions à valider, demandes de licence en attente, licences qui expirent sous 30 jours, et 6 indicateurs cliquables (clients, espaces actifs / désactivés, licences actives, expirations, clients sans licence).
- **Inscriptions** (`/platform/registrations`) : liste des comptes créés, **validation** ou **refus** (avec motif). Après validation, la fenêtre d'activation de licence s'ouvre directement.
- **Licences** : activation d'un **forfait pour une durée** (1 à 24 mois) depuis la fiche client, les abonnements, les inscriptions ou les demandes. Si une licence court encore, la nouvelle période démarre à sa date de fin.
- **Demandes de licence** (`/platform/license-requests`) : le client demande un renouvellement ou un forfait, le super admin **approuve** (licence activée) ou **refuse** (motif visible par le client).
- **Activation / désactivation d'un espace client** depuis la fiche et la liste des clients.
- **Utilisateurs de la plateforme** : création d'administrateurs ou de collecteurs dans une organisation, changement de rôle, réinitialisation de mot de passe.
- **Paramètres de la plateforme** : l'enregistrement (numéro et email du support, durée d'essai…) fonctionne de nouveau.
- Menu réorganisé : Clients, Licences, Paiements, Autres.

### Espace client
- **Détail d'un encaissement** : commission POS, **montant net restant**, détail des tickets vendus, horodatage exact.
- **Détail d'une allocation** et tableau de bord cliquable.
- **Abonnement** : forfait actuel, jours restants, **utilisation du forfait** (POS, membres, espaces) et **demande de renouvellement** à faire valider (le client ne se prolonge plus lui-même).
- **Paramètres** : informations de l'organisation et rôle de l'utilisateur.
- **Équipe** : suppression d'un membre (désactivation + compte bloqué, historique conservé).
- **Quotas** du forfait appliqués à la création de membres, d'encaissements et d'allocations.

### Connexion
- **Page de connexion unique** (`/login`) : chacun est redirigé vers son espace (super admin → `/platform/dashboard`, client → `/dashboard`). `/platform/login` est supprimée.
- **Mot de passe temporaire à changer** : après une connexion avec un mot de passe généré ou fixé par quelqu'un d'autre (création de compte, réinitialisation, membre ajouté par un administrateur), l'utilisateur doit **choisir son propre mot de passe** sur `/change-password` avant d'accéder à quoi que ce soit.

---

## 🔒 Sécurité

> ⚠️ Plusieurs de ces failles étaient exploitables en production avant cette version.

- **Isolation des données par organisation** : la passerelle `/api/db` acceptait **sans connexion** n'importe quelle requête sur n'importe quelle table (y compris les hash de mots de passe) et un client voyait les données des autres. Désormais : session obligatoire, liste blanche de tables, filtre d'organisation imposé côté serveur, identifiants validés (anti-injection SQL).
- Routes de détail (encaissement, allocation, organisation, utilisateur) : authentification et contrôle d'appartenance.
- `/api/platform/users` : réservé au super admin (un administrateur client pouvait réinitialiser le mot de passe de n'importe quel compte).
- `/api/users/create` : création de compte sans connexion impossible ; réservé à l'administrateur de l'organisation.
- Suppression d'utilisateur : impossible de supprimer un compte d'une autre organisation ou le super admin.
- Création d'encaissements / allocations : POS et type de ticket vérifiés.
- Routes IA et de test protégées, en-têtes HTTP de sécurité (HSTS, X-Frame-Options, Permissions-Policy…), réponses de session sans métadonnées internes.
- Mots de passe retirés des scripts SQL/TS versionnés.
- `.vercelignore` : les fichiers `.env*` ne sont plus envoyés lors d'un déploiement CLI.

---

## 🐛 Corrections
- La liste « Tous les clients » du back-office ne chargeait rien (erreur 500).
- Un compte refusé gardait l'accès à son espace.
- L'écran « Abonnement expiré » renvoyait vers une page bloquée.
- Enregistrement des paramètres de la plateforme (`column "id" does not exist`).
- Allocations créées par l'échange de tickets sans organisation (trigger SQL + rattrapage).
- Modification d'une allocation impossible (colonne `updated_at` manquante).
- Le middleware (devenu `src/proxy.ts`, convention Next.js 16) n'était pas exécuté en local.
- Lien « Voir le client » cassé sur la page Abonnements.

---

## 🗄️ Base de données

Migrations (idempotentes, **déjà exécutées** en développement et en production) :

| Fichier | Effet |
|---|---|
| `supabase/migrations/20261025_license_requests.sql` | Table `license_requests` (une seule demande en attente par organisation) |
| `supabase/migrations/20261025_allocations_organization_id.sql` | Colonne `ticket_allocations.updated_at`, trigger qui renseigne l'organisation, rattrapage |
| `supabase/migrations/20261022_safe_user_deletion.sql` | `profiles.is_active` / `deleted_at`, encaissements conservés à la suppression d'un profil |

---

## 🛠️ Développement et déploiement
- Nouvelle procédure : [`docs/PROCEDURE_DEPLOIEMENT.md`](docs/PROCEDURE_DEPLOIEMENT.md) — travail sur `develop`, Preview automatique sur `dev.optiwifi.site`, mise en production par PR `develop → main` avec sauvegarde, **push forcé et `vercel --prod` interdits**.
- Les Preview Vercel de `develop` sont de nouveau automatiques.
- Restauration de ~30 commits effacés par le push forcé du 23/10 (commits d'origine référencés par `cherry-pick -x`).

---

## ⚠️ Points connus
- Le quota « tickets par mois » ne bloque pas (filtre sur une colonne de jointure non géré par le query builder).
- `npm run backup` utilise encore l'API Supabase : utiliser une sauvegarde Neon directe en attendant sa réécriture.
- Activer *Block force pushes* sur `main` et `develop` (GitHub → Settings → Branches).
