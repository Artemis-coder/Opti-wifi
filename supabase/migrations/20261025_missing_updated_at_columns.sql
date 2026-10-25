-- ============================================================
-- OPTIWIFI - Colonnes updated_at manquantes
-- Le trigger set_updated_at (BEFORE UPDATE) est attaché à ces tables mais la
-- colonne updated_at n'existe pas : toute mise à jour échoue
-- (« record "new" has no field "updated_at" »), y compris les mises à jour
-- en cascade (ON DELETE SET NULL lors de la suppression d'un compte).
-- Concerne notamment la modification d'un encaissement (collections).
-- Script idempotent : peut être rejoué sans effet de bord.
-- ============================================================

ALTER TABLE collections        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE collection_items   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE audit_logs         ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE platform_audit_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
