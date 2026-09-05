-- =========================================================================
-- SCRIPT DE CORRECTION DES ACCÈS RLS (RESTAURATION DE LA VISIBILITÉ)
-- =========================================================================
-- Ce script ne supprime aucune donnée, il s'assure juste que les anciens
-- droits "administrateur" et "collecteur" fonctionnent exactement comme avant.

-- 1. Sécuriser les fonctions de vérification des rôles (sans boucle)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  SET LOCAL row_security = 'off';
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrateur'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_collecteur()
RETURNS BOOLEAN AS $$
BEGIN
  SET LOCAL row_security = 'off';
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'collecteur'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Restaurer les anciennes politiques sur Ticket Allocations
DROP POLICY IF EXISTS "Allocations: super admin sees all" ON ticket_allocations;
DROP POLICY IF EXISTS "Allocations: manage by admin/super" ON ticket_allocations;
DROP POLICY IF EXISTS "Allocations: update by admin/super" ON ticket_allocations;
DROP POLICY IF EXISTS "Allocations: delete by admin/super" ON ticket_allocations;
DROP POLICY IF EXISTS "Admins gerent les allocations" ON ticket_allocations;
DROP POLICY IF EXISTS "Collecteurs voient leurs allocations" ON ticket_allocations;

CREATE POLICY "Admins et Super Admins gerent les allocations" ON ticket_allocations 
  FOR ALL USING (is_admin() OR is_platform_super_admin());

CREATE POLICY "Collecteurs voient leurs allocations" ON ticket_allocations 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM points_of_sale WHERE id = pos_id AND collecteur_id = auth.uid()) 
    OR is_admin() OR is_platform_super_admin()
  );

-- 3. Restaurer les politiques sur Collections
DROP POLICY IF EXISTS "Collections: super admin sees all" ON collections;
DROP POLICY IF EXISTS "Collections: manage by admin/super" ON collections;
DROP POLICY IF EXISTS "Admins gerent toutes les collectes" ON collections;
DROP POLICY IF EXISTS "Collecteurs gerent leurs collectes" ON collections;

CREATE POLICY "Admins gerent toutes les collectes" ON collections 
  FOR ALL USING (is_admin() OR is_platform_super_admin());

CREATE POLICY "Collecteurs gerent leurs collectes" ON collections 
  FOR ALL USING (collecteur_id = auth.uid() OR is_admin() OR is_platform_super_admin());

-- 4. Restaurer les politiques sur Collection Items
DROP POLICY IF EXISTS "CollectionItems: super admin and accessible via collection" ON collection_items;
DROP POLICY IF EXISTS "Acces items via collection" ON collection_items;

CREATE POLICY "Acces items via collection" ON collection_items 
  FOR ALL USING (
    EXISTS (
        SELECT 1 FROM collections
        WHERE collections.id = collection_items.collection_id
        AND (collections.collecteur_id = auth.uid() OR is_admin() OR is_platform_super_admin())
    )
  );

-- 5. Restaurer les politiques sur Points of Sale
DROP POLICY IF EXISTS "POS: super admin and org members see own org" ON points_of_sale;
DROP POLICY IF EXISTS "POS: super admin and org admin manage" ON points_of_sale;
DROP POLICY IF EXISTS "Admins gerent les POS" ON points_of_sale;
DROP POLICY IF EXISTS "Collecteurs lisent leurs POS" ON points_of_sale;

CREATE POLICY "Admins gerent les POS" ON points_of_sale 
  FOR ALL USING (is_admin() OR is_platform_super_admin());

CREATE POLICY "Collecteurs lisent leurs POS" ON points_of_sale 
  FOR SELECT USING (collecteur_id = auth.uid() OR is_admin() OR is_platform_super_admin());

-- 6. Restaurer les politiques sur Profiles
DROP POLICY IF EXISTS "Profiles: super admin sees all" ON profiles;
DROP POLICY IF EXISTS "Profiles: org members see each other" ON profiles;
DROP POLICY IF EXISTS "Profiles: users update own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles: users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Utilisateur voit son profil" ON profiles;
DROP POLICY IF EXISTS "Utilisateur modifie son profil" ON profiles;
DROP POLICY IF EXISTS "Utilisateur cree son profil" ON profiles;
DROP POLICY IF EXISTS "Admins gerent tous les profils" ON profiles;

CREATE POLICY "Utilisateur voit son profil" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Utilisateur modifie son profil" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Utilisateur cree son profil" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins gerent tous les profils" ON profiles FOR ALL USING (is_admin() OR is_platform_super_admin());
