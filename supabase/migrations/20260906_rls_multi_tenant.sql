-- =========================================================================
-- MIGRATION: ISOLATION MULTI-TENANT PAR ORGANIZATION_ID
-- =========================================================================
-- PROBLÈME : Les policies RLS actuelles utilisent is_admin() qui vérifie
--            uniquement le rôle, pas l'appartenance à une organisation.
--            Un admin d'une org A peut voir les données de l'org B.
--
-- SOLUTION : Réécrire toutes les policies pour filtrer par organization_id.
--            Seul le super_admin platform voit toutes les organisations.
-- =========================================================================

-- ====================================
-- ÉTAPE 1 : SUPPRIMER TOUTES LES POLICIES EXISTANTES
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
-- ÉTAPE 3 : FONCTIONS HELPER (SECURITY DEFINER)
-- ====================================

-- get_user_organization_id(): retourne l'organization_id du profil courant
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  SET LOCAL row_security = 'off';
  SELECT organization_id INTO org_id FROM profiles WHERE id = auth.uid();
  RETURN org_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- is_admin(): vrai si l'utilisateur courant est administrateur
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  SET LOCAL row_security = 'off';
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrateur'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- is_collecteur(): vrai si l'utilisateur courant est collecteur
CREATE OR REPLACE FUNCTION public.is_collecteur()
RETURNS BOOLEAN AS $$
BEGIN
  SET LOCAL row_security = 'off';
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'collecteur'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- is_platform_super_admin(): vrai si super admin platform
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
-- Super admin voit tous les profils
CREATE POLICY "profiles_superadmin_all" ON profiles
  FOR ALL USING (is_platform_super_admin());

-- Admin voit les profils DE SON ORGANISATION uniquement
CREATE POLICY "profiles_admin_org" ON profiles
  FOR ALL USING (
    is_admin()
    AND organization_id IS NOT NULL
    AND organization_id = get_user_organization_id()
  );

-- Chaque utilisateur voit/modifie son propre profil
CREATE POLICY "profiles_self_select" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_self_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ====================================
-- ÉTAPE 5 : POLICIES — WIFI_SPACES
-- ====================================
-- Super admin : accès total
CREATE POLICY "wifi_spaces_superadmin_all" ON wifi_spaces
  FOR ALL USING (is_platform_super_admin());

