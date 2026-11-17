# OptiSpace v1.23.0 — Historique des paiements en ligne et page Abonnement réorganisée

**Date :** 17 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.22.0 (17/11/2026)
**PR de mise en production :** #98

Aucune migration, aucune variable d'environnement.

---

## ✨ Nouveautés — Espace client > Abonnement

### Historique des paiements en ligne
- Nouveau bloc **« Historique des paiements »** : tous les paiements en ligne de l'organisation (payé, en attente, échoué, annulé, expiré), réservé à l'administrateur du client.
- Page **« Détail du paiement »** : montant, forfait, durée, moyen de paiement (Mobile Money ou carte), dates, référence de transaction, licence et facture.
- Paiement en attente : bouton **« Revérifier »**, qui interroge SasPay ; la licence s'active si le paiement est confirmé (même circuit que la page de retour, limité à 60 vérifications par minute). Bouton « Reprendre le paiement » si besoin.
- Le bloc « Paiements et factures » devient **« Factures »**.

### Ordre de la page
1. Mon forfait actuel
2. Utilisation de votre forfait
3. Factures
4. Historique des paiements en ligne
5. Tous les forfaits disponibles

Le bouton « Historique des paiements » en haut de page est retiré.

---

## 🔒 Sécurité
- Routes `GET /api/subscription/payments` et `GET /api/subscription/payments/[id]` : session obligatoire (401), administrateur du client uniquement (403), résultats limités à son organisation. Un paiement d'un autre client répond « introuvable » (404), sans révéler son existence.

---

## ✅ Vérifications
- `tsc` 0 erreur, lint sans erreur, scan des secrets ; vérifications Vercel au vert.
- Ordre de la page validé par le propriétaire sur dev.optiwifi.site.
- **Production** : déploiement prêt ; page Abonnement et API des paiements refusées sans session.
- Non vérifié dans cette session : l'historique avec une session client réelle en production.
