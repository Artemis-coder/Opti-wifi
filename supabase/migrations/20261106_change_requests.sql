-- ============================================================
-- OPTIWIFI - Demandes de modification / suppression faites par un collecteur
-- Un collecteur qui s'est trompé (montant d'une collecte, quantité d'une allocation) ne
-- modifie pas directement : sa demande est validée ou refusée par l'administrateur de
-- l'espace, puis appliquée. L'administrateur, lui, modifie et supprime directement.
-- Script idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS change_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type      VARCHAR(20) NOT NULL CHECK (entity_type IN ('collection', 'allocation')),
  entity_id        UUID NOT NULL,
  action           VARCHAR(10) NOT NULL CHECK (action IN ('update', 'delete')),
  -- Nouvelles valeurs demandées (update) et valeurs au moment de la demande
  changes          JSONB,
  previous         JSONB,
  -- Libellé lisible (ex. « Collecte du 02/11 · Boutique Riviera »)
  label            VARCHAR(255),
  reason           TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  review_note      TEXT
);

CREATE INDEX IF NOT EXISTS idx_change_requests_org_status ON change_requests (organization_id, status, requested_at DESC);
-- Une seule demande en attente par élément
CREATE UNIQUE INDEX IF NOT EXISTS uniq_change_requests_pending
  ON change_requests (entity_type, entity_id) WHERE status = 'pending';

-- Accès uniquement par l'API serveur (jamais via /api/db)
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
