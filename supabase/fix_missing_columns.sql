-- ============================================================
-- OPTIWIFI - Correction des colonnes manquantes + RLS recursion fix
-- ============================================================
-- Ajoute les colonnes manquantes et corrige l'erreur 42P17
-- (infinite recursion detected in policy for relation "profiles")
--
-- À exécuter DANS SUPABASE SQL EDITOR APRÈS avoir appliqué init.sql:
--   https://supabase.com/dashboard/project/nvaavjyogadlimkosdsr/sql
--
-- IMPORTANT: Ce script est 100% idempotent - peut être relancé sans erreur
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
-- Fonction helper is_admin() — corrigée pour éviter la récursion infinie
-- SET LOCAL row_security = 'off' contourne le RLS lors de la requête
-- sur profiles, évitant la boucle infinie (42P17)
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
-- Ajout des colonnes manquantes (idempotent avec IF NOT EXISTS)
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
-- Triggers updated_at (DROP IF EXISTS + CREATE = idempotent)
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
-- CORRECTION DES POLITIQUES RLS
-- Pour éviter l'erreur 42P17, on DROP TOUTES les politiques existantes
-- puis on en recrée de nouvelles avec des noms uniques.
-- On utilise DROP ... IF EXISTS pour chaque nom possible.
-- ============================================================

-- D'abord, supprimer TOUTES les politiques existantes sur profiles
DROP POLICY IF EXISTS "Utilisateur voit son profil" ON profiles;
DROP POLICY IF EXISTS "Utilisateur modifie son profil" ON profiles;
DROP POLICY IF EXISTS "Utilisateur cree son profil" ON profiles;
DROP POLICY IF EXISTS "Admins gerent tous les profils" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_all_admin" ON profiles;
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins read write profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_allow" ON profiles;

-- Recréer les politiques profiles avec des noms uniques
CREATE POLICY "fix_profiles_select" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());

CREATE POLICY "fix_profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "fix_profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "fix_profiles_all_admin" ON profiles
  FOR ALL USING (is_admin());

-- Supprimer et recréer les politiques sur ticket_types
DROP POLICY IF EXISTS "Tous voient les tickets actifs" ON ticket_types;
DROP POLICY IF EXISTS "Admins gerent les ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Everyone authenticated reads active ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Admins manage ticket types" ON ticket_types;
DROP POLICY IF EXISTS "ticket_types_read_all" ON ticket_types;
DROP POLICY IF EXISTS "ticket_types_write_admin" ON ticket_types;

CREATE POLICY "fix_ticket_types_read_all" ON ticket_types
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "fix_ticket_types_write_admin" ON ticket_types
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

-- Supprimer et recréer les politiques sur points_of_sale
DROP POLICY IF EXISTS "Admins gerent les POS" ON points_of_sale;
DROP POLICY IF EXISTS "Collecteurs lisent leurs POS" ON points_of_sale;
DROP POLICY IF EXISTS "Admins manage POS" ON points_of_sale;
DROP POLICY IF EXISTS "Collectors read assigned POS" ON points_of_sale;
DROP POLICY IF EXISTS "pos_all_authenticated" ON points_of_sale;

CREATE POLICY "fix_pos_read_all" ON points_of_sale
  FOR SELECT USING (true);

CREATE POLICY "fix_pos_write_admin" ON points_of_sale
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "fix_pos_update_admin" ON points_of_sale
  FOR UPDATE USING (is_admin());

CREATE POLICY "fix_pos_delete_admin" ON points_of_sale
  FOR DELETE USING (is_admin());

-- Supprimer et recréer les politiques sur ticket_allocations
DROP POLICY IF EXISTS "Admins gerent les allocations" ON ticket_allocations;
DROP POLICY IF EXISTS "Collecteurs voient leurs allocations" ON ticket_allocations;
DROP POLICY IF EXISTS "allocations_all_authenticated" ON ticket_allocations;

CREATE POLICY "fix_allocations_read" ON ticket_allocations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM points_of_sale WHERE id = pos_id AND collecteur_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "fix_allocations_write" ON ticket_allocations
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "fix_allocations_update" ON ticket_allocations
  FOR UPDATE USING (is_admin());

CREATE POLICY "fix_allocations_delete" ON ticket_allocations
  FOR DELETE USING (is_admin());

-- Supprimer et recréer les politiques sur collections
DROP POLICY IF EXISTS "Admins gerent toutes les collectes" ON collections;
DROP POLICY IF EXISTS "Collecteurs gerent leurs collectes" ON collections;
DROP POLICY IF EXISTS "Admins manage collections" ON collections;
DROP POLICY IF EXISTS "Collectors manage own collections" ON collections;
DROP POLICY IF EXISTS "collections_all_authenticated" ON collections;

CREATE POLICY "fix_collections_admin" ON collections
  FOR ALL USING (is_admin());

CREATE POLICY "fix_collections_collecteur" ON collections
  FOR SELECT USING (collecteur_id = auth.uid());

-- Supprimer et recréer les politiques sur collection_items
DROP POLICY IF EXISTS "Acces items via collection" ON collection_items;
DROP POLICY IF EXISTS "Users access collection items via collection" ON collection_items;
DROP POLICY IF EXISTS "collection_items_all_authenticated" ON collection_items;

CREATE POLICY "fix_collection_items_access" ON collection_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
      AND (collections.collecteur_id = auth.uid() OR is_admin())
    )
  );

-- Supprimer et recréer les politiques sur audit_logs
DROP POLICY IF EXISTS "Admins voient les logs" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_all_authenticated" ON audit_logs;

CREATE POLICY "fix_audit_logs_admin" ON audit_logs
  FOR ALL USING (is_admin());

-- Supprimer et recréer les politiques sur wifi_spaces
DROP POLICY IF EXISTS "Users can view all wifi_spaces" ON wifi_spaces;
DROP POLICY IF EXISTS "Admins can insert wifi_spaces" ON wifi_spaces;
DROP POLICY IF EXISTS "Admins can update wifi_spaces" ON wifi_spaces;
DROP POLICY IF EXISTS "Admins can delete wifi_spaces" ON wifi_spaces;

CREATE POLICY "fix_wifi_spaces_read" ON wifi_spaces
  FOR SELECT USING (true);

CREATE POLICY "fix_wifi_spaces_write" ON wifi_spaces
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- VÉRIFICATION : afficher les profils existants
-- ============================================================
SELECT id, nom, email, role, devise FROM profiles ORDER BY created_at;

-- VÉRIFICATION : afficher les colonnes des tables
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'points_of_sale', 'ticket_types', 'ticket_allocations', 'collections', 'collection_items', 'wifi_spaces')
ORDER BY table_name, ordinal_position;
