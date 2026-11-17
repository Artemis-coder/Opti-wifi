# OptiSpace v1.24.0 — Bot Telegram plus rapide et plus intelligent

**Date :** 17 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.23.0 (17/11/2026)
**PR de mise en production :** #100

Aucune migration manuelle, aucune variable d'environnement.

---

## ⚡ Bot Telegram — plus rapide
- **Réponse affichée au fil de l'écriture** : un message provisoire se met à jour toutes les 1,5 s, puis il est remplacé par la réponse mise en forme avec le menu. Ce n'est pas le cas pour les notes vocales.
- **Indicateur « écrit… » maintenu** pendant toute la réflexion, au lieu de disparaître au bout de 5 s.
- **Moins d'attente avant l'IA** : les tables de conversation sont vérifiées une fois par instance au lieu de 4 requêtes à chaque message ; l'historique et la mémoire sont lus en parallèle, et le message est enregistré pendant que l'IA travaille.
- Consignes de l'assistant : la réponse d'abord, sans préambule ; les lectures indépendantes lancées en même temps.

## 🧠 Bot Telegram — plus intelligent
- **Mémoire durable** : « Retiens que… » enregistre un fait ou une préférence (table `bot_learned_facts`), « oublie… » l'efface. Les faits retenus s'appliquent à chaque conversation, y compris quand un modèle open source prend le relais.
- **Nouveaux outils** : rapports business (rapport du jour, bilan de la semaine, anomalies d'encaissement, clients à risque) et état du paiement en ligne SasPay, consultables directement dans une question libre.

## 🧹 Nettoyage
- Suppression de l'ancien moteur du bot (environ 4 200 lignes) : il ne servait plus, car le webhook actif passait déjà tout à l'assistant Claude.
- Routes supprimées : `/api/telegram/webhook`, `/api/telegram/ai-webhook`, `/api/test-groq`. Les outils « SQL libre » et « déploiement » de l'ancien moteur disparaissent avec lui.
- Transcription des notes vocales isolée dans `src/lib/bot/transcribe.ts` (Groq, puis OpenRouter en relais).

## 🛠️ Également dans cette version
- `npm run backup:prod` : double sauvegarde de la production (fichier JSON local + branche Neon conservée 30 jours) et procédure mise à jour.

---

## 🗄️ Base de données
- `bot_learned_facts` est créée au besoin par l'application (`CREATE TABLE IF NOT EXISTS`) ; elle existait déjà en production (vide).
- Sauvegarde avant publication : `backup-prod-neon-2026-11-17T20-32-57-724Z.json` (41 tables, 642 lignes, aucune table en baisse) et branche Neon `backup-prod-20261117-2033` (jusqu'au 17/12/2026).

## ⚠️ Points connus
- Une URL de deploy hook Vercel était écrite en clair dans l'ancien code. Elle est retirée du code mais reste dans l'historique Git : le hook doit être désactivé dans Vercel (Settings → Git → Deploy Hooks).
- Next.js 16.4.3 est signalé par le build comme touché par une faille connue : mise à jour à planifier.

## ✅ Vérifications
- `tsc` 0 erreur, ESLint sans erreur sur les fichiers modifiés, `npm run build` OK, scan des secrets ; vérifications GitHub au vert.
- **Production** : déploiement prêt ; `/api/telegram/ai-webhook` et `/api/telegram/webhook` et `/api/test-groq` renvoient 404, `/api/telegram/ai-webhook-v2` refuse les appels sans le secret Telegram (403).
- Non vérifié dans cette session : l'échange réel avec le bot (réponse en direct, mémoire, nouveaux outils, notes vocales).
