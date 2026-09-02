-- ============================================================
-- OPTIWIFI - CORRECTION URGENTE : Rétablir le rôle Administrateur
-- ============================================================
-- Ce script corrige le problème où le deploy_security_fixes.sql
-- (commit 78cfcdd) a rétrogradé tous les admins en 'collecteur'.
--
-- LESQL editor utilise le service_role → RLS contourné → UPDATE possible.
--
-- Exécutez ce script, puis déconnectez-vous et reconnectez-vous.
-- ============================================================

-- ÉTAPE 1 : Diagnostic — afficher TOUS les profils
SELECT '--- PROFILS ACTUELS ---' AS info;
SELECT id, nom, email, role FROM public.profiles ORDER BY created_at DESC;

-- ÉTAPE 2 : Rétablir le rôle admin sur TOUS les profils existants
UPDATE public.profiles
SET role = 'administrateur'::user_role,
    updated_at = NOW();

-- ÉTAPE 3 : Créer les profils manquants (au cas où ils ont été supprimés)
INSERT INTO public.profiles (id, nom, email, role, created_at, updated_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'nom', split_part(au.email, '@', 1)),
  au.email,
  'administrateur'::user_role,
  NOW(),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- ÉTAPE 4 : Activer force_admin dans auth.users (empêche les futurs downgrades)
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{force_admin}',
  '"true"'::jsonb,
  true
);

-- ÉTAPE 5 : Réparer la fonction handle_new_user (respecte force_admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    SET LOCAL row_security = 'off';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.profiles (id, nom, email, role, telephone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'nom', split_part(NEW.email, '@', 1)),
      NEW.email,
      CASE
        WHEN NEW.raw_user_meta_data->>'force_admin' = 'true' THEN 'administrateur'::user_role
        ELSE 'collecteur'::user_role
      END,
      NEW.raw_user_meta_data->>'telephone'
    )
    ON CONFLICT (id) DO UPDATE
      SET
        nom = EXCLUDED.nom,
        email = EXCLUDED.email,
        role = CASE
          WHEN NEW.raw_user_meta_data->>'force_admin' = 'true' THEN 'administrateur'::user_role
          ELSE profiles.role
        END,
        telephone = EXCLUDED.telephone,
        updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ÉTAPE 6 : Vérification finale
SELECT '--- PROFILS APRÈS CORRECTION ---' AS info;
SELECT id, nom, email, role FROM public.profiles ORDER BY created_at DESC;

-- ÉTAPE 7 : Vérifier que les données existent toujours
SELECT '--- DONNÉES ---' AS info;
SELECT
  (SELECT count(*) FROM points_of_sale)     AS nb_pos,
  (SELECT count(*) FROM collections)        AS nb_collections,
  (SELECT count(*) FROM ticket_allocations) AS nb_allocations,
  (SELECT count(*) FROM profiles)           AS nb_profils,
  (SELECT count(*) FROM ticket_types)       AS nb_ticket_types,
  (SELECT count(*) FROM collection_items)   AS nb_items;

-- ============================================================
-- APRÈS AVOIR EXÉCUTÉ CE SCRIPT :
-- 1) Déconnectez-vous de l'application (bouton Déconnexion)
-- 2) Console navigateur → Application → Local Storage
--    → Supprimez la clé 'optiwifi-auth-storage'
-- 3) Reconnectez-vous → toutes les données réapparaissent
-- ============================================================
