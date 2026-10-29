-- ============================================================
-- OPTIWIFI - Secrets d'intégration saisis dans le back-office (bot Telegram…)
-- Valeurs chiffrées par l'application (AES-256-GCM, clé dérivée de JWT_SECRET) :
-- la base ne contient jamais le jeton en clair. Prioritaires sur les variables Vercel.
-- Table séparée de platform_settings pour ne jamais apparaître dans l'API des paramètres.
-- Script idempotent : peut être rejoué sans effet de bord.
-- ============================================================

CREATE TABLE IF NOT EXISTS integration_secrets (
  key             VARCHAR(60) PRIMARY KEY,
  value_encrypted TEXT NOT NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Accès uniquement par l'API serveur (jamais via /api/db)
ALTER TABLE integration_secrets ENABLE ROW LEVEL SECURITY;
