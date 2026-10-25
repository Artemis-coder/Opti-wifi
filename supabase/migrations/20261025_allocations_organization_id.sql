-- ============================================================
-- OPTIWIFI - Organisation obligatoire sur les allocations de tickets
-- La fonction perform_ticket_exchange (et d'anciens écrans) créaient des
-- allocations sans organization_id : elles devenaient invisibles une fois
-- l'isolation par organisation appliquée.
-- 1. Trigger : organization_id déduit du point de vente à l'insertion.
-- 2. Rattrapage des lignes existantes.
-- Script idempotent : peut être rejoué sans effet de bord.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_allocation_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.pos_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
      FROM points_of_sale WHERE id = NEW.pos_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_allocations_organization_id ON ticket_allocations;
CREATE TRIGGER trg_ticket_allocations_organization_id
  BEFORE INSERT ON ticket_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_allocation_organization_id();

UPDATE ticket_allocations a
   SET organization_id = p.organization_id
  FROM points_of_sale p
 WHERE p.id = a.pos_id
   AND a.organization_id IS NULL
   AND p.organization_id IS NOT NULL;
