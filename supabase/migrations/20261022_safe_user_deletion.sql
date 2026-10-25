-- ============================================================
-- Migration: Safe user deletion & data preservation
-- Date: 2026-10-22
-- Description:
--   1. Permet le soft-delete des utilisateurs dans profiles (is_active, deleted_at)
--   2. Empêche la suppression en cascade de l'historique financier des collectes
--      lorsqu'un collecteur ou utilisateur est supprimé/désactivé.
-- ============================================================

-- 1. Ajout des colonnes de gestion du cycle de vie des utilisateurs dans profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Protection de l'intégrité comptable et financière des collectes
-- Rendre collecteur_id nullable afin de ne jamais bloquer ou détruire une collecte
ALTER TABLE collections 
  ALTER COLUMN collecteur_id DROP NOT NULL;

-- Remplacement de la contrainte ON DELETE CASCADE par ON DELETE SET NULL
ALTER TABLE collections 
  DROP CONSTRAINT IF EXISTS collections_collecteur_id_fkey;

ALTER TABLE collections 
  ADD CONSTRAINT collections_collecteur_id_fkey 
  FOREIGN KEY (collecteur_id) REFERENCES profiles(id) ON DELETE SET NULL;
