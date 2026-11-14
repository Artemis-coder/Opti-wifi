# OptiSpace v1.13.0 — Notifications en temps réel : le téléphone du point de vente sonne

**Date :** 14 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.12.1 (14/11/2026)
**PR de mise en production :** #76, #77

Avec cette version, **chaque action sur les tickets et l'argent d'un point de vente est notifiée** aux personnes concernées, sur tous leurs appareils. **Le téléphone du point de vente sonne** dès qu'il reçoit des tickets, même verrouillé et application fermée. Elle apporte aussi les **CGU et CGV modifiables** depuis le back-office du site vitrine.

---

## ✨ Nouveautés

### Une notification à chaque action
L'auteur de l'action n'est jamais notifié de sa propre action.

| Action | Point de vente (son téléphone sonne) | Collecteur du point de vente | Administrateurs |
|---|---|---|---|
| Tickets attribués | « Nouveaux tickets reçus : vous avez reçu 200 tickets Pass 1h et 50 tickets Pass 24h » | ✓ | ✓ |
| Collecte enregistrée | « 45 000 FCFA collectés, commission de 2 500 FCFA » | ✓ | ✓ |
| Échange de tickets | « Rendus : … ; reçus : … » | ✓ | ✓ |
| Collecte ou allocation corrigée / supprimée | ✓ | ✓ | ✓ |
| Point de vente remis à zéro | ✓ | ✓ | ✓ |

- Valable aussi pour les saisies faites **hors ligne**, envoyées au retour du réseau.
- Le compte point de vente est maintenant **invité à activer les notifications**, après sa visite guidée, avec un texte qui lui est propre.

### Sur le téléphone
- **Notifications jamais silencieuses** : le téléphone sonne avec la sonnerie de notification du système, même verrouillé et application fermée.
- Pour le point de vente : **vibration marquée**, et la notification reste affichée jusqu'à ce qu'il la touche.
- **Une notification par événement** : elles ne se remplacent plus les unes les autres.
- **Icône OptiSpace** :
  - logo en couleur dans la notification ;
  - silhouette du personnage (logo détouré) dans la barre d'état, où Android n'affiche que des icônes d'une seule couleur.

### Synchronisation entre appareils
- Toucher une notification sur le téléphone la **marque comme lue partout**.
- Une notification lue sur un appareil **disparaît des autres** à leur prochaine ouverture.
- **Le téléphone est rattaché au compte connecté** :
  - à chaque ouverture, l'appareil reçoit les notifications du compte qui l'utilise ;
  - à la déconnexion, il est détaché de ce compte.

  Avant, un téléphone restait lié au premier compte qui y avait accepté les notifications, et le point de vente connecté ensuite ne recevait rien.

### Paramètres > Notifications
- **« Tester la sonnerie »** : une notification arrive 10 secondes plus tard, le temps de verrouiller le téléphone.
- **« Pas de son ? »** : comment régler Android (appui long sur une notification OptiSpace → « Alerte »).

### Site vitrine (back-office)
- **CGU et CGV modifiables** : version, introduction et sections (ajout, suppression, ordre). La date de mise à jour est posée automatiquement à chaque enregistrement, et chaque modification est tracée dans le journal d'audit.
- **Section « Les espaces » masquable** depuis le back-office.

---

## 🗄️ Base de données

| Fichier | Effet |
|---|---|
| `supabase/migrations/20261114_site_content_legal.sql` | Clés `cgu` et `cgv` autorisées dans `site_content` (présente en production, vérifiée en lecture seule) |

Les notifications ne demandent **aucune migration**.

---

## ⚠️ Points connus
- **Son sur Android** : si la catégorie de notification du site ou de l'application est en « Silencieux », la notification arrive sans son. Le point de vente la passe une seule fois en « Alerte » (aide « Pas de son ? » dans Paramètres).
- **Barre d'état Android** : la petite icône est toujours affichée en une seule couleur, imposée par Android. Le logo en couleur apparaît dans la notification elle-même.
- **iPhone** : les notifications nécessitent l'application installée sur l'écran d'accueil.
- Un appareil reçoit les notifications **du compte connecté** : un téléphone partagé entre deux comptes suit le dernier qui s'y est connecté.

---

## ✅ Vérifications de cette version
- **Base dev**, données de test supprimées ensuite :
  - allocation de 200 + 50 tickets : point de vente et collecteur notifiés, administrateur auteur non notifié ;
  - collecte saisie par le collecteur : point de vente et administrateur notifiés ;
  - suppression d'allocation par l'administrateur : point de vente et collecteur notifiés.
- **Téléphone Android réel** :
  - rattachement de l'appareil au compte point de vente constaté en base ;
  - notification reçue application fermée, puis **avec sonnerie** une fois la catégorie en « Alerte ».
- `tsc` 0 erreur, lint sans nouvelle erreur, scan des secrets ; build Vercel réussi.
- **Production** : service de notifications à jour, icône servie, test de sonnerie fermé sans session.
- Non testés en conditions réelles : l'échange de tickets et la remise à zéro d'un point de vente.
