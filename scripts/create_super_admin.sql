-- ============================================================
-- OPTIWIFI - Créer le compte Super Admin
-- À exécuter dans le Supabase SQL Editor (en tant que propriétaire projet)
-- ============================================================

-- 1. Créer l'enum platform_role si inexistant
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role') THEN
    CREATE TYPE platform_role AS ENUM ('super_admin', 'platform_support');
  END IF;
END $$;

-- 2. Créer la table platform_users si inexistante
CREATE TABLE IF NOT EXISTS platform_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role            platform_role NOT NULL DEFAULT 'super_admin',
  full_name       VARCHAR(255),
  email           VARCHAR(255),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Activer RLS
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;

-- 4. Politique: service role et admins voient tout
DROP POLICY IF EXISTS "Platform users: service role sees all" ON platform_users;
DROP POLICY IF EXISTS "Platform users: super admin manages all" ON platform_users;
CREATE POLICY "Platform users: service role sees all"
    ON platform_users FOR ALL USING (true);

-- 5. Créer l'utilisateur Auth (password: Admin123!@#)
INSERT INTO auth.users (id, instance_url, aud, role, email, encrypted_password, email_confirmed_at, created_at)
VALUES (
  gen_random_uuid(),
  'https://nvaavjyogadlimkosdsr.supabase.co',
  'authenticated',
  'authenticated',
  'superadmin@optiwifi.ci',
  crypt('Admin123!@#', gen_salt('bf')),
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE
  SET encrypted_password = EXCLUDED.encrypted_password
RETURNING id INTO _new_user_id;

-- Handle both insert and update cases
DO $$
DECLARE
  _new_user_id UUID;
BEGIN
  -- Try to find existing user or create new
  SELECT id INTO _new_user_id FROM auth.users WHERE email = 'superadmin@optiwifi.ci';

  IF _new_user_id IS NULL THEN
    INSERT INTO auth.users (id, instance_url, aud, role, email, encrypted_password, email_confirmed_at, created_at)
    VALUES (
      gen_random_uuid(),
      'https://nvaavjyogadlimkosdsr.supabase.co',
      'authenticated',
      'authenticated',
      'superadmin@optiwifi.ci',
      crypt('Admin123!@#', gen_salt('bf')),
      NOW(),
      NOW()
    ) RETURNING id INTO _new_user_id;
  ELSE
    UPDATE auth.users
      SET encrypted_password = crypt('Admin123!@#', gen_salt('bf')),
          email_confirmed_at = NOW()
    WHERE id = _new_user_id;
  END IF;

  -- 6. Créer/mettre à jour le profil administrateur
  INSERT INTO profiles (id, nom, email, role, created_at, updated_at)
  VALUES (_new_user_id, 'Super Admin', 'superadmin@optiwifi.ci', 'administrateur', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
    SET nom = 'Super Admin', email = 'superadmin@optiwifi.ci', role = 'administrateur', updated_at = NOW();

  -- 7. Créer/mettre à jour l'entrée platform_users
  INSERT INTO platform_users (auth_user_id, role, full_name, email, is_active, created_at, updated_at)
  VALUES (_new_user_id, 'super_admin', 'Super Admin', 'superadmin@optiwifi.ci', true, NOW(), NOW())
  ON CONFLICT (auth_user_id) DO UPDATE
    SET role = 'super_admin', full_name = 'Super Admin', email = 'superadmin@optiwifi.ci', is_active = true, updated_at = NOW();

  RAISE NOTICE 'Super admin account ready: %', 'superadmin@optiwifi.ci';
END $$;
