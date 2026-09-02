-- ============================================================
-- OPTIWIFI - Correction des colonnes manquantes
-- ============================================================
-- Ajoute les colonnes qui manquent dans la base de données actuelle
-- suite au re-run de init.sql (qui a recréé les tables sans ces colonnes)
--
-- À exécuter DANS SUPABASE SQL EDITOR APRÈS avoir appliqué init.sql
-- et toutes les migrations existantes:
--   https://supabase.com/dashboard/project/nvaavjyogadlimkosdsr/sql
-- ============================================================

-- ============================================================
-- Fonction helper set_updated_at (doit être créée AVANT les triggers)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Ajout des colonnes manquantes
-- ============================================================

-- points_of_sale : colonnes space_id et updated_at
ALTER TABLE points_of_sale
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ticket_types : colonnes space_id et updated_at
ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ticket_allocations : colonnes space_id et date_allocation
ALTER TABLE ticket_allocations
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_allocation DATE DEFAULT CURRENT_DATE;

-- collections : colonnes space_id, date_collecte, commission
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_collecte DATE,
  ADD COLUMN IF NOT EXISTS commission DECIMAL(12, 2) DEFAULT 0;

-- collection_items : colonne space_id
ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL;

-- profiles : colonne devise
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS devise VARCHAR(10) DEFAULT 'XOF';

-- ============================================================
-- Fonction helper is_admin() — corrigée pour éviter la récursion infinie
-- (SET LOCAL row_security = 'off' permet de contourner le RLS
--  lors de la requête sur profiles, évitant le bouclage)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  SET LOCAL row_security = 'off';
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrateur'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Triggers updated_at (après que la fonction soit créée)
-- ============================================================

-- points_of_sale
DROP TRIGGER IF EXISTS trg_points_of_sale_updated_at ON points_of_sale;
CREATE TRIGGER trg_points_of_sale_updated_at
  BEFORE UPDATE ON points_of_sale
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ticket_types
DROP TRIGGER IF EXISTS trg_ticket_types_updated_at ON ticket_types;
CREATE TRIGGER trg_ticket_types_updated_at
  BEFORE UPDATE ON ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- wifi_spaces
DROP TRIGGER IF EXISTS trg_wifi_spaces_updated_at ON wifi_spaces;
CREATE TRIGGER trg_wifi_spaces_updated_at
  BEFORE UPDATE ON wifi_spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();