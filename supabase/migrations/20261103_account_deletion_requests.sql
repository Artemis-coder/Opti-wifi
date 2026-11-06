-- ============================================================
-- OPTIWIFI - Demandes de suppression de compte et de données (RGPD)
-- L'administrateur d'un espace demande la suppression depuis Paramètres > Zone de danger ;
-- le super admin la valide (effacement définitif de l'espace et de ses données) ou la refuse.
-- La demande est conservée après l'effacement (nom de l'espace et demandeur en clair) pour
-- garder la trace de la demande et de la décision. Script idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
  organization_name   VARCHAR(255) NOT NULL,
  requested_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  requester_name      VARCHAR(255),
  requester_email     VARCHAR(255),
  reason              TEXT,
  -- L'administrateur a confirmé avoir téléchargé (ou renoncé à télécharger) ses données
  export_acknowledged BOOLEAN NOT NULL DEFAULT false,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'rejected', 'cancelled')),
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ,
  processed_by        UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  decision_note       TEXT,
  -- Résumé de ce qui a été effacé (nombre de lignes par table)
  deleted_summary     JSONB
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status ON account_deletion_requests (status, requested_at DESC);
-- Une seule demande en attente par espace
CREATE UNIQUE INDEX IF NOT EXISTS uniq_account_deletion_pending
  ON account_deletion_requests (organization_id) WHERE status = 'pending';

-- Accès uniquement par l'API serveur (jamais via /api/db)
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
