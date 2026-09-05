-- =========================================================================
-- SCRIPT DE SÉCURITÉ FINAL MULTI-TENANT (SANS PERTE DE VISIBILITÉ)
-- =========================================================================
-- Ce script réactive la sécurité (RLS) mais ajoute une tolérance : 
-- si l'ID d'organisation n'a pas été bien renseigné lors de la migration, 
-- l'administrateur garde quand même l'accès. Cela garantit une transition en douceur.

-- 1. On réactive RLS (au cas où il a été désactivé)
ALTER TABLE ticket_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_of_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- 2. Nettoyage de toutes les anciennes politiques
DROP POLICY IF EXISTS "Admins et Super Admins gerent les allocations" ON ticket_allocations;
DROP POLICY IF EXISTS "Collecteurs voient leurs allocations" ON ticket_allocations;
DROP POLICY IF EXISTS "Select allocations" ON ticket_allocations;
DROP POLICY IF EXISTS "Manage allocations" ON ticket_allocations;

DROP POLICY IF EXISTS "Admins gerent les POS" ON points_of_sale;
DROP POLICY IF EXISTS "Collecteurs lisent leurs POS" ON points_of_sale;
DROP POLICY IF EXISTS "Select POS" ON points_of_sale;
DROP POLICY IF EXISTS "Manage POS" ON points_of_sale;

DROP POLICY IF EXISTS "Admins gerent toutes les collectes" ON collections;
DROP POLICY IF EXISTS "Collecteurs gerent leurs collectes" ON collections;
DROP POLICY IF EXISTS "Select Collections" ON collections;
DROP POLICY IF EXISTS "Manage Collections" ON collections;

DROP POLICY IF EXISTS "Acces items via collection" ON collection_items;
DROP POLICY IF EXISTS "Select Collection Items" ON collection_items;
DROP POLICY IF EXISTS "Manage Collection Items" ON collection_items;


-- ==========================================
-- POLITIQUES : POINTS OF SALE (POS)
-- ==========================================
CREATE POLICY "Select POS" ON points_of_sale FOR SELECT USING (
  is_platform_super_admin() 
  OR (is_admin() AND (organization_id = get_user_organization_id() OR organization_id IS NULL OR get_user_organization_id() IS NULL))
  OR collecteur_id = auth.uid()
);

CREATE POLICY "Manage POS" ON points_of_sale FOR ALL USING (
  is_platform_super_admin() 
  OR (is_admin() AND (organization_id = get_user_organization_id() OR organization_id IS NULL OR get_user_organization_id() IS NULL))
);

-- ==========================================
-- POLITIQUES : TICKET ALLOCATIONS
-- ==========================================
CREATE POLICY "Select allocations" ON ticket_allocations FOR SELECT USING (
  is_platform_super_admin() 
  OR (is_admin() AND (organization_id = get_user_organization_id() OR organization_id IS NULL OR get_user_organization_id() IS NULL))
  OR EXISTS (SELECT 1 FROM points_of_sale WHERE id = ticket_allocations.pos_id AND collecteur_id = auth.uid())
);

CREATE POLICY "Manage allocations" ON ticket_allocations FOR ALL USING (
  is_platform_super_admin() 
  OR (is_admin() AND (organization_id = get_user_organization_id() OR organization_id IS NULL OR get_user_organization_id() IS NULL))
);

-- ==========================================
-- POLITIQUES : COLLECTIONS
-- ==========================================
CREATE POLICY "Select Collections" ON collections FOR SELECT USING (
  is_platform_super_admin() 
  OR (is_admin() AND (organization_id = get_user_organization_id() OR organization_id IS NULL OR get_user_organization_id() IS NULL))
  OR collecteur_id = auth.uid()
);

CREATE POLICY "Manage Collections" ON collections FOR ALL USING (
  is_platform_super_admin() 
  OR (is_admin() AND (organization_id = get_user_organization_id() OR organization_id IS NULL OR get_user_organization_id() IS NULL))
  OR collecteur_id = auth.uid() -- le collecteur doit pouvoir insérer/mettre à jour ses propres collectes
);

-- ==========================================
-- POLITIQUES : COLLECTION ITEMS
-- ==========================================
CREATE POLICY "Select Collection Items" ON collection_items FOR SELECT USING (
  is_platform_super_admin() 
  OR (is_admin() AND (organization_id = get_user_organization_id() OR organization_id IS NULL OR get_user_organization_id() IS NULL))
  OR EXISTS (SELECT 1 FROM collections WHERE id = collection_items.collection_id AND collecteur_id = auth.uid())
);

CREATE POLICY "Manage Collection Items" ON collection_items FOR ALL USING (
  is_platform_super_admin() 
  OR (is_admin() AND (organization_id = get_user_organization_id() OR organization_id IS NULL OR get_user_organization_id() IS NULL))
  OR EXISTS (SELECT 1 FROM collections WHERE id = collection_items.collection_id AND collecteur_id = auth.uid())
);
