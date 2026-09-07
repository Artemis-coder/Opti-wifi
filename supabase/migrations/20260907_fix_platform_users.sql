-- ============================================================
-- DIAGNOSTIC + FIX: Nettoyage complet de platform_users
-- ============================================================

-- ÉTAPE 1: Diagnostic - voir TOUS les utilisateurs platform
SELECT
  pu.id AS platform_user_id,
  pu.auth_user_id,
  pu.role AS platform_role,
  pu.is_active,
  p.email,
  p.nom,
  p.role AS profile_role
FROM platform_users pu
LEFT JOIN profiles p ON p.id = pu.auth_user_id
ORDER BY pu.created_at;

-- ÉTAPE 2: Supprimer TOUTES les entrées platform_users
-- puis ne garder que les super admins explicitement désignés
DELETE FROM platform_users;

-- ÉTAPE 3: Recréer uniquement le(s) super admin(s) légitime(s)
-- ⚠️  MODIFIEZ CETTE SECTION avec vos super admins légitimes
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
WHERE p.email = 'kedakeyaoboris@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM platform_users pu WHERE pu.auth_user_id = p.id
  );

-- ÉTAPE 4: Vérification finale
SELECT
  pu.id AS platform_user_id,
  pu.auth_user_id,
  pu.role AS platform_role,
  pu.is_active,
  p.email,
  p.nom,
  p.role AS profile_role
FROM platform_users pu
JOIN profiles p ON p.id = pu.auth_user_id
ORDER BY pu.created_at;
