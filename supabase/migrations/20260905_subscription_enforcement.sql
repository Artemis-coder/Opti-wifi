-- =========================================================================
-- OPTIWIFI - ENFORCEMENT DES ABONNEMENTS ET VALIDATION
-- =========================================================================

-- 1. Ajouter le statut "pending_approval" pour les nouvelles inscriptions
-- Note: 'ALTER TYPE' cannot run inside a transaction block easily if used immediately,
-- but Supabase CLI handles it or we can just commit. 
COMMIT;
ALTER TYPE organization_status ADD VALUE IF NOT EXISTS 'pending_approval' BEFORE 'trial';
BEGIN;

-- 2. Fonction pour vérifier si une organisation peut créer un nouveau POS
CREATE OR REPLACE FUNCTION public.can_create_pos(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INT;
  v_max_pos INT;
BEGIN
  -- Compter le nombre de POS actuels (actifs ou non)
  SELECT COUNT(*) INTO v_current_count 
  FROM points_of_sale 
  WHERE organization_id = p_org_id;

  -- Obtenir la limite du plan actif actuel
  SELECT sp.max_points_of_sale INTO v_max_pos
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.organization_id = p_org_id
    AND s.status IN ('trialing', 'active')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Si pas de limite (NULL), alors infini. Sinon, vérifier.
  IF v_max_pos IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN v_current_count < v_max_pos;
END;
$$;

-- 3. Fonction pour vérifier si une organisation peut créer un nouvel utilisateur
CREATE OR REPLACE FUNCTION public.can_create_user(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INT;
  v_max_users INT;
BEGIN
  -- Compter le nombre d'utilisateurs actuels dans l'orga
  SELECT COUNT(*) INTO v_current_count 
  FROM profiles 
  WHERE organization_id = p_org_id;

  -- Obtenir la limite
  SELECT sp.max_users INTO v_max_users
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.organization_id = p_org_id
    AND s.status IN ('trialing', 'active')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_max_users IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN v_current_count < v_max_users;
END;
$$;
