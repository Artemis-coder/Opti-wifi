-- ============================================================
-- OPTIWIFI - Forfaits : accès « point de vente » (comptes en consultation seule).
-- max_pos_accounts : 0 = non inclus, NULL ou -1 = illimité, N = nombre maximum d'accès actifs.
-- Réglable dans le back-office (Forfaits) ; contrôlé à la création d'un accès.
-- Inclus à partir du forfait Standard : le forfait Découverte n'en a pas.
-- Script idempotent (base Neon).
-- ============================================================

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_pos_accounts INT;

-- Découverte : non inclus (seulement si la valeur n'a pas encore été réglée)
UPDATE subscription_plans SET max_pos_accounts = 0
 WHERE name = 'Découverte' AND max_pos_accounts IS NULL;
