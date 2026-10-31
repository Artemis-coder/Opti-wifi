-- Pays où un moyen de paiement est utilisable (codes ISO alpha-2, ex. {CI,SN}).
-- Liste vide = tous les pays. Au réabonnement, le client choisit son pays (par défaut celui
-- de son compte) et ne voit que les moyens de paiement de ce pays. Idempotent.
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS countries TEXT[] NOT NULL DEFAULT '{}';
