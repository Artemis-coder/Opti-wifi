-- ============================================================
-- OPTIWIFI - FIX : Autoriser l'upsert du profil depuis le frontend
-- À exécuter dans Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/nvaavjyogadlimkosdsr/sql
-- ============================================================

-- 1. Supprimer la politique insert trop restrictive sur profiles
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- 2. Remplacer par des politiques qui laissent passer l'upsert du frontend
--    (un utilisateur connecté peut créer/modifier son propre profil)

-- SELECT : chacun voit son propre profil, les admins voient tous
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR auth.role() = 'authenticated'  -- Admins voient aussi les collecteurs dans les listes
  );

-- INSERT : un utilisateur connecté peut créer son propre profil
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- UPDATE : chacun peut modifier son propre profil
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.role() = 'authenticated');

-- DELETE : désactivé pour tout le monde (on ne supprime pas les profils)
-- (aucune policy DELETE = blocage par défaut)

-- 3. Mettre à jour les profils existants avec les vraies données si disponibles
--    (pour les utilisateurs qui se sont inscrits avec le formulaire)
UPDATE public.profiles p
SET
  nom = COALESCE(
    NULLIF(au.raw_user_meta_data->>'nom', ''),
    p.nom,
    split_part(au.email, '@', 1)
  ),
  role = COALESCE(
    CASE
      WHEN au.raw_user_meta_data->>'role' IN ('administrateur','collecteur')
      THEN (au.raw_user_meta_data->>'role')::user_role
      ELSE NULL
    END,
    p.role
  ),
  updated_at = NOW()
FROM auth.users au
WHERE p.id = au.id;

-- 4. Vérification finale : afficher tous les profils mis à jour
SELECT id, nom, email, role, created_at FROM profiles ORDER BY created_at;
