# OptiSpace v1.16.0 — Rapports business automatiques

**Date :** 15 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.15.0 (15/11/2026)
**PR de mise en production :** #86

Le bot Telegram envoie chaque matin l'essentiel de l'activité : ce qui a été encaissé, ce qui attend une action, et les anomalies à vérifier. Le lundi, il ajoute le bilan de la semaine et les clients à risque. Ces rapports sont calculés directement en base, sans IA, et ne consomment pas le quota Claude.

---

## 📊 Rapports automatiques
- **🌅 Rapport du matin** (chaque jour, avant 8 h) :
  - encaissé hier, comparé au même jour la semaine passée ;
  - total du mois et 5 meilleurs clients d'hier ;
  - **à traiter** : demandes de licence, inscriptions à valider, licences qui expirent sous 7 jours ;
  - nouvelles inscriptions.
- **💸 Anomalies d'encaissement** (chaque jour, seulement s'il y en a) :
  - écarts d'hier entre attendu et collecté, au-delà de 5 000 FCFA et de 10 % ;
  - points de vente dont l'encaissement a chuté de plus de moitié sur 7 jours (moyenne des 4 semaines précédentes d'au moins 20 000 FCFA).
- **📉 Clients à risque** (le lundi, seulement s'il y en a) : licence active, mais aucune collecte ni connexion depuis 14 jours, avec le contact à rappeler.
- **📊 Bilan de la semaine** (le lundi) : semaine écoulée comparée à la précédente. Encaissé, commissions, meilleurs clients, inscriptions et licences vendues.

## 💬 Bot Telegram
- Menu **📊 Business OptiSpace** : nouveaux boutons **🌅 Rapport du jour** et **📈 Bilan de la semaine**, pour afficher ces rapports à la demande.

## 🛠️ Technique
- Nouvelle tâche planifiée `/api/cron/business-reports` (tous les jours à 7 h UTC, heure d'Abidjan). Elle est protégée par `CRON_SECRET` et suivie par le bilan de santé (« Rapports business »).

## 🗄️ Base de données
Aucune migration.

---

## ⚠️ Points connus
- Vercel lance la tâche dans l'heure qui suit 7 h : le rapport arrive entre 7 h et 8 h.
- Les seuils des alertes (5 000 FCFA, 10 %, 50 %, 14 jours) sont fixés dans `src/lib/business-reports.ts`. Ils sont à ajuster si les alertes sont trop ou pas assez nombreuses.

---

## ✅ Vérifications de cette version
- `tsc` sans erreur, lint sans nouvelle erreur, build réussi.
- Les quatre rapports ont été générés sur la base dev : chiffres cohérents, moins de 3 s au total. Les dates du bilan hebdomadaire ont été corrigées pour un appel un autre jour que le lundi.
- **Production :** déploiement prêt, site qui répond.
- **Non testé en conditions réelles :** le premier envoi automatique par Vercel, prévu au prochain matin. Les boutons du menu Business permettent de vérifier les rapports dès maintenant.
