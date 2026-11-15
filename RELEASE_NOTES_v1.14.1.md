# OptiSpace v1.14.1 — Nouvelle voix du bot

**Date :** 15 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.14.0 (15/11/2026)
**PR de mise en production :** #84

Version de maintenance : le bot Telegram répond avec une voix plus professionnelle. Elle ne contient ni migration ni nouvelle variable d'environnement.

---

## 💬 Bot Telegram
- **Réponse vocale** : nouvelle voix ElevenLabs (`4SFJvuIUvxaPLgk8FoK3`), choisie par le propriétaire parce qu'elle est plus professionnelle. La variable `ELEVENLABS_VOICE_ID` permet toujours d'en changer sans modifier le code.

## 📚 Documentation
- `RELEASE_NOTES_v1.14.0.md` et README à jour.
- `docs/PROCEDURE_DEPLOIEMENT.md` : nouvelle **étape 7**, avec une release GitHub obligatoire après chaque mise en production validée.

## 🗄️ Base de données
Aucune migration.

---

## ✅ Vérifications de cette version
- `tsc` : 0 erreur. Lint : 0 erreur sur le fichier modifié. Build : réussi.
- **Production** : déploiement prêt, site et API de l'agent de sécurité qui répondent.
- **Non testé en conditions réelles** : l'écoute de la nouvelle voix. Une note vocale au bot suffit à la vérifier.
