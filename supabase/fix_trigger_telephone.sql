-- ============================================================
-- OPTIWIFI - FIX : Mettre à jour le trigger handle_new_user
-- pour prendre en charge le champ telephone
-- À exécuter dans Supabase SQL Editor APRÈS init.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vérification
SELECT id, nom, email, role, telephone FROM profiles ORDER BY created_at DESC LIMIT 10;
