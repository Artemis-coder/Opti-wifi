-- ============================================================
-- OPTIWIFI - SUPPORT DES ÉCHANGES DE TICKETS
-- ============================================================
-- Script de déploiement pour ajouter le support des échanges de
-- tickets (rendre des tickets existants et en recevoir d'autres
-- à valeur équivalente au même point de vente).
--
-- À exécuter dans Supabase SQL Editor APRÈS init.sql
-- ============================================================

-- --------------------------------------------------------
-- AJOUT DES COLONNES SUR ticket_allocations
-- --------------------------------------------------------
-- type: 'allocation' (normal), 'exchange_return' (tickets rendus),
--       'exchange_receive' (tickets reçus en échange)
-- exchange_group_id: UUID regroupant les enregistrements
--                    appartenant au même échange
ALTER TABLE ticket_allocations
  ADD COLUMN IF NOT EXISTS type VARCHAR(30)
    NOT NULL DEFAULT 'allocation'
    CHECK (type IN ('allocation', 'exchange_return', 'exchange_receive'));

ALTER TABLE ticket_allocations
  ADD COLUMN IF NOT EXISTS exchange_group_id UUID;

-- --------------------------------------------------------
-- INDEX POUR LES PERFORMANCES
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_type ON ticket_allocations(type);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_exchange_group ON ticket_allocations(exchange_group_id);

-- --------------------------------------------------------
-- FONCTION POUR EFFECTUER UN ÉCHANGE ATOMIQUE
-- --------------------------------------------------------
-- Cette fonction insère les enregistrements de retour et de réception
-- dans une même transaction. Si la valeur totale rendue ne correspond
-- pas à la valeur totale reçue, la transaction est annulée.
CREATE OR REPLACE FUNCTION public.perform_ticket_exchange(
  p_pos_id        UUID,
  p_space_id      UUID   DEFAULT NULL,
  p_notes         TEXT   DEFAULT NULL,
  p_user_id       UUID   DEFAULT NULL,
  p_returns       JSONB  DEFAULT '[]'::jsonb,
  p_receives      JSONB  DEFAULT '[]'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_exchange_group UUID := gen_random_uuid();
  v_result        JSONB := jsonb_build_object(
                          'success', true,
                          'message', 'Échange effectué avec succès',
                          'exchange_group_id', v_exchange_group::text
                        );
  v_item          JSONB;
  v_ticket_price  NUMERIC;
  v_return_value  NUMERIC := 0;
  v_receive_value NUMERIC := 0;
  v_ticket_type_id UUID;
  v_quantite      INT;
  v_allocated_qty INT;
  v_sold_qty      INT;
BEGIN
  -- Valider que le point de vente existe
  IF NOT EXISTS (SELECT 1 FROM points_of_sale WHERE id = p_pos_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Point de vente introuvable');
  END IF;

  -- Valider qu'il y a au moins un ticket à rendre
  IF jsonb_array_length(p_returns) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Aucun ticket à rendre spécifié');
  END IF;

  -- Valider qu'il y a au moins un ticket à recevoir
  IF jsonb_array_length(p_receives) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Aucun ticket à recevoir spécifié');
  END IF;

  -- Traiter les rendus (exchange_return)
  FOR v_item IN SELECT jsonb_array_elements(p_returns)
  LOOP
    v_ticket_type_id := (v_item->>'ticket_type_id')::UUID;
    v_quantite := (v_item->>'quantite')::INT;

    -- Vérifier que le type de ticket existe et est actif
    SELECT prix INTO v_ticket_price
    FROM ticket_types
    WHERE id = v_ticket_type_id AND actif = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Type de ticket introuvable ou inactif pour le rendu: ' || v_ticket_type_id::text
      );
    END IF;

    IF v_quantite <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'La quantité à rendre doit être supérieure à 0'
      );
    END IF;

    -- Vérifier le stock disponible au POS
    SELECT COALESCE(SUM(CASE WHEN ta.type = 'exchange_return' THEN -ta.quantite
                             ELSE ta.quantite END), 0) INTO v_allocated_qty
    FROM ticket_allocations ta
    WHERE ta.pos_id = p_pos_id
      AND ta.ticket_type_id = v_ticket_type_id
      AND (ta.space_id IS NULL OR ta.space_id = p_space_id);

    SELECT COALESCE(SUM(ci.quantite_vendue), 0) INTO v_sold_qty
    FROM collection_items ci
    JOIN collections c ON ci.collection_id = c.id
    WHERE c.pos_id = p_pos_id
      AND ci.ticket_type_id = v_ticket_type_id
      AND (c.space_id IS NULL OR c.space_id = p_space_id);

    IF (v_allocated_qty - v_sold_qty) < v_quantite THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Stock insuffisant pour le ticket: ' || v_ticket_type_id::text ||
                   '. Disponible: ' || (v_allocated_qty - v_sold_qty) || ', demandé: ' || v_quantite
      );
    END IF;

    v_return_value := v_return_value + (v_quantite * v_ticket_price);

    INSERT INTO ticket_allocations
      (pos_id, ticket_type_id, quantite, type, exchange_group_id, notes, space_id, alloue_par, date_allocation)
    VALUES
      (p_pos_id, v_ticket_type_id, v_quantite, 'exchange_return', v_exchange_group, p_notes, p_space_id, p_user_id, CURRENT_DATE);
  END LOOP;

  -- Traiter les réceptions (exchange_receive)
  FOR v_item IN SELECT jsonb_array_elements(p_receives)
  LOOP
    v_ticket_type_id := (v_item->>'ticket_type_id')::UUID;
    v_quantite := (v_item->>'quantite')::INT;

    -- Vérifier que le type de ticket existe
    SELECT prix INTO v_ticket_price
    FROM ticket_types
    WHERE id = v_ticket_type_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Type de ticket introuvable pour la réception: ' || v_ticket_type_id::text
      );
    END IF;

    IF v_quantite <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'La quantité à recevoir doit être supérieure à 0'
      );
    END IF;

    v_receive_value := v_receive_value + (v_quantite * v_ticket_price);

    INSERT INTO ticket_allocations
      (pos_id, ticket_type_id, quantite, type, exchange_group_id, notes, space_id, alloue_par, date_allocation)
    VALUES
      (p_pos_id, v_ticket_type_id, v_quantite, 'exchange_receive', v_exchange_group, p_notes, p_space_id, p_user_id, CURRENT_DATE);
  END LOOP;

  -- Vérifier l'équivalence de valeur
  IF v_return_value != v_receive_value THEN
    RAISE EXCEPTION 'Valeur non équivalente: tickets rendus = % FCFA, tickets reçus = % FCFA', v_return_value, v_receive_value;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
