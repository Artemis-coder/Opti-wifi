-- =========================================================================
-- CRÉATION DU COMPTE SUPER ADMIN PAR DÉFAUT
-- Exécutez ce script dans la console SQL de Supabase
-- =========================================================================

DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
  admin_email VARCHAR := 'superadmin@optiwifi.com';
  admin_password VARCHAR := 'SuperAdminOpti2026!'; -- Mot de passe par défaut
  org_id UUID;
BEGIN
  -- 1. Récupérer ou créer une organisation par défaut
  SELECT id INTO org_id FROM organizations LIMIT 1;
  IF org_id IS NULL THEN
    INSERT INTO organizations (name, status) VALUES ('Plateforme OptiWifi', 'active') RETURNING id INTO org_id;
  END IF;

  -- 2. Créer l'utilisateur dans auth.users (Authentification Supabase)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('full_name', 'Directeur OptiWifi'),
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO NOTHING;

  -- Mettre à jour l'ID au cas où l'email existait déjà
  SELECT id INTO new_user_id FROM auth.users WHERE email = admin_email;

  -- 3. Créer le profil public (Nécessaire pour le fonctionnement de l'app)
  INSERT INTO public.profiles (id, nom, email, role, organization_id, created_at, updated_at)
  VALUES (new_user_id, 'Directeur OptiWifi', admin_email, 'administrateur', org_id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 4. Promouvoir en SUPER ADMIN dans la table platform_users
  INSERT INTO public.platform_users (auth_user_id, role, full_name, email, is_active, created_at, updated_at)
  VALUES (new_user_id, 'super_admin', 'Directeur OptiWifi', admin_email, true, NOW(), NOW())
  ON CONFLICT (auth_user_id) DO NOTHING;

END $$;
