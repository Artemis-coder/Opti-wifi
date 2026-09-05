-- =========================================================================
-- SCRIPT RLS V2 — CORRECTION DÉFINITIVE DES ACCÈS
-- =========================================================================
-- PROBLÈME IDENTIFIÉ : les fonctions is_admin() avec SET LOCAL row_security 
-- et STABLE causent des conflits dans l'environnement Supabase PostgREST.
--
-- SOLUTION : 
-- 1. Fonctions en LANGUAGE SQL pur (pas de SET LOCAL, pas de PL/pgSQL)
-- 2. SECURITY DEFINER suffit pour bypasser RLS (pas besoin de SET LOCAL)
-- 3. Suppression dynamique de TOUTES les policies existantes
-- 4. Policies ultra-simples sans référence circulaire
-- =========================================================================

-- ====================================
-- ÉTAPE 1 : SUPPRIMER TOUTES LES POLICIES (dynamique, rien ne reste)
-- ====================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles',
        'wifi_spaces',
        'points_of_sale',
        'ticket_types',
        'ticket_allocations',
        'collections',
        'collection_items',
        'audit_logs'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ====================================
-- ÉTAPE 2 : RECRÉER LES FONCTIONS EN SQL PUR
-- ====================================
-- IMPORTANT: LANGUAGE SQL + SECURITY DEFINER + SET search_path
-- Pas de SET LOCAL, pas de PL/pgSQL, pas de STABLE conflict

-- is_admin() : vrai si l'utilisateur courant a le rôle administrateur
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrateur'
  );
$$;

-- is_collecteur() : vrai si l'utilisateur courant est collecteur
CREATE OR REPLACE FUNCTION public.is_collecteur()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'collecteur'
  );
$$;

-- is_platform_super_admin() : vrai si super admin de la plateforme
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_users
    WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND role IN ('super_admin', 'platform_support')
  );
$$;

-- get_user_organization_id() : retourne l'org_id du profil courant
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

-- ====================================
-- ÉTAPE 3 : ACTIVER RLS SUR TOUTES LES TABLES
-- ====================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wifi_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_of_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ====================================
-- ÉTAPE 4 : POLICIES — PROFILES
-- ====================================
-- Tout utilisateur voit son propre profil
CREATE POLICY "profiles_own_select" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Tout utilisateur modifie son propre profil
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Tout utilisateur crée son propre profil
CREATE POLICY "profiles_own_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin voit TOUS les profils (pour gérer les collecteurs)
CREATE POLICY "profiles_admin_select" ON profiles
  FOR SELECT USING (is_admin());

-- Admin gère tous les profils
CREATE POLICY "profiles_admin_manage" ON profiles
  FOR ALL USING (is_admin());

-- Super admin gère tous les profils
CREATE POLICY "profiles_superadmin_manage" ON profiles
  FOR ALL USING (is_platform_super_admin());

-- ====================================
-- ÉTAPE 5 : POLICIES — WIFI_SPACES
-- ====================================
CREATE POLICY "spaces_admin_manage" ON wifi_spaces
  FOR ALL USING (is_admin() OR is_platform_super_admin());

CREATE POLICY "spaces_read_all" ON wifi_spaces
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ====================================
-- ÉTAPE 6 : POLICIES — POINTS_OF_SALE
-- ====================================
-- Admin : accès total CRUD sur tous les POS
CREATE POLICY "pos_admin_manage" ON points_of_sale
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- Collecteur : lecture des POS qui lui sont assignés
CREATE POLICY "pos_collecteur_read" ON points_of_sale
  FOR SELECT USING (collecteur_id = auth.uid());

-- ====================================
-- ÉTAPE 7 : POLICIES — TICKET_TYPES
-- ====================================
CREATE POLICY "tickets_admin_manage" ON ticket_types
  FOR ALL USING (is_admin() OR is_platform_super_admin());

CREATE POLICY "tickets_read_all" ON ticket_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ====================================
-- ÉTAPE 8 : POLICIES — TICKET_ALLOCATIONS
-- ====================================
-- Admin : accès total (voir, créer, modifier, supprimer les allocations)
CREATE POLICY "alloc_admin_manage" ON ticket_allocations
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- Collecteur : lecture des allocations de ses POS
CREATE POLICY "alloc_collecteur_read" ON ticket_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM points_of_sale
      WHERE points_of_sale.id = ticket_allocations.pos_id
        AND points_of_sale.collecteur_id = auth.uid()
    )
  );

-- ====================================
-- ÉTAPE 9 : POLICIES — COLLECTIONS
-- ====================================
-- Admin : accès total
CREATE POLICY "coll_admin_manage" ON collections
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- Collecteur : accès total à SES propres collectes
CREATE POLICY "coll_collecteur_own" ON collections
  FOR ALL USING (collecteur_id = auth.uid());

-- ====================================
-- ÉTAPE 10 : POLICIES — COLLECTION_ITEMS
-- ====================================
-- Admin : accès total
CREATE POLICY "items_admin_manage" ON collection_items
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- Collecteur : accès aux items de ses collectes
CREATE POLICY "items_collecteur_own" ON collection_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
        AND collections.collecteur_id = auth.uid()
    )
  );

-- ====================================
-- ÉTAPE 11 : POLICIES — AUDIT_LOGS
-- ====================================
CREATE POLICY "audit_admin_manage" ON audit_logs
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- ====================================
-- VÉRIFICATION FINALE
-- ====================================
-- 1. Afficher toutes les policies actives
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'wifi_spaces', 'points_of_sale', 'ticket_types',
    'ticket_allocations', 'collections', 'collection_items', 'audit_logs'
  )
ORDER BY tablename, policyname;

-- 2. Vérifier que les données existent toujours
SELECT 'points_of_sale' AS table_name, COUNT(*) AS row_count FROM points_of_sale
UNION ALL SELECT 'ticket_allocations', COUNT(*) FROM ticket_allocations
UNION ALL SELECT 'collections', COUNT(*) FROM collections
UNION ALL SELECT 'collection_items', COUNT(*) FROM collection_items
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'wifi_spaces', COUNT(*) FROM wifi_spaces
UNION ALL SELECT 'ticket_types', COUNT(*) FROM ticket_types;
