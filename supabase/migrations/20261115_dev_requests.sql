-- Demandes de développement confiées à Claude Code depuis Telegram (menu « 🤖 IA »).
-- Idempotente. La table est aussi créée à la demande par src/lib/dev-requests.ts.
BEGIN;

CREATE TABLE IF NOT EXISTS dev_requests (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  request TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  plan TEXT,
  summary TEXT,
  feedback TEXT,
  branch TEXT,
  commit_sha TEXT,
  pr_number INT,
  session_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Anti-doublon des rapports des routines planifiées (un même rapport au plus une fois par 24 h).
-- Aussi créée à la demande par src/app/api/dev/agent-report/route.ts.
CREATE TABLE IF NOT EXISTS agent_reports (
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, title)
);

COMMIT;
