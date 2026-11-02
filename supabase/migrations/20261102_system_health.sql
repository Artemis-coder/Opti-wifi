-- ============================================================
-- OPTIWIFI - État du système (back-office super admin)
--  - system_health_checks : résultat de chaque contrôle (historique, alertes au changement d'état)
--  - system_errors        : erreurs serveur et échecs d'envoi (API, push, e-mail, Telegram, tâches)
--  - system_cron_runs     : dernière exécution de chaque tâche planifiée
-- Aucun message ne contient de secret ni de donnée personnelle (textes tronqués par l'application).
-- Conservation : 30 jours (purge par le contrôle de santé). Script idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS system_health_checks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  overall     VARCHAR(10) NOT NULL CHECK (overall IN ('ok', 'warning', 'error')),
  components  JSONB NOT NULL DEFAULT '[]'::jsonb,
  source      VARCHAR(20) NOT NULL DEFAULT 'cron'
);
CREATE INDEX IF NOT EXISTS idx_system_health_checks_checked_at ON system_health_checks (checked_at DESC);

CREATE TABLE IF NOT EXISTS system_errors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source       VARCHAR(20) NOT NULL,
  route        VARCHAR(200),
  message      VARCHAR(500) NOT NULL,
  status       INT
);
CREATE INDEX IF NOT EXISTS idx_system_errors_source_time ON system_errors (source, occurred_at DESC);

CREATE TABLE IF NOT EXISTS system_cron_runs (
  name         VARCHAR(60) PRIMARY KEY,
  last_run_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ok           BOOLEAN NOT NULL,
  message      VARCHAR(300),
  duration_ms  INT
);

-- Accès uniquement par l'API serveur (jamais via /api/db)
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_cron_runs ENABLE ROW LEVEL SECURITY;
