-- ============================================================
-- OPTIWIFI - FIX COMPLET : Trigger handle_new_user + RLS + telephone
-- IMPORTANT: Coller dans Supabase SQL Editor et cliquer "Run"
-- ============================================================

-- --------------------------------------------------------
-- PARTIE 1 : Trigger handle_new_user NON-FATAL
-- Le trigger désactive RLS (SET LOCAL row_security = off) et
-- attrape les exceptions pour ne JAMAIS bloquer la création
-- d'utilisateur dans auth.users. Le profil est créé séparément
-- par l'API route avec la clé service_role.
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Désactiver RLS pour cette transaction
  BEGIN
    SET LOCAL row_security = 'off';
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Continue même si on ne peut pas désactiver RLS
  END;

  -- Tenter de créer/mettre à jour le profil
  BEGIN
    INSERT INTO public.profiles (id, nom, email, role, telephone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'nom', split_part(NEW.email, '@', 1)),
      NEW.email,
      COALESCE(
        CASE
          WHEN NEW.raw_user_meta_data->>'role' IN ('administrateur','collecteur')
          THEN (NEW.raw_user_meta_data->>'role')::user_role
          ELSE NULL
        END,
        'collecteur'::user_role
      ),
      NEW.raw_user_meta_data->>'telephone'
    )
    ON CONFLICT (id) DO UPDATE
      SET
        nom = EXCLUDED.nom,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        telephone = EXCLUDED.telephone,
        updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    -- IGNORE : ne pas bloquer la création de l'utilisateur
    -- Le profil sera créé par l'API route avec service_role
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------
-- PARTIE 2 : (Re)créer le trigger sur auth.users
-- --------------------------------------------------------

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------
-- PARTIE 3 : Politique INSERT permissive pour profiles
-- --------------------------------------------------------

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_allow" ON profiles
  FOR INSERT WITH CHECK (true);

-- --------------------------------------------------------
-- PARTIE 4 : Créer les profils manquants pour les utilisateurs
-- existants (exécuté en tant que superuser via SQL Editor)
-- --------------------------------------------------------

SET LOCAL row_security = 'off';

INSERT INTO public.profiles (id, nom, email, role)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'nom', split_part(au.email, '@', 1), 'Utilisateur'),
  au.email,
  COALESCE(
    CASE
      WHEN au.raw_user_meta_data->>'role' IN ('administrateur','collecteur')
      THEN (au.raw_user_meta_data->>'role')::user_role
      ELSE NULL
    END,
    'administrateur'::user_role
  )
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- --------------------------------------------------------
-- Vérification finale
-- --------------------------------------------------------
SELECT id, nom, email, role, telephone, created_at FROM profiles ORDER BY created_at DESC;
