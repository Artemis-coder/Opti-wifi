# OptiSpace v1.20.0 — Nouvelle interface avec HeroUI

**Date :** 16 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.19.0 (15/11/2026)
**PR de mise en production :** #92

Aucune migration, aucune variable d'environnement.

---

## 🎨 Design system
- **HeroUI v3** devient le design system par défaut (`@heroui/react`, `@heroui/styles`, Tailwind v4). Guide visuel
  dans `docs/design/HEROUI_DESIGN.md`, skill `heroui-react` versionné pour les prochains écrans.
- **Thème OptiSpace** (`src/styles/heroui-theme.css`) : accent vert, blocs imbriqués en gris 100, mode sombre plus
  lisible (niveaux bien séparés, contour fin des cartes et des KPI).
- **Une seule échelle partout** : arrondis (boutons et champs 12 px, cartes 16 px, pastilles 8 px, badges en pilule)
  et espacements (page 16/24 px, sections 20 px, cartes 16/20 px).
- **Boutons uniformes** : un seul gabarit par taille, rôles HeroUI (principal, contour pour annuler, rouge doux pour
  supprimer), boutons à icône seule, actions pleine largeur dans les cartes et côte à côte sur mobile.

## 🧭 Navigation
- Nouvelle sidebar, en-tête avec menu du compte (paramètres, déconnexion, état de connexion).
- **Menu mobile** : tiroir qui monte du bas avec poignée, ouvert par « Menu » de la barre du bas, identique pour le
  super admin, l'administrateur, le collecteur et le point de vente.
- Badge du forfait lisible dans la sidebar (clair et sombre).

## 🖥️ Écrans
- Toutes les pages du super admin et de l'espace client refaites : KPI en gras, 2 par ligne sur mobile (la dernière
  tuile impaire prend toute la ligne), bandeaux en Alert, quotas en jauges Meter avec contour, interrupteurs Switch.
- Avatars avec initiales (plus de cercle vide), cartes de forfait refaites (« Votre forfait » en badge).
- La facture reste blanche à l'écran même en mode sombre.
- Recherche de l'en-tête admin fonctionnelle (ouvre « Tous les clients » filtré).

## 🛠️ Corrections
- Débordements sur mobile (375 px) : boutons de la fiche client, onglets, filtres.
- Boutons imbriqués dans des liens (HTML invalide) remplacés par des liens stylés en bouton.
- Clé React en double sur la page « État du système ».

## 🗄️ Base de données
Aucune migration. Sauvegarde de la production faite avant la fusion (41 tables, 502 lignes, hors Git).

---

## ✅ Vérifications de cette version
- `tsc` sans erreur ; ESLint sans nouvelle erreur (10 erreurs antérieures connues : Factures, Notifications,
  Paramètres admin, fiche espace, réinitialisation de point de vente).
- Build Vercel Preview réussi ; contrôles sur dev : pages admin et client en 375 px sans débordement, clair et
  sombre, audit des boutons (0 surcharge de taille).
- **Production** : déploiement `7ed77d9` prêt (build 34 s), site et page de connexion qui répondent, feuille de style HeroUI servie, aucune erreur d’exécution sur les 30 premières minutes.

## ⚠️ Points connus
- Vues collecteur et point de vente : mêmes composants, pas encore revues à l'écran.
- La barre de navigation du bas n'est pas un composant HeroUI (conservée pour l'accès rapide au pouce).
