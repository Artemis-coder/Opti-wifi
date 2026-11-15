-- ============================================================
-- OPTIWIFI - Détection des tentatives d'intrusion
-- security_events    : chaque signal suspect (force brute, requête trafiquée, jeton falsifié,
--                      scan de fichiers sensibles…). Conservé 90 jours.
-- security_incidents : regroupement des signaux d'une même source = une « tâche » de sécurité
--                      (ouverte → en cours → résolue / fausse alerte), alertée sur Telegram
--                      et traitée par l'agent de sécurité.
-- Accès uniquement par l'API serveur (jamais via /api/db). Script idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS security_incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint     VARCHAR(200) NOT NULL,
  type            VARCHAR(40)  NOT NULL,
  severity        SMALLINT     NOT NULL DEFAULT 2,          -- 1 faible, 2 moyenne, 3 élevée
  status          VARCHAR(20)  NOT NULL DEFAULT 'open',     -- open, in_progress, resolved, ignored
  title           VARCHAR(200) NOT NULL,
  ip              VARCHAR(64),
  country         VARCHAR(2),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  identifier      VARCHAR(254),                              -- identifiant visé (connexion)
  last_route      VARCHAR(300),
  last_detail     TEXT,
  event_count     INTEGER      NOT NULL DEFAULT 0,
  alerted_count   INTEGER      NOT NULL DEFAULT 0,
  first_seen      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_alert_at   TIMESTAMPTZ,
  analysis        TEXT,                                      -- rédigé par l'agent de sécurité
  resolution      TEXT,
  handled_by      VARCHAR(80),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT security_incidents_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'ignored'))
);

-- Un seul incident actif par source : les nouveaux signaux s'y ajoutent
CREATE UNIQUE INDEX IF NOT EXISTS uq_security_incidents_active
  ON security_incidents (fingerprint) WHERE status IN ('open', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents (status, last_seen DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  type         VARCHAR(40)  NOT NULL,
  severity     SMALLINT     NOT NULL DEFAULT 2,
  ip           VARCHAR(64),
  country      VARCHAR(2),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  identifier   VARCHAR(254),
  method       VARCHAR(10),
  route        VARCHAR(300),
  user_agent   TEXT,
  detail       TEXT,
  incident_id  UUID REFERENCES security_incidents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_time ON security_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_incident ON security_events (incident_id, occurred_at DESC);

ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
