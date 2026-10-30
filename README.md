<p align="center">
  <img src="public/logo.jpg" alt="OptiSpace" width="80" height="80" style="border-radius: 16px;" />
</p>

<h1 align="center">OptiSpace — Site vitrine</h1>

<p align="center">
  <strong>Landing page de conversion d'OptiSpace, le logiciel de gestion des tickets et encaissements Wi-Fi.</strong>
</p>

<p align="center">
  <a href="https://space.optiwifi.site">🌐 space.optiwifi.site</a> •
  <a href="#démarrage-rapide">🚀 Démarrage</a> •
  <a href="#gérer-le-contenu">✏️ Contenu</a> •
  <a href="#structure-du-projet">🏗️ Structure</a> •
  <a href="#déploiement">☁️ Déploiement</a> •
  <a href="#mettre-à-jour-les-captures">📸 Captures</a>
</p>

---

## Sommaire

1. [Vue d'ensemble](#vue-densemble)
2. [Démarrage rapide](#démarrage-rapide)
3. [Stack technique](#stack-technique)
4. [Parcours de la page](#parcours-de-la-page)
5. [Gérer le contenu](#gérer-le-contenu)
6. [Structure du projet](#structure-du-projet)
7. [Design system et animations](#design-system-et-animations)
8. [Variables d'environnement](#variables-denvironnement)
9. [Mettre à jour les captures](#mettre-à-jour-les-captures)
10. [Déploiement](#déploiement)
11. [Workflow Git](#workflow-git)
12. [Dépannage](#dépannage)
13. [Licence](#licence)

---

## Vue d'ensemble

Le site vitrine est une **application Next.js autonome**, séparée de l'outil :

| | Site vitrine | Outil OptiSpace |
|---|---|---|
| **Branche Git** | `landing` (ne contient que le site) | `develop` → `main` |
| **Projet Vercel** | `optispace-landing` | `opti-wifi` |
| **Adresse** | https://space.optiwifi.site | https://www.optiwifi.site |
| **Mise en ligne** | chaque push sur `landing` | merge validé dans `main` |
| **Base de données** | aucune (lit l'API de l'outil) | Neon |

Le site ne stocke rien lui-même : ses textes, liens et sections sont gérés dans le
back-office de l'outil (**Site vitrine**) et lus via une API publique en lecture seule.

---

## Démarrage rapide

```bash
npm install
npm run dev        # http://localhost:3001
```

Pour voir le contenu géré dans le back-office, l'outil doit tourner sur `http://localhost:3000`
(ou bien pointer `SITE_CONTENT_API_URL` vers un outil en ligne, voir [Variables](#variables-denvironnement)).
Sans outil joignable, le site affiche son **contenu de secours** : il ne tombe jamais.

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement sur le port 3001 |
| `npm run build` | Build de production |
| `npm run start` | Sert le build de production sur le port 3001 |
| `npm run lint` | ESLint |
| `npm run capture` | Refait les captures de l'outil (voir [Captures](#mettre-à-jour-les-captures)) |
| `npx tsc --noEmit` | Vérification TypeScript |

---

## Stack technique

| Catégorie | Technologies |
|---|---|
| **Framework** | Next.js 16 (App Router, ISR 60 s), React 19, TypeScript 5 |
| **Style** | Tailwind CSS 4, design system de l'outil (vert Material 3) |
| **Animations** | Motion (`motion/react`) |
| **Icônes** | Lucide React |
| **Polices** | Geist / Geist Mono (`next/font`) |
| **Mesure d'audience** | Vercel Web Analytics (`@vercel/analytics`) |
| **Hébergement** | Vercel, projet `optispace-landing` |

---

## Parcours de la page

La page suit un parcours de conversion **Problème → Agitation → Solution** pensé pour le gérant
de zone Wi-Fi. Chaque section (sauf l'accroche) peut être masquée depuis le back-office.

| # | Section | Composant | Ancre | Rôle |
|---|---|---|---|---|
| 1 | Accroche | `Hero` + `DashboardMock` | `#top` | Promesse, appel à l'action, tableau de bord animé |
| 2 | « Ça vous parle ? » | `Pains` | `#probleme` | 4 douleurs à la première personne |
| 3 | Calculateur de fuites | `Calculator` | `#calculateur` | Le visiteur chiffre ce qu'il perd |
| 4 | Comment ça marche | `HowItWorks` | `#fonctionnement` | Allouer → Vendre → Encaisser → Savoir |
| 5 | L'outil | `Showcase` | `#fonctionnalites` | Vrais écrans, défilement guidé |
| 6 | Sur le terrain | `Field` | — | Mobile, hors-ligne, rôles, notifications |
| 7 | Pour qui | `Audience` | — | 3 profils et comparatif Avant / Avec |
| 8 | Tarifs | `Pricing` | `#tarifs` | Forfaits de l'outil + inclus |
| 9 | FAQ | `Faq` | `#faq` | Objections fréquentes |
| 10 | Appel final | `FinalCta` | — | Dernier appel + défilé de mots-clés |

Les boutons qui mènent à l'outil (« Se connecter », « Essai gratuit », choix d'un forfait…)
**s'ouvrent dans un nouvel onglet**.

---

## Gérer le contenu

### Depuis le back-office (recommandé)

Back-office super admin de l'outil → **Autres → Site vitrine** (`/platform/site`).
Les modifications apparaissent sur le site en **moins d'une minute**.

| Rubrique | Ce qui se règle |
|---|---|
| **Liens** | Destination de « Essai gratuit » et « Se connecter », lien WhatsApp facultatif |
| **Accroche** | Bandeau, titre (2 lignes), sous-titre, boutons, 3 arguments |
| **Sections** | Afficher / masquer chaque section |
| **Tarifs** | Titre, sous-titre, forfait « Recommandé », forfaits affichés |
| **FAQ** | Ajouter, modifier, supprimer, réordonner les questions |
| **Appel final** | Titre, texte, bouton, mention |
| **Google** | Titre et description (résultats Google, partages WhatsApp) |

Les **prix et limites des forfaits** viennent directement de *Licences → Forfaits* :
une seule saisie pour l'outil et le site.

### Comment ça marche

```
Back-office (/platform/site) ──PUT──▶ table site_content (Neon)
                                              │
Site vitrine ◀── GET /api/public/site-content ┘   (+ forfaits actifs)
   (page régénérée toutes les 60 s, contenu de secours si l'API ne répond pas)
```

- Côté outil : `src/lib/site-content-schema.ts` (schéma, valeurs par défaut, validation),
  `src/app/api/platform/site-content` (back-office), `src/app/api/public/site-content` (lecture publique).
- Côté site : `src/lib/content.ts` (lecture de l'API, contenu de secours, mise en forme des forfaits)
  et `src/components/SiteProvider.tsx` (met le contenu à disposition de toutes les sections).

### Ce qui reste dans le code

Les textes des sections « Ça vous parle ? », « Comment ça marche », « L'outil », « Sur le terrain »
et « Pour qui » sont écrits dans leurs composants. Si l'API change de forme, garder
`DEFAULT_CONTENT` de `src/lib/content.ts` aligné sur `SITE_DEFAULTS` de l'outil.

---

## Structure du projet

```
landing/
├── public/
│   ├── logo.jpg                  Logo OptiSpace
│   └── screens/                  Captures réelles de l'outil (npm run capture)
│       ├── dashboard.png         Tableau de bord (desktop)
│       ├── collection-new.png    Assistant d'encaissement
│       ├── allocations.png       Allocations de tickets
│       ├── reports.png           Rapports & exports
│       ├── m-dashboard.png       Tableau de bord (téléphone)
│       └── m-collection-new.png  Assistant d'encaissement (téléphone)
├── scripts/
│   └── capture-screens.mjs       Refait les captures depuis l'outil local
├── src/
│   ├── app/
│   │   ├── layout.tsx            Polices, métadonnées de base, Vercel Analytics
│   │   ├── page.tsx              Assemble les sections, lit le contenu, titre Google
│   │   └── globals.css           Tailwind, surfaces, utilitaires (grille, dégradés)
│   ├── components/
│   │   ├── motion.tsx            Briques d'animation (Reveal, Item, CountUp…)
│   │   ├── SiteProvider.tsx      Contexte du contenu géré
│   │   ├── Nav.tsx               Barre de navigation
│   │   ├── Hero.tsx              Accroche
│   │   ├── DashboardMock.tsx     Tableau de bord animé (réplique codée)
│   │   ├── Pains.tsx … Faq.tsx   Une section par fichier (voir Parcours)
│   │   └── Closing.tsx           Appel final et pied de page
│   ├── lib/
│   │   └── content.ts            Lecture de l'API, contenu de secours, forfaits
│   └── styles/
│       └── design-system.css     Copie du design system de l'outil
├── .env.example                  Variables documentées
├── vercel.json                   Framework + règle d'exclusion côté outil
└── LICENSE                       Licence propriétaire
```

---

## Design system et animations

- **Couleurs** : `src/styles/design-system.css` est une **copie** de celui de l'outil
  (`src/styles/design-system.css` sur `develop`). Garder les deux synchronisés.
  Repères : primaire `#3f9e63` (`brand-500`), secondaire `#84c865` (`brand-400`),
  fond sombre `#1b3f2b` / `#0f261a` (`brand-900` / `brand-950`).
- **Animations** (`src/components/motion.tsx`) :
  - une seule courbe d'animation pour toute la page (`EASE_OUT`) ;
  - `Reveal` + `Item` : apparition en cascade au défilement ;
  - `CountUp` / `AnimatedNumber` : chiffres animés (tableau de bord, calculateur, tarifs) ;
  - effets liés au défilement (`useScroll`) : inclinaison du tableau de bord, frise
    « Comment ça marche », téléphones en parallaxe, écran collant de « L'outil ».
- **Accessibilité** : `MotionConfig reducedMotion="user"` coupe les animations si le
  téléphone ou l'ordinateur le demande.

---

## Variables d'environnement

| Variable | Rôle | Valeur par défaut |
|---|---|---|
| `SITE_CONTENT_API_URL` | API du contenu géré (serveur uniquement) | `<NEXT_PUBLIC_APP_URL>/api/public/site-content` |
| `NEXT_PUBLIC_APP_URL` | Adresse de l'outil (base de l'API par défaut) | `https://www.optiwifi.site` |
| `NEXT_PUBLIC_SITE_URL` | Adresse publique du site (images de partage) | `https://space.optiwifi.site` |

En local, `.env.local` (non versionné) contient typiquement :

```bash
SITE_CONTENT_API_URL=http://localhost:3000/api/public/site-content
```

En production (Vercel), `SITE_CONTENT_API_URL` = `https://www.optiwifi.site/api/public/site-content` :
le site lit le contenu géré dans le back-office de **production**.

---

## Mettre à jour les captures

Les écrans de la section « L'outil » et des téléphones sont de **vraies captures** de l'outil,
prises avec le compte client démo de la base **dev**. Après une évolution de l'interface :

1. Lancer l'outil en local sur `http://localhost:3000` (branche `develop`, base Neon dev).
2. Depuis `landing/` :

   ```bash
   npm run capture
   ```

   Le script se connecte avec `DEV_TEST_CLIENT_EMAIL` / `DEV_TEST_CLIENT_PASSWORD`
   (lus dans `../.env.local`, jamais affichés), masque le badge de développement de Next.js
   et remplace les 6 fichiers de `public/screens/` (desktop 1440 × 900 et téléphone 390 × 844, en ×2).
3. Vérifier le rendu (`npm run dev`), puis commiter et pousser sur `landing`.

Le tableau de bord animé de l'accroche (`DashboardMock.tsx`) est une **réplique codée** :
le mettre à jour à la main si le design du tableau de bord de l'outil change.

---

## Déploiement

| Élément | Réglage |
|---|---|
| Projet Vercel | `optispace-landing` |
| Branche de production | `landing` |
| Domaine | `space.optiwifi.site` (DNS chez LWS → Vercel) |
| Ancienne adresse | `optispace-landing.vercel.app` → redirection 308 vers le domaine |
| Autres branches | ignorées (seule `landing` est construite) |
| Mesure d'audience | Vercel → projet `optispace-landing` → onglet **Analytics** |

Le projet Vercel de l'outil ignore la branche `landing` grâce à `vercel.json`
(`ignoreCommand` sur l'adresse exacte `www.optiwifi.site`).

> Pas de `vercel --prod` depuis le disque : la mise en ligne passe **uniquement** par un push
> sur `landing` (voir `docs/PROCEDURE_DEPLOIEMENT.md` de l'outil).

---

## Workflow Git

Toute amélioration du site se fait sur la branche **`landing`**, jamais sur `develop` ni `main`.

```bash
# Dans le dépôt de l'outil, landing/ est un worktree de la branche landing
cd landing
git pull --ff-only origin landing
# … modifications …
npx tsc --noEmit && npm run lint && npm run build
git add -A && git commit -m "feat(landing): …"
git push origin landing          # = mise en ligne sur space.optiwifi.site
```

Première installation du worktree (depuis la racine du dépôt de l'outil) :

```bash
git fetch origin landing
git worktree add landing landing
cd landing && npm install
```

`develop` ignore ce dossier (`/landing/` dans `.gitignore`) ; le `tsconfig.json` et l'ESLint
de l'outil l'excluent aussi.

---

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le site affiche l'ancien contenu | Cache de 60 s | Attendre une minute et recharger |
| Le contenu du back-office n'apparaît pas | API injoignable → contenu de secours | Vérifier `SITE_CONTENT_API_URL` et que `/api/public/site-content` répond 200 |
| Déploiement « Canceled » sur `optispace-landing` | Règle `ignoreCommand` de `vercel.json` | La règle ne doit viser que `www.optiwifi.site` |
| `npm run capture` échoue à la connexion | Outil local arrêté ou identifiants absents | Lancer l'outil sur :3000, vérifier `../.env.local` |
| Badge « N » sur une capture | Badge de développement de Next.js | Relancer `npm run capture` (il le masque) |

---

## Licence

Propriétaire, tous droits réservés : voir [`LICENSE`](LICENSE).
