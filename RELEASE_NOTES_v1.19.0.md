# OptiSpace v1.19.0 — Bot Telegram : menu Paiement en ligne

**Date :** 15 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.18.1 (15/11/2026)
**PR de mise en production :** #91

Aucune migration, aucune variable d'environnement.

---

## 💬 Bot Telegram
- **« 💳 Paiement en ligne »** : troisième univers de l'accueil du bot (avec « 🤖 IA — Claude Code » et
  « 📊 Business OptiSpace »), aussi accessible par la commande `/paiement`.
- **Statut** : mode proposé aux clients, connexion SasPay testée en direct (réel / test), dernier webhook reçu,
  paiements en ligne des 24 dernières heures, alerte si un paiement reçu n'a pas activé de licence.
- **Bascule en un bouton** : « ⏸️ Basculer en paiement manuel » / « ▶️ Activer le paiement en ligne »
  (même réglage que le back-office, journalisé), et « 🔄 Actualiser ».
- Réponses directes, sans passer par l'IA.

## 🗄️ Base de données
Aucune migration.

---

## ✅ Vérifications de cette version
- `tsc`, `eslint` et `npm run build` sans erreur.
- Test local (base dev, envois Telegram interceptés) : statut, bascule vers le manuel puis retour au paiement en
  ligne, mode de départ rétabli.
- **Production** : déploiement `fa05cf7` prêt, site qui répond, webhook du bot protégé (403 sans secret).
