# OptiSpace v1.17.0 — Routines d'audit, de revue de sécurité et de diagnostic

**Date :** 15 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.16.0 (15/11/2026)
**PR de mise en production :** #87

L'application peut maintenant recevoir le travail de trois routines Claude Code qui tournent seules dans le cloud : un audit des dépendances, une revue de sécurité du code et un diagnostic technique. Leurs correctifs passent par le même circuit de validation que le menu IA : rien n'est intégré ni mis en production sans votre accord.

---

## 🤖 Routines Claude
- **📦 Audit des dépendances** (le lundi) : recherche des failles connues dans les paquets et propose un correctif sans changement de version majeure.
- **🔍 Revue de sécurité du code** (le vendredi) : relit les modifications de la semaine selon la checklist `docs/CHECK_SECURITE.md`.
- **🔧 Diagnostic technique** (toutes les 6 heures) : lit le bilan de santé de la production. Si tout fonctionne, il ne vous dérange pas. En cas de panne, il trouve la cause, puis propose un correctif ou l'action à faire.

## 💬 Validation depuis Telegram
- **Avec un correctif**, vous recevez une fiche « à valider » : la PR vers `develop` est ouverte, avec les boutons ✅ Intégrer, ✏️ Corriger et ❌ Abandonner. « Corriger » transmet vos remarques à l'agent de développement.
- **Sans correctif**, vous recevez un rapport avec ce qui a été trouvé, la gravité, la solution et ce que vous devez faire. Une même alerte n'est envoyée qu'une fois par 24 heures.

## 🛠️ Technique
- `POST /api/dev/agent-report` : comptes rendus des routines (jeton `DEV_AGENT_TOKEN`, branches `claude/…` uniquement).
- `GET /api/dev/health` : bilan de santé pour le diagnostic. La sécurité en est exclue, l'agent de sécurité s'en charge.

## 🗄️ Base de données
- Nouvelle table `agent_reports`, qui sert d'anti-doublon des rapports. Elle est créée automatiquement au premier rapport et ajoutée à la migration idempotente `supabase/migrations/20261115_dev_requests.sql`. Aucune table existante modifiée.

---

## ⚠️ Points connus
- Les routines consomment le quota de l'abonnement Claude. Le diagnostic s'arrête aussitôt quand tout va bien.
- Elles se créent et se règlent sur claude.ai/code (environnement « OptiSpace dev », sans connecteurs).

---

## ✅ Vérifications de cette version
- `tsc` sans erreur, lint sans erreur, build réussi.
- **En local, sur la base dev :**
  - protections par jeton ;
  - anti-doublon (le titre est comparé sans tenir compte des majuscules) ;
  - branches hors `claude/` refusées ;
  - correctif transformé en demande « à valider » ;
  - données de test supprimées.
- **Production :** déploiement prêt. Le bilan de santé lu par l'API de l'agent est « ok », sans anomalie.
- **Non testé en conditions réelles :** le premier passage de chaque routine et un correctif proposé jusqu'à la PR.
