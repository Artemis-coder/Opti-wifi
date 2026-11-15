# OptiSpace v1.18.1 — Téléchargement des factures en PDF

**Date :** 15 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.18.0 (15/11/2026)
**PR de mise en production :** #90

Version corrective : aucune migration, aucune variable d'environnement.

---

## 🧾 Factures et rapports
- **« Télécharger en PDF »** (facture) et **« Exporter en PDF »** (rapport d'activité) fonctionnent de nouveau
  dans l'espace client : la protection anti-copie affichait « Contenu confidentiel » à la place du document.
- L'impression est autorisée **pour ce seul document**, puis la protection est rétablie aussitôt.
- La protection reste entière ailleurs : Ctrl/Cmd+P bloqué, captures d'écran masquées, copie interdite.

## 🗄️ Base de données
Aucune migration.

---

## ✅ Vérifications de cette version
- `tsc`, `eslint` et `npm run build` sans erreur.
- Navigateur (client de démo, facture OPT-2026-00007) : pendant l'impression, masque levé et facture présente,
  fichier proposé « Facture OPT-2026-00007 » ; après, protection rétablie ; Ctrl/Cmd+P toujours bloqué.
- **Production** : déploiement `a4fab4e` prêt, site qui répond, nouvelle règle d'impression présente dans la feuille de style.
