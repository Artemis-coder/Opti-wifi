# OptiSpace v1.4.0 — Paiement Wave, factures, statistiques, support et fiabilité du bot

**Date :** 29 octobre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.3.0 (25/10/2026)
**PR de mise en production :** #27, #28, #29, #30

Cette version outille la vie commerciale de la plateforme maintenant que les premiers clients arrivent :
- le client **se réabonne et paie par Wave** depuis son espace, puis envoie son justificatif sur WhatsApp ;
- chaque licence payante validée produit une **facture** que le client retrouve et télécharge ;
- le back-office dispose de **vraies statistiques** (revenus, abonnements, inscriptions) et de KPI sur les factures et les transactions ;
- le client peut **contacter le support** par ticket, avec un fil de discussion ;
- les **rappels d'expiration** passent à J-10, J-5 et J-2 ;
- le **bot Telegram** est fiabilisé : plus de scan de fichiers au build, webhook fermé sans secret, diagnostic sans exposer de clé.

---

## ✨ Nouveautés

### Paiement des licences (Wave)
- **Back-office → Paiements → Moyens de paiement** : opérateur, **QR code de paiement d'OptiWifi**, logo et couleur de l'opérateur, numéro de paiement, titulaire, **lien WhatsApp** pour le justificatif, instructions ; afficher / masquer, ordre, aperçu de ce que voit le client.
- **Réabonnement côté client** : « Me réabonner » → le forfait (prix, durée, contenu) → « Me réabonner » → affiche **« Payez avec Wave »** reprenant le modèle de l'affiche Wave (logo, QR code dans un cadre blanc, « Scanner le QR code pour payer »).
  - Étape 1 : scanner le QR code ou **copier le numéro**.
  - Étape 2 : **« Envoyer sur WhatsApp »** ouvre la conversation avec un message prérempli (forfait, montant).
  - Étape 3 : référence de transaction facultative, puis **« J'ai payé »** : la demande arrive au super admin avec « Payé par Wave · réf. … ».
- Même parcours depuis l'écran « Abonnement expiré ». Sur ordinateur : affiche à gauche, étapes à droite.

### Factures de licence
- Émises **automatiquement à l'activation d'une licence payante** (back-office ou bot) : paiement « réussi » + facture « payée », numérotée `OPT-2026-00001`.
- Forfait, prix, période, moyen et référence de paiement, client facturé **figés à l'émission**. Une seule facture par licence ; pas de facture pour l'essai.
- **Client** (Abonnement) : « Paiements et factures » (historique, total payé) et page facture avec **« Télécharger en PDF »** (impression A4 de la seule facture). Notification avec lien direct.
- **Back-office** : la liste des factures ouvre la facture.

### Statistiques et KPI du back-office
- **Tableau de bord** : inscriptions, licences vendues (+ essais), revenus, **revenu mensuel récurrent** ; évolution des inscriptions, des abonnements par type (nouvelles, renouvellements, changements de forfait, essais), des revenus ; **répartition des licences en cours** par forfait. Comparaison avec la période précédente, tranches adaptées (jour, semaine, mois), tableau des chiffres sous chaque graphique, palette lisible par les daltoniens.
- Les revenus sont calculés à partir des licences vendues (prix du forfait × durée) : l'ancien graphique restait à 0.
- **Factures** : montant encaissé, mois en cours, renouvellements, facture moyenne, clients facturés.
- **Transactions** : total encaissé, mois en cours, montant moyen, à vérifier, **répartition par moyen de paiement**.

### Support
- **Client** : menu « Support » (administrateur et collecteur), ouverture d'un ticket (sujet, catégorie, message), fil de discussion avec le support.
- **Back-office** : compteurs par statut, liste avec le client, **ouverture d'un ticket pour un client**, réponse, statut et priorité.
- Notifications : nouveau ticket et réponse client → super admin (+ Telegram) ; réponse, ticket résolu ou fermé → client.

### Licences
- **Rappels d'expiration à J-10, J-5 et J-2** (cloche + push), une fois par palier ; « Dernier rappel » à J-2. Auparavant : un seul rappel à 7 jours.

### Interface
- **Bouton « Ajouter » unique** du design system (`AddButton`) à la place de 18 boutons aux libellés disparates ; `Button` reçoit une icône standard.
- **Notifications en panneau du bas sur mobile**, comme les filtres, avec des cartes lisibles.
- **Journal d'audit** : détail d'une action dans un panneau (avant → après en clair, libellés français, lien vers le client), filtre par catégorie.
- **Forfaits** triés par prix : Découverte → Standard → Décideur (Pro).
- **Bot Telegram** : Paramètres → **« Santé du bot Telegram »** (voir Sécurité).

