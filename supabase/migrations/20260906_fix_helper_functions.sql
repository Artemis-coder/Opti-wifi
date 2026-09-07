-- =========================================================================
-- CORRECTION DES FONCTIONS HELPER POUR RLS
-- =========================================================================
-- Les fonctions PL/pgSQL avec "SET LOCAL row_security = 'off'" peuvent 
-- provoquer des erreurs silencieuses. Nous les remplaçons par des fonctions 
-- SQL simples et robustes, qui s'appuient sur les policies existantes
-- (ex: profiles_self_select qui permet de lire son propre profil).

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrateur'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_collecteur()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'collecteur'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_users
    WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND role IN ('super_admin', 'platform_support')
  );
$$ LANGUAGE sql STABLE;

-- On s'assure que les policies self_select existent bien
DROP POLICY IF EXISTS "profiles_self_select" ON profiles;
CREATE POLICY "profiles_self_select" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Accorder l'accès aux fonctions
GRANT EXECUTE ON FUNCTION public.get_user_organization_id TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_collecteur TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin TO authenticated, service_role;
