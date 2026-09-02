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
  ADD COLUMN IF NOT EXISTS date_allocation DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS type VARCHAR(30) NOT NULL DEFAULT 'allocation' CHECK (type IN ('allocation', 'exchange_return', 'exchange_receive')),
  ADD COLUMN IF NOT EXISTS exchange_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_ticket_allocations_type ON ticket_allocations(type);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_exchange_group ON ticket_allocations(exchange_group_id);

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
-- 8. FONCTION POUR EFFECTUER UN ÉCHANGE DE TICKETS (perform_ticket_exchange)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.perform_ticket_exchange(
  p_pos_id        UUID,
  p_space_id      UUID   DEFAULT NULL,
  p_notes         TEXT   DEFAULT NULL,
  p_user_id       UUID   DEFAULT NULL,
  p_returns       JSONB  DEFAULT '[]'::jsonb,
  p_receives      JSONB  DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_exchange_group UUID := gen_random_uuid();
  v_item          JSONB;
  v_ticket_price  NUMERIC;
  v_return_value  NUMERIC := 0;
  v_receive_value NUMERIC := 0;
  v_ticket_type_id UUID;
  v_quantite      INT;
  v_allocated_qty INT;
  v_sold_qty      INT;
  v_available_qty INT;
BEGIN
  -- 1. Valider le point de vente
  IF NOT EXISTS (SELECT 1 FROM points_of_sale WHERE id = p_pos_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Point de vente introuvable');
  END IF;

  -- Déduire le space_id du POS si non spécifié
  IF p_space_id IS NULL THEN
    SELECT space_id INTO p_space_id FROM points_of_sale WHERE id = p_pos_id;
  END IF;

  -- 2. Valider qu'il y a des tickets à rendre et à recevoir
  IF jsonb_array_length(p_returns) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Aucun ticket à rendre spécifié');
  END IF;

  IF jsonb_array_length(p_receives) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Aucun ticket à recevoir spécifié');
  END IF;

  -- 3. Valider chaque ticket à rendre et calculer la valeur totale
  FOR v_item IN SELECT jsonb_array_elements(p_returns)
  LOOP
    v_ticket_type_id := COALESCE(
      NULLIF(v_item->>'ticket_type_id', ''),
      NULLIF(v_item->>'ticketTypeId', '')
    )::UUID;

    v_quantite := COALESCE((v_item->>'quantite')::INT, (v_item->>'quantity')::INT, 0);

    IF v_ticket_type_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Identifiant de ticket manquant dans la liste des rendus');
    END IF;

    IF v_quantite <= 0 THEN
      RETURN jsonb_build_object('success', false, 'message', 'La quantité à rendre doit être supérieure à 0');
    END IF;

    -- Récupérer le prix du ticket
    SELECT prix INTO v_ticket_price
    FROM ticket_types
    WHERE id = v_ticket_type_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Type de ticket introuvable pour le rendu: ' || v_ticket_type_id::text);
    END IF;

    -- Vérifier le stock disponible au POS (quantités allouées - déjà rendues - vendues)
    SELECT COALESCE(SUM(
      CASE
        WHEN ta.type = 'exchange_return' THEN -ta.quantite
        ELSE ta.quantite
      END
    ), 0) INTO v_allocated_qty
    FROM ticket_allocations ta
    WHERE ta.pos_id = p_pos_id
      AND ta.ticket_type_id = v_ticket_type_id;

    SELECT COALESCE(SUM(ci.quantite_vendue), 0) INTO v_sold_qty
    FROM collection_items ci
    JOIN collections c ON ci.collection_id = c.id
    WHERE c.pos_id = p_pos_id
      AND ci.ticket_type_id = v_ticket_type_id;

    v_available_qty := v_allocated_qty - v_sold_qty;

    IF v_available_qty < v_quantite THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('Stock insuffisant pour le ticket (Disponible: %s, Demandé: %s)', v_available_qty, v_quantite)
      );
    END IF;

    v_return_value := v_return_value + (v_quantite * v_ticket_price);
  END LOOP;

  -- 4. Valider chaque ticket à recevoir et calculer la valeur totale
  FOR v_item IN SELECT jsonb_array_elements(p_receives)
  LOOP
    v_ticket_type_id := COALESCE(
      NULLIF(v_item->>'ticket_type_id', ''),
      NULLIF(v_item->>'ticketTypeId', '')
    )::UUID;

    v_quantite := COALESCE((v_item->>'quantite')::INT, (v_item->>'quantity')::INT, 0);

    IF v_ticket_type_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Identifiant de ticket manquant dans la liste des réceptions');
    END IF;

    IF v_quantite <= 0 THEN
      RETURN jsonb_build_object('success', false, 'message', 'La quantité à recevoir doit être supérieure à 0');
    END IF;

    SELECT prix INTO v_ticket_price
    FROM ticket_types
    WHERE id = v_ticket_type_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Type de ticket introuvable pour la réception: ' || v_ticket_type_id::text);
    END IF;

    v_receive_value := v_receive_value + (v_quantite * v_ticket_price);
  END LOOP;

  -- 5. Vérifier l'équivalence de valeur
  IF v_return_value != v_receive_value THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Valeur non équivalente: tickets rendus = %s FCFA, tickets reçus = %s FCFA (écart: %s FCFA)',
                        v_return_value, v_receive_value, abs(v_return_value - v_receive_value))
    );
  END IF;

  -- 6. Insérer les enregistrements de retour (exchange_return)
  FOR v_item IN SELECT jsonb_array_elements(p_returns)
  LOOP
    v_ticket_type_id := COALESCE(
      NULLIF(v_item->>'ticket_type_id', ''),
      NULLIF(v_item->>'ticketTypeId', '')
    )::UUID;
    v_quantite := COALESCE((v_item->>'quantite')::INT, (v_item->>'quantity')::INT, 0);

    INSERT INTO ticket_allocations
      (pos_id, ticket_type_id, quantite, type, exchange_group_id, notes, space_id, alloue_par, date_allocation)
    VALUES
      (p_pos_id, v_ticket_type_id, v_quantite, 'exchange_return', v_exchange_group, p_notes, p_space_id, COALESCE(p_user_id, auth.uid()), CURRENT_DATE);
  END LOOP;

  -- 7. Insérer les enregistrements de réception (exchange_receive)
  FOR v_item IN SELECT jsonb_array_elements(p_receives)
  LOOP
    v_ticket_type_id := COALESCE(
      NULLIF(v_item->>'ticket_type_id', ''),
      NULLIF(v_item->>'ticketTypeId', '')
    )::UUID;
    v_quantite := COALESCE((v_item->>'quantite')::INT, (v_item->>'quantity')::INT, 0);

    INSERT INTO ticket_allocations
      (pos_id, ticket_type_id, quantite, type, exchange_group_id, notes, space_id, alloue_par, date_allocation)
    VALUES
      (p_pos_id, v_ticket_type_id, v_quantite, 'exchange_receive', v_exchange_group, p_notes, p_space_id, COALESCE(p_user_id, auth.uid()), CURRENT_DATE);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Échange effectué avec succès',
    'exchange_group_id', v_exchange_group::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.perform_ticket_exchange TO authenticated, service_role;

-- ------------------------------------------------------------
-- 9. VÉRIFICATION DU RÉSULTAT
-- ------------------------------------------------------------
SELECT 'Policies restantes sur profiles:' AS check_info;
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public';

SELECT 'Profils existants:' AS profiles_info;
SELECT id, nom, email, role, devise FROM public.profiles ORDER BY created_at;