-- Admin : uniquement les espaces de SON organisation
CREATE POLICY "wifi_spaces_admin_org" ON wifi_spaces
  FOR ALL USING (
    is_admin()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

-- Collecteur : lecture seule des espaces de son org
CREATE POLICY "wifi_spaces_collecteur_select" ON wifi_spaces
  FOR SELECT USING (
    is_collecteur()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

-- ====================================
-- ÉTAPE 6 : POLICIES — POINTS_OF_SALE (POS)
-- ====================================
-- Super admin : accès total
CREATE POLICY "pos_superadmin_all" ON points_of_sale
  FOR ALL USING (is_platform_super_admin());

-- Admin : uniquement les POS de SON organisation
CREATE POLICY "pos_admin_org" ON points_of_sale
  FOR ALL USING (
    is_admin()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

-- Collecteur : voit les POS qui lui sont assignés DANS son org
CREATE POLICY "pos_collecteur_select" ON points_of_sale
  FOR SELECT USING (
    collecteur_id = auth.uid()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

-- ====================================
-- ÉTAPE 7 : POLICIES — TICKET_TYPES
-- ====================================
-- Super admin : accès total
CREATE POLICY "ticket_types_superadmin_all" ON ticket_types
  FOR ALL USING (is_platform_super_admin());

-- Admin : uniquement les types de tickets de SON organisation
CREATE POLICY "ticket_types_admin_org" ON ticket_types
  FOR ALL USING (
    is_admin()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

-- Collecteur : lecture seule des ticket types de son org
CREATE POLICY "ticket_types_collecteur_select" ON ticket_types
  FOR SELECT USING (
    is_collecteur()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

-- ====================================
-- ÉTAPE 8 : POLICIES — TICKET_ALLOCATIONS
-- ====================================
-- Super admin : accès total
CREATE POLICY "allocations_superadmin_all" ON ticket_allocations
  FOR ALL USING (is_platform_super_admin());

-- Admin : uniquement les allocations de SON organisation
CREATE POLICY "allocations_admin_org" ON ticket_allocations
  FOR ALL USING (
    is_admin()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

-- Collecteur : voit les allocations de SES POS dans son org
CREATE POLICY "allocations_collecteur_select" ON ticket_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM points_of_sale
      WHERE points_of_sale.id = ticket_allocations.pos_id
        AND points_of_sale.collecteur_id = auth.uid()
        AND (points_of_sale.organization_id IS NULL OR points_of_sale.organization_id = get_user_organization_id())
    )
  );

-- ====================================
-- ÉTAPE 9 : POLICIES — COLLECTIONS
-- ====================================
-- Super admin : accès total
CREATE POLICY "collections_superadmin_all" ON collections
  FOR ALL USING (is_platform_super_admin());

-- Admin : uniquement les collectes de SON organisation
CREATE POLICY "collections_admin_org" ON collections
  FOR ALL USING (
    is_admin()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

-- Collecteur : accès total à ses propres collectes dans son org
CREATE POLICY "collections_collecteur_all" ON collections
  FOR ALL USING (
    collecteur_id = auth.uid()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

-- ====================================
-- ÉTAPE 10 : POLICIES — COLLECTION_ITEMS
-- ====================================
-- Super admin : accès total
CREATE POLICY "collection_items_superadmin_all" ON collection_items
  FOR ALL USING (is_platform_super_admin());

-- Admin : uniquement les items de SON organisation
CREATE POLICY "collection_items_admin_org" ON collection_items
  FOR ALL USING (
    is_admin()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

-- Collecteur : accès aux items de ses collectes dans son org
CREATE POLICY "collection_items_collecteur_all" ON collection_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
        AND collections.collecteur_id = auth.uid()
        AND (collections.organization_id IS NULL OR collections.organization_id = get_user_organization_id())
    )
  );

-- ====================================
-- ÉTAPE 11 : POLICIES — AUDIT_LOGS
-- ====================================
-- Super admin : accès total
CREATE POLICY "audit_logs_superadmin_all" ON audit_logs
  FOR ALL USING (is_platform_super_admin());

-- Admin : uniquement les logs de SON organisation
CREATE POLICY "audit_logs_admin_org" ON audit_logs
  FOR ALL USING (
    is_admin()
    AND (organization_id IS NULL OR organization_id = get_user_organization_id())
  );

-- ====================================
-- ÉTAPE 12 : S'ASSURER QUE PERFORM_TICKET_EXCHANGE RENSEIGNE ORGANIZATION_ID
-- ====================================
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
  v_org_id        UUID;
BEGIN
  -- 1. Valider le point de vente et récupérer organization_id et space_id
  SELECT organization_id, space_id INTO v_org_id, p_space_id
  FROM points_of_sale
  WHERE id = p_pos_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Point de vente introuvable');
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

    SELECT prix INTO v_ticket_price
    FROM ticket_types
    WHERE id = v_ticket_type_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Type de ticket introuvable pour le rendu: ' || v_ticket_type_id::text);
    END IF;

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
      (pos_id, ticket_type_id, quantite, type, exchange_group_id, notes, space_id, organization_id, alloue_par, date_allocation)
    VALUES
      (p_pos_id, v_ticket_type_id, v_quantite, 'exchange_return', v_exchange_group, p_notes, p_space_id, v_org_id, COALESCE(p_user_id, auth.uid()), CURRENT_DATE);
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
      (pos_id, ticket_type_id, quantite, type, exchange_group_id, notes, space_id, organization_id, alloue_par, date_allocation)
    VALUES
      (p_pos_id, v_ticket_type_id, v_quantite, 'exchange_receive', v_exchange_group, p_notes, p_space_id, v_org_id, COALESCE(p_user_id, auth.uid()), CURRENT_DATE);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Échange effectué avec succès',
    'exchange_group_id', v_exchange_group::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.perform_ticket_exchange TO authenticated, service_role;

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
