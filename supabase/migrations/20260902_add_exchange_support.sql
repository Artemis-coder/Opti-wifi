-- ============================================================
-- OPTIWIFI - Support des Échanges de Tickets (Ticket Exchange)
-- Permet de rendre des tickets existants et d'en recevoir
-- d'autres à valeur équivalente au même point de vente.
-- ============================================================

-- ETAPE 1 : Ajout des colonnes sur ticket_allocations
ALTER TABLE ticket_allocations
  ADD COLUMN IF NOT EXISTS type VARCHAR(30)
    NOT NULL DEFAULT 'allocation'
    CHECK (type IN ('allocation', 'exchange_return', 'exchange_receive'));

ALTER TABLE ticket_allocations
  ADD COLUMN IF NOT EXISTS exchange_group_id UUID;

-- ETAPE 2 : Index pour les performances
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_type ON ticket_allocations(type);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_exchange_group ON ticket_allocations(exchange_group_id);

-- ETAPE 3 : Fonction pour effectuer un échange atomique
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
