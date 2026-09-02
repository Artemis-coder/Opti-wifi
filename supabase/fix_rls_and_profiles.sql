-- ============================================================
-- OPTIWIFI - PATCH RLS + Profils manquants
-- IMPORTANT: Coller dans Supabase SQL Editor et cliquer "Run"
-- Ce script est à exécuter APRES le script principal init.sql
-- ============================================================

-- --------------------------------------------------------
-- PARTIE 1 : Créer les profils manquants pour les utilisateurs
-- qui se sont inscrits AVANT que les tables existaient
-- --------------------------------------------------------
INSERT INTO public.profiles (id, nom, email, role)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'nom', split_part(au.email, '@', 1), 'Utilisateur'),
  au.email,
  COALESCE(
    CASE
      WHEN au.raw_user_meta_data->>'role' IN ('administrateur','collecteur')
      THEN (au.raw_user_meta_data->>'role')::user_role
      ELSE NULL
    END,
    'administrateur'::user_role  -- On met admin par défaut pour les premiers utilisateurs
  )
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- --------------------------------------------------------
-- PARTIE 2 : Supprimer les anciennes politiques trop restrictives
-- et les remplacer par des politiques qui fonctionnent
-- --------------------------------------------------------

-- Politiques sur profiles
DROP POLICY IF EXISTS "Utilisateur voit son profil" ON profiles;
DROP POLICY IF EXISTS "Utilisateur modifie son profil" ON profiles;
DROP POLICY IF EXISTS "Admins gerent tous les profils" ON profiles;
DROP POLICY IF EXISTS "Admins read write profiles" ON profiles;
DROP POLICY IF EXISTS "Users read own profile" ON profiles;

-- Politiques sur points_of_sale
DROP POLICY IF EXISTS "Admins gerent les POS" ON points_of_sale;
DROP POLICY IF EXISTS "Collecteurs lisent leurs POS" ON points_of_sale;
DROP POLICY IF EXISTS "Admins manage POS" ON points_of_sale;
DROP POLICY IF EXISTS "Collectors read assigned POS" ON points_of_sale;

-- Politiques sur ticket_types
DROP POLICY IF EXISTS "Tous voient les tickets actifs" ON ticket_types;
DROP POLICY IF EXISTS "Admins gerent les ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Everyone authenticated reads active ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Admins manage ticket types" ON ticket_types;

-- Politiques sur ticket_allocations
DROP POLICY IF EXISTS "Admins gerent les allocations" ON ticket_allocations;
DROP POLICY IF EXISTS "Collecteurs voient leurs allocations" ON ticket_allocations;

-- Politiques sur collections
DROP POLICY IF EXISTS "Admins gerent toutes les collectes" ON collections;
DROP POLICY IF EXISTS "Collecteurs gerent leurs collectes" ON collections;
DROP POLICY IF EXISTS "Admins manage collections" ON collections;
DROP POLICY IF EXISTS "Collectors manage own collections" ON collections;

-- Politiques sur collection_items
DROP POLICY IF EXISTS "Acces items via collection" ON collection_items;
DROP POLICY IF EXISTS "Users access collection items via collection" ON collection_items;

-- --------------------------------------------------------
-- PARTIE 3 : Nouvelles politiques RLS simplifiées
-- Règle : tout utilisateur CONNECTÉ peut lire et écrire
-- --------------------------------------------------------

-- PROFILES : tout utilisateur connecté voit et modifie son profil
-- Les admins voient tous les profils
-- Note: is_admin() utilise SET LOCAL row_security = 'off' pour éviter la récursion infinie
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- POINTS_OF_SALE : tout utilisateur connecté peut tout faire
-- (on simplifie pour débloquer l'application)
CREATE POLICY "pos_all_authenticated" ON points_of_sale
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- TICKET_TYPES : tout utilisateur connecté peut lire
-- Seuls les admins peuvent écrire
CREATE POLICY "ticket_types_read_all" ON ticket_types
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ticket_types_write_admin" ON ticket_types
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

-- TICKET_ALLOCATIONS : tout utilisateur connecté peut tout faire
CREATE POLICY "allocations_all_authenticated" ON ticket_allocations
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- COLLECTIONS : tout utilisateur connecté peut tout faire
CREATE POLICY "collections_all_authenticated" ON collections
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- COLLECTION_ITEMS : tout utilisateur connecté peut tout faire
CREATE POLICY "collection_items_all_authenticated" ON collection_items
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- AUDIT_LOGS : tout utilisateur connecté peut lire et écrire
CREATE POLICY "audit_logs_all_authenticated" ON audit_logs
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- --------------------------------------------------------
-- VERIFICATION : Afficher les profils existants
-- --------------------------------------------------------
SELECT id, nom, email, role, created_at FROM profiles ORDER BY created_at;
