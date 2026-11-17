# OptiSpace v1.22.0 — Statistiques du tableau de bord en courbes et barres

**Date :** 17 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.21.0 (17/11/2026)
**PR de mise en production :** #95

Aucune migration, aucune variable d'environnement.

---

## ✨ Nouveautés — Tableau de bord super admin > Statistiques

### Cartes du design system
- **Chiffre clé** en tête de chaque carte, avec son **évolution** par rapport à la période précédente (pastille verte en hausse, rouge en baisse, « Stable »).
- **Bascule Graphique / Chiffres** à deux icônes (ToggleButtonGroup HeroUI).
- **Légende en pastilles** avec la couleur et le total de chaque série.
- **Vue chiffres** dans un tableau HeroUI, avec ligne de total.
- **Pied de carte** : pic de la période, ou revenu mensuel récurrent pour la répartition.
- **État vide** explicite (« Aucun encaissement sur 30 jours ») au lieu d'axes vides ; blocs de chargement animés.
- **Répartition des abonnements** en jauges Meter, avec pastille « Essai ».

### Courbes et barres
- **Inscriptions et revenus** : courbes cumulées douces (trait 2 px, dégradé léger). Au survol : point, repère en pointillés et infobulle avec la valeur du jour et le cumul. Revenus en vert.
- **Abonnements** : barres empilées épaisses, **par semaine** sur 30 jours (par jour sur 7 jours), rail gris clair, sommet arrondi, 2 px entre les types.
- Grille en pointillés légers ; palette validée pour le daltonisme, en clair et en sombre, inchangée.

---

## ✅ Vérifications
- Rendu vérifié en clair et en sombre sur un aperçu local avec des données fictives (non commité) : courbes, barres, infobulle, bascule vers le tableau, état vide.
- Validé par le propriétaire sur dev.optiwifi.site.
- `tsc` 0 erreur, lint sans erreur ; builds Vercel réussis.
- **Production** : déploiement prêt ; tableau de bord et API protégés sans session.
