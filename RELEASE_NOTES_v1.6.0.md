# OptiSpace v1.6.0 — Mode hors ligne, rapports PDF, accès de l'équipe et types de tickets en jours

**Date :** 1er novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.5.0 (31/10/2026)
**PR de mise en production :** #47 à #52

Cette version rend l'outil utilisable **sur le terrain, même sans réseau**, et facilite le travail quotidien du client :
- l'application **reste consultable hors ligne** et **les collectes saisies sans réseau sont envoyées automatiquement** au retour de la connexion ;
- les **rapports** sont refaits, avec un **export PDF** mis en page et des exports compatibles Excel ;
- le client **donne les accès à son équipe** par copie, WhatsApp ou e-mail, et la **réinitialisation du mot de passe est sécurisée** ;
- les **types de tickets se saisissent en jours**, le **forfait s'affiche** à côté d'OptiSpace et l'application prévient quand **le forfait ne permet pas un membre de plus** ;
- côté super admin, les **revenus sont ceux réellement encaissés** et la page **Expirations** est corrigée.

---

## ✨ Nouveautés

### Mode hors ligne
- **Consultation sans réseau** : les données lues en ligne sont gardées sur l'appareil et réaffichées hors ligne. Une pastille indique « **Hors ligne · données du {date}** ».
- **La session reste ouverte** hors ligne.
- **Collectes hors ligne** : une collecte saisie sans réseau est enregistrée sur l'appareil (« enregistrée sur l'appareil, envoyée dès le retour du réseau ») ; la pastille indique « **N à synchroniser** ».
- **Synchronisation automatique** au retour du réseau, dans l'ordre de saisie, sans doublon (identifiant créé sur l'appareil). Bouton « Synchroniser » si besoin.
- Les autres modifications demandent une connexion : « Cette action nécessite une connexion internet ».
- **Service worker** actif pour tous : pages, fichiers et API en lecture servis par le réseau d'abord, la copie si le réseau manque. Les écrans principaux sont préparés en arrière-plan une fois par session.
- Test de connexion par `/api/ping` (connexion instable signalée au-delà de 3 s).

### Rapports & exports
- **Période en un clic** (ce mois-ci par défaut, mois dernier, 7 jours, aujourd'hui, tout, personnalisée) ; filtres point de vente, collecteur et statut.
- **Chiffres clés** : encaissements, chiffre d'affaires, encaissé, écart (alerte en cas de manque), commission, tickets vendus.
- **Quatre rapports en onglets** : encaissements détaillés, par point de vente, par collecteur (part du CA), par type de ticket.
- **Export PDF** : rapport A4 mis en page (logo, organisation, période, chiffres clés, synthèses, détail, pied de page), lignes non coupées entre deux pages.
- **Exports Excel** : accents conservés, séparateur « ; », montants en nombres, nom de fichier avec la période.

### Équipe et accès
- **Création d'un membre** : mot de passe temporaire saisi ou généré, fiche des accès à transmettre (**copier**, **WhatsApp** vers le numéro du membre) et **e-mail** en option ; changement obligatoire à la première connexion.
- **Bouton « Accès »** sur chaque membre : **lien pour choisir son mot de passe** (7 jours, à copier, envoyer sur WhatsApp ou par e-mail) ou **nouveau mot de passe temporaire** (l'ancien est invalidé). Fonctionne aussi sans envoi d'e-mail configuré.
- Statut « Accès pas encore utilisés » ou dernière connexion ; **forfait bien visible** en haut de la page (utilisateurs, collecteurs, places restantes).
- **Limite du forfait** : « Ajouter » ouvre une note d'information quand le forfait est au maximum, avec les forfaits qui le permettent ; même règle pour les collecteurs. Utilisation affichée (ex. 1 / 1 utilisateur · 0 / 0 collecteur).
- **E-mails** à la mise en page commune : invitation, réinitialisation, confirmation « mot de passe modifié ».

### Espace client
- **Badge du forfait** à côté d'OptiSpace : ESSAI, DÉCO, STANDARD ou PRO, selon le forfait réel de l'organisation.
- **Types de tickets en jours** : saisie en jours par défaut (Jours / Heures), affichage « 1 jour », « 30 jours » ; les pass de 2 h, 6 h ou 12 h restent en heures. Les types existants s'affichent directement en jours.
- **Actions bien visibles** sur les types de tickets et les points de vente : boutons « Modifier » et « Désactiver » / « Activer » (auparavant visibles seulement au survol, donc invisibles sur téléphone), réservés à l'administrateur.

### Back-office
- **Revenus encaissés** : le tableau de bord additionne les **factures payées**, à la date du paiement et aux prix de l'époque. Le revenu mensuel récurrent reste calculé sur les licences en cours.
- **Top pays** : les cartes occupent toute la ligne quand il y a moins de 3 pays.

---

## 🔒 Sécurité
- **Lien « mot de passe oublié »** : il contenait un vrai jeton de session (24 h, réutilisable) et `/api/auth/set-password` acceptait n'importe quel jeton de session. Jetons dédiés désormais : clé distincte des sessions, 1 h (réinitialisation) ou 7 jours (invitation), **usage unique**.
- Liens construits uniquement sur un domaine de l'application (pas d'empoisonnement de l'en-tête Host).
- Même règle de mot de passe partout (8 caractères, majuscule, minuscule, chiffre, caractère spécial).
- **Hors ligne sur un appareil partagé** : données, session et pages gardées sont **effacées à la connexion et à la déconnexion** ; l'authentification n'est jamais gardée.

---

## 🐛 Corrections
- **Page Expirations** : nom du client et forfait affichés (tirets auparavant), seulement les licences qui se terminent dans les 30 jours, bouton « Prolonger ».
- **Rapports** : les collectes annulées apparaissaient comme « Brouillon » et étaient comptées.
- **Forfaits** : une limite de 0 collecteur était affichée comme illimitée (client) ou masquée (back-office).

---

## 🗄️ Base de données
Aucune migration dans cette version. La durée des tickets reste enregistrée en heures (`duree_heures`).

---

## ⚠️ Points connus
- **Hors ligne** : un écran jamais ouvert en ligne sur l'appareil n'a pas encore de données ; seules les collectes peuvent être créées sans réseau.
- L'export PDF passe par la fenêtre d'impression du navigateur (« Enregistrer en PDF »).

---

## ✅ Vérifications de cette version
- Pour chaque PR : `tsc` 0 erreur, build réussi, lint sans nouvelle erreur, scan des secrets.
- **Mode hors ligne** testé sur une version de production locale (base dev, serveur coupé) : écrans affichés avec leurs données, navigation, collecte saisie hors ligne puis synchronisée au retour du serveur et présente en base, effacement complet à la déconnexion.
- Tests sur la base dev : création de membres et accès (copie, WhatsApp, lien), réinitialisation à usage unique, limite du forfait, rapports et export PDF, types de tickets en jours.
