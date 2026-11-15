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

COMMIT;
