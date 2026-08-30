-- ============================================================
-- OPTIWIFI - FIX COMPLET : Trigger handle_new_user + RLS + telephone
-- IMPORTANT: Coller dans Supabase SQL Editor et cliquer "Run"
-- À exécuter APRÈS init.sql, fix_rls_and_profiles.sql et/ou fix_profiles_upsert.sql
-- ============================================================

-- --------------------------------------------------------
-- PARTIE 1 : Recréer le trigger handle_new_user avec RLS désactivé
-- Le trigger fait échouer la création d'utilisateur car :
-- - Il s'exécute dans le contexte de GoTrue (sans JWT)
-- - auth.uid() = NULL → les politiques RLS auth.uid() = id échouent
-- même avec SECURITY DEFINER, Supabase applique RLS dans ce contexte
-- Solution : SET LOCAL row_security = off dans le trigger
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Désactiver RLS pour cette transaction (nécessaire car le trigger
  -- s'exécute sans JWT dans le contexte de GoTrue)
  SET LOCAL row_security = 'off';

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
-- PARTIE 3 : Politique INSERT pour profiles (sécurité en double)
-- Permet l'insertion depuis le client authentifié
-- --------------------------------------------------------

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- --------------------------------------------------------
-- PARTIE 4 : Créer les profils manquants pour les utilisateurs
-- existants (ceux créés avant que le trigger ne fonctionne)
-- --------------------------------------------------------

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
