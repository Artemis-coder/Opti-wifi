-- ============================================================
-- FIX: Nettoyage complet de platform_users
-- ============================================================
-- Mapping attendu :
--   kedakeyaoboris@gmail.com  -> profil organisation -> /dashboard
--   superadmin@optiwifi.com   -> super admin        -> /platform/dashboard

-- 1. Diagnostic
SELECT
  pu.auth_user_id,
  pu.role AS platform_role,
  pu.is_active,
  p.email,
  p.nom,
  p.role AS profile_role
FROM platform_users pu
JOIN profiles p ON p.id = pu.auth_user_id
ORDER BY pu.created_at;

-- 2. Supprimer les entrées incorrectes (Boris = admin d'organisation, pas super admin)
DELETE FROM platform_users 
WHERE auth_user_id = (SELECT id FROM profiles WHERE email = 'kedakeyaoboris@gmail.com')
   OR auth_user_id NOT IN (
     SELECT p.id FROM profiles p WHERE p.email = 'superadmin@optiwifi.com'
   );

-- 3. Vérifier qu'aucune entrée incorrecte ne reste (seul superadmin devrait rester)
SELECT COUNT(*) AS remaining FROM platform_users;

-- 4. Créer UNIQUEMENT le super admin légitime
INSERT INTO platform_users (auth_user_id, role, full_name, email, is_active, created_at, updated_at)
SELECT
  p.id,
  'super_admin'::platform_role,
  p.nom,
  p.email,
  true,
  NOW(),
  NOW()
FROM profiles p
WHERE p.email = 'superadmin@optiwifi.com'
  AND NOT EXISTS (
    SELECT 1 FROM platform_users pu WHERE pu.auth_user_id = p.id
  );

-- 5. Vérification finale
SELECT
  pu.auth_user_id,
  pu.role AS platform_role,
  pu.is_active,
  p.email,
  p.nom,
  p.role AS profile_role
FROM platform_users pu
JOIN profiles p ON p.id = pu.auth_user_id;
