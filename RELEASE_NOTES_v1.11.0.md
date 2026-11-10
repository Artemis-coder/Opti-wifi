# OptiSpace v1.11.0 — Connexions & appareils et conditions d'utilisation dans l'espace

**Date :** 10 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.10.0 (10/11/2026)
**PR de mise en production :** #71

Version qui permet à chaque utilisateur de **savoir qui se connecte à son compte**, d'où et avec quel appareil. Les **conditions d'utilisation** sont aussi toujours consultables dans l'espace, avec la date à laquelle elles ont été acceptées.

---

## ✨ Nouveautés

### Connexions & appareils
- **Chaque connexion réussie est enregistrée**, pour l'administrateur comme pour le collecteur :
  - date et heure ;
  - appareil : téléphone, tablette ou ordinateur, avec le navigateur et le système (ex. « Chrome sur Android 14 ») ;
  - adresse IP ;
  - lieu approximatif (ville, pays) et **coordonnées géographiques**, avec un lien vers la carte.
- **Nouvel onglet Paramètres > Connexions & appareils** :
  - la dernière connexion ;
  - la liste des connexions, avec le badge **« Cet appareil »** ;
  - en cas de connexion inconnue, l'invitation à changer de mot de passe.
- **Paramètres > Profil > Rôle et activité** : « Dernière connexion » affiche maintenant le jour, l'heure, l'appareil, le lieu, les coordonnées et l'IP, au lieu de « Jamais ». Un lien mène à l'historique complet.
- **Comment ces informations sont gérées :**
  - la position est déduite de l'adresse IP, à la ville près, sans aucune autorisation demandée ;
  - l'historique est conservé **180 jours** ;
  - chacun ne voit que **ses propres connexions** ;
  - **RGPD** : l'historique est inclus dans « Télécharger mes données » et effacé avec le compte.

### Menu « Conditions d'utilisation »
- Nouvelle entrée dans le menu, **juste au-dessus de « Paramètres »**, pour l'administrateur et le collecteur.
- Le texte en vigueur est toujours consultable dans l'espace.
- **Preuve d'acceptation** : « Vous avez accepté ces conditions le … », avec la date et l'heure enregistrées à la création du compte.
  - Les comptes créés avant la case d'acceptation, dont les collecteurs, voient : « En utilisant OptiSpace, vous acceptez les conditions d'utilisation ».
- Le texte est le même que sur la page publique `/conditions`.

### Interface
- Sur mobile, l'onglet actif des Paramètres est ramené automatiquement dans la zone visible de la barre d'onglets.

---

## 🗄️ Base de données

Migration idempotente, **appliquée en développement et en production**. La production a été sauvegardée juste avant, et la table vérifiée absente en lecture seule.

| Fichier | Effet |
|---|---|
| `supabase/migrations/20261110_login_history.sql` | Table `login_history` (historique des connexions), sécurité par ligne (RLS) active, accessible uniquement par le serveur |

---

## ⚠️ Points connus
- L'historique commence avec cette version : les connexions antérieures n'y figurent pas. Le Profil affiche alors la dernière date connue du compte.
- La position est approximative (déduite de l'adresse IP) : un réseau mobile ou un VPN peut indiquer une autre ville.

---

## ✅ Vérifications de cette version
- `tsc` 0 erreur, build réussi, lint sans nouvelle erreur, scan des secrets.
- Base dev, connexions simulées (Android à Abidjan, iPhone à Yamoussoukro) :
  - appareil, lieu, coordonnées et IP affichés ;
  - badge « Cet appareil » ;
  - historique présent dans l'export des données ;
  - date d'acceptation des conditions affichée ;
  - affichage sur ordinateur et mobile.
- Production :
  - sauvegarde (35 tables), puis création de la table, vérifiée : 14 colonnes, RLS active, 3 index ;
  - déploiement prêt ;
  - route `/conditions-utilisation` protégée et API de l'historique fermée sans session.
