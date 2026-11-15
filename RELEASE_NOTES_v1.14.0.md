# OptiSpace v1.14.0 — Sécurité renforcée, agent de sécurité et bot vocal

**Date :** 15 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.13.0 (14/11/2026)
**PR de mise en production :** #79, #80, #81, #82, #83

Cette version corrige les failles du test d'intrusion du 15/11. Elle détecte les tentatives d'intrusion et les signale sur Telegram. Un agent de sécurité tourne dans le cloud et vous soumet ses correctifs pour validation. Le bot Telegram comprend les notes vocales et y répond à voix haute.

---

## 🔒 Sécurité (test d'intrusion du 15/11/2026, PR #79)
- **Critique** : `/api/db` ne permettait plus de lire les données d'une autre organisation. Les jointures sont limitées à l'organisation du client, et les références sont vérifiées à l'écriture.
- **Connexion** :
  - compte verrouillé 15 minutes après 10 échecs ;
  - nombre de requêtes limité sur la connexion, la réinitialisation, l'inscription et la définition du mot de passe ;
  - sessions révoquées après un changement de mot de passe ;
  - plus de possibilité de deviner les comptes existants par le temps de réponse.
- `/api/auth/update-password` est désactivée : elle changeait le mot de passe sans demander l'ancien.
- Les routes de diagnostic sont réservées au super admin. Les erreurs SQL brutes sont masquées. La commande SQL du bot passe en lecture seule. Une CSP minimale est ajoutée.
- Checklist réutilisable : `docs/CHECK_SECURITE.md`.

## 🚨 Détection des intrusions (PR #80)
- **Tentatives détectées** :
  - force brute et compte verrouillé ;
  - requêtes trafiquées et jeton falsifié ;
  - CSRF ;
  - scans de fichiers sensibles (`.env`, `.git`, `wp-admin`…) ;
  - accès au back-office sans droits ;
  - webhooks sans secret ;
  - inconnu sur le bot.
- Chaque tentative ouvre un **incident**, signalé sur Telegram avec les boutons Détails, Résolu et Fausse alerte.
- **Menu « 🩺 Santé de l'application »** (`/sante`) et rubrique Sécurité dans l'État du système.
- **API `/api/security/incidents`** pour l'agent de sécurité, protégée par `SECURITY_AGENT_TOKEN`.

## 🤖 Agent de sécurité dans le cloud (PR #82)
- Une routine Claude Opus 5.5 tourne **toutes les heures** dans le cloud d'Anthropic, sans dépendre d'un ordinateur allumé. Elle analyse chaque incident et vérifie dans le code que l'attaque est bloquée.
- Si elle trouve une faille, elle la corrige et la pousse sur `develop` (préproduction). Le message Telegram « 🛠️ Correctif de sécurité prêt » porte alors trois boutons : **Voir le correctif**, **Tester en préproduction** et **Valider pour la production**.
- **Rien n'est mis en production sans la validation du propriétaire.**
- Rapport structuré : ce qui a été détecté, gravité, résultat, solution, pourquoi cette solution, vérifications et action attendue.

## 💬 Bot Telegram
- **Menu « 🛡️ Sécurité »** (`/securite`, PR #81) :
  - récap 24 h et bilan 7 jours ;
  - incidents ouverts et incidents traités ;
  - réglages sensibles.
- **Questions de sécurité à l'assistant**, à l'écrit comme à l'oral (PR #82).
- **Réponse vocale** (PR #82) : à une note vocale, le bot répond par écrit puis par une courte note vocale ElevenLabs.
- **Correctif** (PR #83) : la transcription des notes vocales échouait. Groq refusait l'extension `.oga`, et OpenRouter n'avait plus de crédit. Groq est maintenant utilisé en premier.

## 🗄️ Base de données
- `supabase/migrations/20261115_security_events.sql` (idempotente) : appliquée sur la production avant la fusion de la PR #80, après sauvegarde.

## ⚙️ Variables d'environnement
- `SECURITY_AGENT_TOKEN` (Production) : accès de l'agent de sécurité.
- `ELEVENLABS_API_KEY` (Production, Preview) : réponses vocales du bot.

---

## ⚠️ Points connus
- **OpenRouter n'a plus de crédit** : il ne sert plus que de relais pour la transcription et les modèles open source.
- **Réponses vocales** : elles consomment des crédits ElevenLabs. Une limite de crédits est fixée sur la clé. Si elle est atteinte, le bot répond par écrit seulement.
- La routine cloud de l'agent de sécurité se règle sur claude.ai/code (environnement « OptiSpace sécurité », sans connecteurs).

---

## ✅ Vérifications de cette version
- Correctifs du test d'intrusion : attaques rejouées en local, toutes bloquées. Aucune régression sur les rôles admin, collecteur et point de vente.
- Détection : 9 types d'attaques simulés en local, tous détectés.
- `tsc` sans erreur, lint sans nouvelle erreur et build réussi pour chaque PR. Préproduction prête avant chaque fusion.
- **Production** :
  - agent de sécurité cloud : premier passage réussi, l'API répond ;
  - 4 scans WordPress du 15/11 analysés et résolus par l'agent ;
  - menu Sécurité vérifié dans Telegram par le propriétaire.
- **Non testés en conditions réelles** : la réponse vocale ElevenLabs après le correctif de transcription, et le circuit complet d'un correctif proposé par l'agent (aucune faille trouvée pour l'instant).
