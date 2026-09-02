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

-- ============================================================
-- Correction des politiques RLS pour éviter la récursion infinie
-- Le profiles select policy peut avoir une requête SELECT sur profiles
-- ce qui cause une récursion infinie via is_admin()
-- ============================================================

-- Profiles : SELECT (utilisateur voit son profil + admins voient tout)
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "Utilisateur voit son profil" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());

-- Profiles : UPDATE
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "Utilisateur modifie son profil" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Profiles : INSERT
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "Utilisateur cree son profil" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Profiles : ALL (admins gèrent tous les profils)
DROP POLICY IF EXISTS "Admins gerent tous les profils" ON profiles;
CREATE POLICY "profiles_all_admin" ON profiles
  FOR ALL USING (is_admin());

-- Ticket types admin policies (remove inline EXISTS if present)
DROP POLICY IF EXISTS "ticket_types_write_admin" ON ticket_types;
CREATE POLICY "ticket_types_write_admin" ON ticket_types
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());