---

## 🔒 Sécurité
- **Support** : `/api/platform/support` ne vérifiait que la connexion — **un client pouvait lister les tickets de tous les clients**. Réservé au super admin ; tickets clients limités à l'organisation (404 sinon).
- **Webhook Telegram fermé par défaut** : sans secret ou sans jeton (cas des previews), tout appel est refusé. Avant, l'URL restait ouverte et permettait de faire travailler le bot et de consommer les crédits d'IA.
- **Diagnostic du bot sans exposer de clé** : le serveur teste lui-même ses clés (Telegram, Claude avec détection du crédit épuisé, Groq, OpenRouter, Together, Vercel) et ne renvoie que des statuts. « Réenregistrer le webhook » (production uniquement) transmet le secret directement du serveur à Telegram.
- **Scan de secrets du bot supprimé** : il lisait les fichiers du serveur et renvoyait au chat et aux fournisseurs d'IA les 50 premiers caractères des secrets trouvés. Remplacé par un contrôle de configuration (variables présentes, aucune `NEXT_PUBLIC_*` au nom de secret, secrets ≥ 32 caractères).
- **Factures** visibles uniquement par l'administrateur du client facturé et le super admin.
- **Moyens de paiement** : liens WhatsApp limités aux domaines WhatsApp ; images PNG / JPEG / WebP uniquement (pas de SVG).
- `/support` réservé aux utilisateurs connectés ; `payment_methods`, `invoices`, `payments`, `support_messages` hors `/api/db`, RLS activée.

---

## 🐛 Corrections
- **Build** : 4 avertissements « Dynamic filesystem access » à chaque déploiement — la fonction du webhook Telegram embarquait tout le projet (**1789 → 187 fichiers**).
- **En-tête** : icône de connexion fixe qui se superposait aux boutons (cloche, avatar, déconnexion) sur toutes les pages.
- **Journal d'audit** : 22 actions sur 40 invisibles (auteur supprimé) ; détail affiché en bas du tableau en JSON brut ; « d&apos; » affiché tel quel ; date de fin du filtre qui excluait la journée.
- **Support** : création de ticket par le super admin impossible (`created_by` référençait `profiles`).
- Boutons sans effet : « Nouveau client » (retiré), « Télécharger » des factures ; colonne « Échéance » toujours vide.

---

## 🗄️ Base de données

Migrations idempotentes, **déjà exécutées en développement et en production** (après sauvegarde et vérification en lecture seule) :

| Fichier | Effet |
|---|---|
| `supabase/migrations/20261028_payment_methods.sql` | Table `payment_methods` ; `license_requests.payment_method_id`, `payment_reference` |
| `supabase/migrations/20261029_license_invoices.sql` | Colonnes de facture, numérotation, une facture par licence |
| `supabase/migrations/20261029_support_tickets.sql` | Ticket rattaché au client, numéro `SUP-00001`, catégorie, priorité, table `support_messages`, auteur → `users` |

Toutes reprises dans `supabase/neon_schema.sql`.

---

## ⚙️ Configuration
- Aucune nouvelle variable d'environnement.
- **À faire après la mise en production** : Back-office → Paiements → Moyens de paiement → ajouter **Wave** (QR code, numéro, lien WhatsApp, logo). Tant qu'aucun moyen n'est configuré, le client voit « paiement en ligne pas encore disponible ».

---

## ⚠️ Points connus
- Les licences activées avant cette version n'ont pas de facture (pas de génération rétroactive : certaines ont pu être offertes).
- Le revenu calculé utilise le prix **actuel** des forfaits (l'historique des prix n'est pas conservé).
- Clés du bot à vérifier avec **Paramètres → Santé du bot Telegram** en production (crédit Anthropic, `TOGETHER_API_KEY`, `VERCEL_TOKEN` signalés invalides en v1.3.0).
- Référence git orpheline `agents` (sous-module sans `.gitmodules`) : avertissement non bloquant au clonage.
- Le fichier `.env.local` contient le jeton du bot de production : préférer un bot de test pour le développement.

---

## ✅ Vérifications de cette version
- `tsc` 0 erreur, `npm run build` sans avertissement, lint sans erreur sur les fichiers modifiés.
- Tests de bout en bout sur dev.optiwifi.site : réabonnement Wave et justificatif, approbation → facture (montant, moyen, référence, pas de doublon), accès aux factures et aux tickets (client, super admin, autre client), parcours support complet, rappels J-10 / J-5 / J-2 simulés puis restaurés, statistiques cohérentes avec la base, journal d'audit complet.
- Affichage vérifié sur mobile (375 px) et ordinateur.
- Sauvegardes de la production avant chaque migration (`scripts/backups/`, non versionné).
