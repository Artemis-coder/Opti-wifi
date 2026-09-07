-- =========================================================================
-- SCRIPT DE CORRECTION : ASSIGNER LES DONNÉES EXISTANTES À UNE ORGANISATION
-- =========================================================================
-- Ce script permet de lier toutes les données existantes (qui ont un
-- organization_id = NULL) à une organisation spécifique, pour qu'elles
-- réapparaissent sur le front-end après l'activation des politiques RLS.

DO $$
DECLARE
    target_org_id UUID;
    org_name TEXT := 'Boris Wifi'; -- Remplacez par le nom exact de l'organisation si différent
BEGIN
    -- 1. Chercher l'organisation par son nom
    SELECT id INTO target_org_id FROM organizations WHERE name ILIKE '%' || org_name || '%' LIMIT 1;
    
    -- Si l'organisation n'existe pas, on la crée
    IF target_org_id IS NULL THEN
        INSERT INTO organizations (name, status) 
        VALUES (org_name, 'active')
        RETURNING id INTO target_org_id;
        
        RAISE NOTICE 'Organisation "%" créée avec l''ID: %', org_name, target_org_id;
    ELSE
        RAISE NOTICE 'Organisation "%" trouvée avec l''ID: %', org_name, target_org_id;
    END IF;

    -- 2. Mettre à jour les profils sans organisation
    UPDATE profiles SET organization_id = target_org_id WHERE organization_id IS NULL;
    
    -- 3. Mettre à jour toutes les autres tables
    UPDATE wifi_spaces SET organization_id = target_org_id WHERE organization_id IS NULL;
    UPDATE points_of_sale SET organization_id = target_org_id WHERE organization_id IS NULL;
    UPDATE ticket_types SET organization_id = target_org_id WHERE organization_id IS NULL;
    UPDATE ticket_allocations SET organization_id = target_org_id WHERE organization_id IS NULL;
    UPDATE collections SET organization_id = target_org_id WHERE organization_id IS NULL;
    UPDATE collection_items SET organization_id = target_org_id WHERE organization_id IS NULL;
    
    RAISE NOTICE 'Toutes les données orphelines ont été assignées à l''organisation %', org_name;
END $$;
