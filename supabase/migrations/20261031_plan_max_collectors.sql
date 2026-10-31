-- Forfaits : nombre maximum de collecteurs (profils « collecteur » actifs).
-- NULL ou -1 = illimité. Contrôlé à la création d'un collecteur. Idempotent.
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_collectors INT;
