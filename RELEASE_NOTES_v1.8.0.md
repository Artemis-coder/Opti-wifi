# OptiSpace v1.8.0 — Guide de démarrage interactif

**Date :** 2 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.7.0 (02/11/2026)
**PR de mise en production :** #60

Un nouveau client ne se perd plus dans l'application. Dès sa première connexion, OptiSpace lui montre **quoi faire, dans quel ordre, et où cliquer**, jusqu'à ce que son espace soit prêt à suivre ses ventes de tickets.

---

## ✨ Nouveautés

### Les étapes, dans l'ordre
1. **Créer sa zone** (espace Wi-Fi) : le quartier ou le site où il vend ses tickets.
2. **Ajouter un point de vente** : la boutique, la cabine ou le kiosque qui revend les tickets.
3. **Créer ses types de tickets** : durée (en jours ou en heures) et prix de vente.
4. **Allouer des tickets** à un point de vente : son stock à vendre.
5. **Enregistrer sa première collecte** : l'application calcule les tickets vendus et le montant attendu.
6. *(Facultatif)* **Ajouter un collecteur** qui fera les tournées.

Les étapes **se cochent d'elles-mêmes** d'après ce qui a réellement été créé, juste après chaque enregistrement.

### Fenêtre de bienvenue
À la première arrivée, une fenêtre présente les 5 étapes simplement. Le bouton « C'est parti, montrez-moi » lance le guide.

### Guide interactif (« cliquez ici »)
L'écran s'assombrit autour de l'élément à utiliser, qui est entouré, avec une bulle d'explication (ex. « Étape 2 sur 5 — Cliquez sur « Ajouter » ») :
- **sur le tableau de bord** : l'entrée du menu à ouvrir sur ordinateur, ou le bouton du guide sur mobile (le menu y est caché) ;
- **sur l'écran de l'étape** : le bouton « Ajouter », ou le formulaire à remplir ;
- **une fois l'étape faite** : le bouton de l'étape suivante.

L'élément éclairé reste cliquable ; « Compris » (ou Échap) ferme la bulle, qui ne revient pas pendant la session.

### Carte « Guide de démarrage » sur le tableau de bord
- **Barre de progression** (ex. 2 / 5).
- **L'étape à faire maintenant**, avec son bouton.
- **Toutes les étapes** : faites (cochées), en cours, à venir (verrouillées).
- Bouton **« Masquer le guide »**, réversible.
- **À la fin** : « Bravo, votre espace est prêt ! », avec un raccourci pour ajouter un collecteur, puis le guide disparaît.

### Bandeau d'étape sur chaque écran concerné
Sur le formulaire comme sur la liste (zones, points de vente, types de tickets, allocations, collectes) :
- ce qu'il faut faire ici et pourquoi ;
- puis **« Étape terminée — prochaine étape »**, avec le bouton pour y aller ;
- si une étape précédente manque, il l'indique et y mène.

### Pour qui
- **Seulement l'administrateur d'un espace créé il y a moins de 30 jours** et pas encore configuré. Les clients existants ne voient rien.
- L'invitation à activer les notifications attend la fin de la fenêtre de bienvenue, pour ne pas s'empiler.

---

## 📱 Mobile
- Fenêtre de bienvenue défilable, bouton toujours accessible.
- Projecteur **toujours dans l'écran** : cadre limité aux bords et à la zone sous l'en-tête fixe, y compris pour un bouton pleine largeur.
- Le cadre **suit exactement l'élément**, sans décalage pendant le défilement, et ne s'affiche qu'une fois la page arrêtée sur l'élément.
- Formulaires plus grands que l'écran (allocation, collecte) : affichés à partir de leur début, bulle en bas de l'écran.

---

## 🔧 Technique
- Progression calculée à partir des données de l'espace (comptages via `/api/db`). Elle fonctionne aussi hors ligne, grâce à la copie locale.
- Chaque création ou modification réussie prévient le guide immédiatement (événement `optispace:data-changed`).
- Cibles du guide repérées par l'attribut `data-tour` (menu latéral, boutons « Ajouter », formulaires).
- Préférences (bienvenue vue, guide masqué, progression) gardées par utilisateur sur l'appareil.

---

## 🗄️ Base de données
Aucune migration.

---

## ⚠️ Points connus
- Le guide se base sur l'existence des données : un espace créé il y a plus de 30 jours, même incomplet, ne l'affiche pas.
- Les préférences du guide sont gardées sur l'appareil : sur un autre téléphone, la fenêtre de bienvenue peut réapparaître tant que l'espace n'est pas configuré.

---

## ✅ Vérifications de cette version
- `tsc` 0 erreur, build réussi (version exacte de la PR reconstruite avant fusion), lint sans nouvelle erreur, scan des secrets.
- **Parcours complet sur la base dev**, avec un nouveau compte inscrit puis validé par le super admin : bienvenue → menu → zone → point de vente → types de tickets → allocation → collecte → félicitations. Bandeaux et projecteurs vérifiés à chaque étape ; le guide disparaît à la fin.
- **Mobile (375 px)** : bienvenue, carte, bandeaux et projecteurs (bouton pleine largeur, étape suivante, formulaire d'allocation) vérifiés.
- **Production** : déploiement en ligne sur www.optiwifi.site après la fusion.
