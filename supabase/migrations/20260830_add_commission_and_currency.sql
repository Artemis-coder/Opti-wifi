-- ============================================================
-- OPTIWIFI - Ajout commission, date_collecte et devise
-- ============================================================

-- ETAPE 1 : Ajout colonnes dans collections
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS commission DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_collecte DATE;

-- ETAPE 2 : Ajout colonne devise dans profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS devise VARCHAR(10) DEFAULT 'XOF';
