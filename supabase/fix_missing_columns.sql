-- ============================================================
-- OPTIWIFI - CORRECTIF DÉFINITIF RLS & COLONNES MANQUANTES
-- ============================================================
-- Ce script élimine DÉFINITIVEMENT l'erreur 42P17 :
-- "infinite recursion detected in policy for relation profiles"
--
-- POURQUOI CETTE ERREUR ARRIVE :
-- PostgreSQL détecte une récursion quand une policy sur "profiles"
-- appelle une fonction ou sous-requête qui interroge "profiles".
-- Même si une policy a été corrigée, des anciennes policies avec
-- d'autres noms restent actives dans la base Supabase.
--
-- SOLUTION RADICALE ET PROFESSIONNELLE :
-- 1. On purge DYNAMIQUEMENT 100% des policies existantes sur toutes les tables.
-- 2. La fonction is_admin() lit d'abord le JWT (en mémoire) et auth.users (hors RLS).
-- 3. La table profiles n'a AUCUNE policy qui appelle is_admin() ou profiles.
-- 4. Synchronisation des métadonnées auth.users pour le JWT.
--
-- Exécutez ce script dans : Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. Fonction helper set_updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 2. Fonction helper is_admin() — 100% SANS RÉCURSION
--    Priorité 1: auth.jwt() (mémoire, 0 requête, 0 récursion)
--    Priorité 2: auth.users (table système auth, 0 RLS sur profiles)
--    Priorité 3: public.profiles (sécurisé car profiles n'appelle plus is_admin)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- 1. Vérification directe dans le JWT (instantané en mémoire)
  IF (auth.jwt() -> 'user_metadata' ->> 'role') = 'administrateur'
     OR (auth.jwt() -> 'user_metadata' ->> 'force_admin') = 'true'
     OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'administrateur' THEN
    RETURN TRUE;
  END IF;

  -- 2. Vérification dans auth.users (schéma auth, aucune RLS)
  SELECT (raw_user_meta_data->>'role' = 'administrateur' OR raw_user_meta_data->>'force_admin' = 'true')
  INTO v_is_admin
  FROM auth.users
  WHERE id = auth.uid();

  IF v_is_admin IS TRUE THEN
    RETURN TRUE;
  END IF;

  -- 3. Vérification directe dans public.profiles en repli
  SELECT (role = 'administrateur')
  INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN COALESCE(v_is_admin, FALSE);
END;
$$;

-- ------------------------------------------------------------
-- 3. Ajout des colonnes manquantes (idempotent)
-- ------------------------------------------------------------
ALTER TABLE points_of_sale
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE ticket_allocations
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_allocation DATE DEFAULT CURRENT_DATE;

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_collecte DATE,
  ADD COLUMN IF NOT EXISTS commission DECIMAL(12, 2) DEFAULT 0;

ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS devise VARCHAR(10) DEFAULT 'XOF';

-- ------------------------------------------------------------
-- 4. Triggers updated_at
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_points_of_sale_updated_at ON points_of_sale;
CREATE TRIGGER trg_points_of_sale_updated_at
  BEFORE UPDATE ON points_of_sale
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ticket_types_updated_at ON ticket_types;
CREATE TRIGGER trg_ticket_types_updated_at
  BEFORE UPDATE ON ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_wifi_spaces_updated_at ON wifi_spaces;
CREATE TRIGGER trg_wifi_spaces_updated_at
  BEFORE UPDATE ON wifi_spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 5. PURGE TOTALE ET DYNAMIQUE DE TOUTES LES POLICIES EXISTANTES
--    Élimine TOUTES les policies orphelines, cachées ou anciennes
--    qui causent l'erreur de récursion infinie 42P17.
-- ------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    t TEXT;
    target_tables TEXT[] := ARRAY[
      'profiles',
      'points_of_sale',
      'ticket_types',
      'ticket_allocations',
      'collections',
      'collection_items',
      'audit_logs',
      'wifi_spaces'
    ];
BEGIN
    FOREACH t IN ARRAY target_tables LOOP
        FOR r IN (
          SELECT policyname
          FROM pg_policies
          WHERE tablename = t AND schemaname = 'public'
        ) LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
        END LOOP;
    END LOOP;
END $$;

-- Activer RLS sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_of_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_spaces ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 6. NOUVELLES POLITIQUES RLS PROPRES ET NON-RÉCURSIVES
-- ------------------------------------------------------------

-- A. PROFILES (AUCUN appel à is_admin(), AUCUNE sous-requête sur profiles)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_allow" ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- B. POINTS DE VENTE (points_of_sale)
CREATE POLICY "pos_select_all" ON public.points_of_sale
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "pos_insert_admin" ON public.points_of_sale
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "pos_update_admin" ON public.points_of_sale
  FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "pos_delete_admin" ON public.points_of_sale
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- C. TYPES DE TICKETS (ticket_types)
CREATE POLICY "ticket_types_select_all" ON public.ticket_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ticket_types_all_admin" ON public.ticket_types
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- D. ALLOCATIONS DE TICKETS (ticket_allocations)
CREATE POLICY "allocations_select" ON public.ticket_allocations
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.points_of_sale
      WHERE id = ticket_allocations.pos_id AND collecteur_id = auth.uid()
    )
  );

CREATE POLICY "allocations_all_admin" ON public.ticket_allocations
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- E. COLLECTES (collections)
CREATE POLICY "collections_select" ON public.collections
  FOR SELECT
  TO authenticated
  USING (collecteur_id = auth.uid() OR is_admin());

CREATE POLICY "collections_all_admin" ON public.collections
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "collections_insert_collector" ON public.collections
  FOR INSERT
  TO authenticated
  WITH CHECK (collecteur_id = auth.uid());

CREATE POLICY "collections_update_collector" ON public.collections
  FOR UPDATE
  TO authenticated
  USING (collecteur_id = auth.uid());

-- F. ITEMS DE COLLECTE (collection_items)
CREATE POLICY "collection_items_all" ON public.collection_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_items.collection_id
      AND (c.collecteur_id = auth.uid() OR is_admin())
    )
  );

-- G. ESPACES WIFI (wifi_spaces)
CREATE POLICY "wifi_spaces_select_all" ON public.wifi_spaces
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "wifi_spaces_all_admin" ON public.wifi_spaces
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- H. AUDIT LOGS (audit_logs)
CREATE POLICY "audit_logs_all_admin" ON public.audit_logs
  FOR ALL
  TO authenticated
  USING (is_admin());

-- ------------------------------------------------------------
-- 7. SYNCHRONISATION DES ROLES DANS auth.users
--    Garantit que le JWT contient le rôle administrateur
-- ------------------------------------------------------------
UPDATE auth.users au
SET raw_user_meta_data = jsonb_set(
  jsonb_set(
    COALESCE(au.raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(p.role::text),
    true
  ),
  '{force_admin}',
  to_jsonb(CASE WHEN p.role = 'administrateur' THEN 'true' ELSE 'false' END),
  true
)
FROM public.profiles p
WHERE p.id = au.id;

-- ------------------------------------------------------------
-- 8. VÉRIFICATION DU RÉSULTAT
-- ------------------------------------------------------------
SELECT 'Policies restantes sur profiles:' AS check_info;
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public';

SELECT 'Profils existants:' AS profiles_info;
SELECT id, nom, email, role, devise FROM public.profiles ORDER BY created_at;
