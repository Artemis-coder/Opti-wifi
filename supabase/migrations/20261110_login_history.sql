-- ============================================================
-- OPTIWIFI - Historique des connexions (Paramètres > Sécurité)
-- Une ligne par connexion réussie : appareil, adresse IP et lieu approximatif (déduit de
-- l'adresse IP par Vercel, à la ville près). Chaque utilisateur voit ses propres connexions.
-- Conservé 180 jours ; supprimé avec le compte (ON DELETE CASCADE).
-- Script idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS login_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip               VARCHAR(64),
  user_agent       TEXT,
  device_type      VARCHAR(20),
  browser          VARCHAR(60),
  os               VARCHAR(60),
  city             VARCHAR(120),
  region           VARCHAR(120),
  country          VARCHAR(2),
  latitude         NUMERIC(9, 6),
  longitude        NUMERIC(9, 6)
);

CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_org ON login_history (organization_id, created_at DESC);

-- Accès uniquement par l'API serveur (jamais via /api/db)
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
