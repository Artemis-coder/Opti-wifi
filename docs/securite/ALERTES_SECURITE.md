# Alertes de sécurité, santé de l'application et agent de sécurité

## Fonctionnement

```
Tentative d'attaque ──► bloquée par l'app ──► signal (security_events)
                                                 │
                                                 ▼
                         incident = tâche (security_incidents), regroupé par source
                                                 │  seuil atteint
                                                 ▼
          🚨 Telegram + cloche/push super admin ──► 🧠 analyse automatique (Claude, dans l'app)
                                                 │
                                                 ▼ toutes les heures
                 🤖 agent Claude Code planifié (ce Mac) : vérifie le code, corrige sur develop,
                    rend compte → 🤖 « Analyse de l'agent » sur Telegram
```

### Signaux détectés (`src/lib/security-events.ts`)

| Signal | Gravité | Alerte dès | Où |
|---|---|---|---|
| Compte verrouillé après 10 échecs | Élevée | 1er | `lib/neon/auth.ts` |
| Requête trafiquée vers la base (table, jointure, référence d'un autre client…) | Élevée | 1er | `api/db` |
| Jeton de session falsifié | Élevée | 1er | `proxy.ts` |
| Force brute (429 sur la connexion) | Moyenne | 3 | `api/auth/login` |
| Action refusée par le rôle | Moyenne | 3 | `api/db` |
| CSRF (requête venue d'un autre site) | Moyenne | 3 | `proxy.ts` |
| Scan de fichiers sensibles (`.env`, `.git`, `wp-admin`, `.php`…) → 404 | Moyenne | 3 | `proxy.ts` |
| Back-office appelé par un non super admin | Moyenne | 3 | `proxy.ts` |
| Webhook, cron ou jeton d'agent sans le bon secret | Moyenne | 3 | routes Telegram, crons, `api/security` |
| Ancienne route de mot de passe appelée | Moyenne | 3 | `api/auth/update-password` |
| Identifiants piégés (objet, tableau) | Moyenne | 3 | `api/auth/login` |
| Un inconnu écrit au bot Telegram | Moyenne | 3 | `api/telegram/ai-webhook-v2` |
| « Mot de passe oublié » ou inscriptions en série | Faible | 10 | routes d'authentification |

Anti-inondation : une alerte par incident, puis au plus une alerte de suivi par heure tant que l'attaque continue ; 20 alertes Telegram par heure au maximum ; 30 signaux écrits par minute au maximum pour une même source.

### Telegram
- Menu principal → **🩺 Santé de l'application** (ou `/sante`) :
  - **Bilan complet** : base, API, notifications, serveur, Vercel, tâches planifiées, sécurité ;
  - **Sécurité (24 h)** ;
  - **Incidents ouverts**.
- Sous chaque alerte : 🔍 **Détails** (derniers signaux et analyse), ✅ **Résolu**, 🙈 **Fausse alerte**.
- La même rubrique « Sécurité » apparaît dans **État du système** (`/platform/system`).

### Agent de sécurité
- **Analyse automatique** (`src/lib/security-triage.ts`) : au premier signalement, Claude Opus 5.5 rend un verdict (attaque réelle, robot, fausse alerte), un niveau de risque et des actions. Sans crédit Claude, les modèles open source du bot prennent le relais. Le modèle n'a aucun outil : les textes des attaquants ne peuvent rien déclencher.
- **Agent Claude Code** (tâche planifiée « OptiSpace — Agent de sécurité », toutes les heures, application Claude ouverte sur ce Mac) :
  - il lit les incidents via `GET /api/security/incidents` avec le jeton `~/.config/optispace/security-agent-token` ;
  - il vérifie le code ; si une faille est réelle, il la corrige **sur develop uniquement**, puis il rend compte via `PATCH /api/security/incidents/<id>`.
  - Il ne met jamais en production et n'écrit jamais dans la base de production.

## Mise en production (à faire une fois)
1. Sauvegarder la production, puis exécuter `supabase/migrations/20261115_security_events.sql` (idempotent, déjà appliqué sur dev).
2. Vercel → Settings → Environment Variables → Production : ajouter `SECURITY_AGENT_TOKEN` avec la valeur du fichier local :
   `pbcopy < ~/.config/optispace/security-agent-token` (copie dans le presse-papiers sans l'afficher).
3. Fusionner la PR, puis vérifier dans Telegram : 🩺 Santé de l'application → Bilan complet. La ligne « Agent de sécurité » doit indiquer « Accès configuré ».

Conservation : signaux 90 jours, incidents clos 180 jours (purge au contrôle de santé).
