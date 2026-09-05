-- =========================================================================
-- SCRIPT RLS DÉFINITIF — NETTOYAGE TOTAL + POLICIES SIMPLES
-- =========================================================================
-- Ce script :
-- 1. Supprime DYNAMIQUEMENT toutes les policies existantes (pas de noms hardcodés)
-- 2. Recrée des policies simples et fonctionnelles
-- 3. NE TOUCHE PAS aux données — uniquement les droits d'accès
--
-- Hiérarchie :
--   super_admin → voit TOUT
--   administrateur → voit tout ce qu'il administre (ses POS, allocations, collectes, etc.)
--   collecteur → voit uniquement ce qui lui est assigné
-- =========================================================================

-- ====================================
-- ÉTAPE 1 : SUPPRIMER TOUTES LES POLICIES EXISTANTES (dynamique)
-- ====================================
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Supprimer toutes les policies sur les tables métier
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
    RAISE NOTICE 'Dropped policy: % on %', r.policyname, r.tablename;
  END LOOP;
END $$;

-- ====================================
-- ÉTAPE 2 : S'ASSURER QUE RLS EST ACTIVÉ
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
-- ÉTAPE 3 : RECRÉER LES FONCTIONS HELPER (SECURITY DEFINER)
-- ====================================
-- is_admin() : vrai si l'utilisateur courant est administrateur
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  SET LOCAL row_security = 'off';
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrateur'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- is_collecteur() : vrai si l'utilisateur courant est collecteur
CREATE OR REPLACE FUNCTION public.is_collecteur()
RETURNS BOOLEAN AS $$
BEGIN
  SET LOCAL row_security = 'off';
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'collecteur'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- is_platform_super_admin() : vrai si super admin platform
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  SET LOCAL row_security = 'off';
  RETURN EXISTS (
    SELECT 1 FROM platform_users
    WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND role IN ('super_admin', 'platform_support')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ====================================
-- ÉTAPE 4 : POLICIES — PROFILES
-- ====================================
-- L'admin et le super admin voient tous les profils
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- Chaque utilisateur voit son propre profil
CREATE POLICY "profiles_self_select" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Chaque utilisateur peut modifier son profil
CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Chaque utilisateur peut créer son profil
CREATE POLICY "profiles_self_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ====================================
-- ÉTAPE 5 : POLICIES — WIFI_SPACES
-- ====================================
-- Admin et super admin : accès total
CREATE POLICY "wifi_spaces_admin_all" ON wifi_spaces
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- Tout utilisateur authentifié peut lire les espaces wifi
CREATE POLICY "wifi_spaces_authenticated_select" ON wifi_spaces
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ====================================
-- ÉTAPE 6 : POLICIES — POINTS_OF_SALE (POS)
-- ====================================
-- Admin et super admin : accès total (CRUD)
CREATE POLICY "pos_admin_all" ON points_of_sale
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- Collecteur : voit les POS qui lui sont assignés
CREATE POLICY "pos_collecteur_select" ON points_of_sale
  FOR SELECT USING (collecteur_id = auth.uid());

-- ====================================
-- ÉTAPE 7 : POLICIES — TICKET_TYPES
-- ====================================
-- Admin et super admin : accès total
CREATE POLICY "ticket_types_admin_all" ON ticket_types
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- Tout utilisateur authentifié peut voir les types de tickets
CREATE POLICY "ticket_types_authenticated_select" ON ticket_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ====================================
-- ÉTAPE 8 : POLICIES — TICKET_ALLOCATIONS
-- ====================================
-- Admin et super admin : accès total (créer, voir, modifier, supprimer)
CREATE POLICY "allocations_admin_all" ON ticket_allocations
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- Collecteur : voit les allocations de SES points de vente
CREATE POLICY "allocations_collecteur_select" ON ticket_allocations
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
-- Admin et super admin : accès total
CREATE POLICY "collections_admin_all" ON collections
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- Collecteur : accès total à ses propres collectes
CREATE POLICY "collections_collecteur_all" ON collections
  FOR ALL USING (collecteur_id = auth.uid());

-- ====================================
-- ÉTAPE 10 : POLICIES — COLLECTION_ITEMS
-- ====================================
-- Admin et super admin : accès total
CREATE POLICY "collection_items_admin_all" ON collection_items
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- Collecteur : accès aux items de ses propres collectes
CREATE POLICY "collection_items_collecteur_all" ON collection_items
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
-- Admin et super admin : accès total
CREATE POLICY "audit_logs_admin_all" ON audit_logs
  FOR ALL USING (is_admin() OR is_platform_super_admin());

-- ====================================
-- VÉRIFICATION : affiche les policies actives
-- ====================================
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'wifi_spaces', 'points_of_sale', 'ticket_types',
    'ticket_allocations', 'collections', 'collection_items', 'audit_logs'
  )
ORDER BY tablename, policyname;
