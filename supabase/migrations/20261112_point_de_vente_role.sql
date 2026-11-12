-- ============================================================
-- OPTIWIFI - Compte « point de vente » (consultation seule)
-- L'administrateur crée un accès pour un point de vente depuis sa fiche. Ce compte ne voit
-- que les allocations reçues et les collectes faites sur SON point de vente, sans pouvoir
-- rien ajouter, modifier ni supprimer (contrôlé côté serveur).
-- Un seul compte actif par point de vente.
-- Script idempotent. ALTER TYPE ... ADD VALUE doit être exécuté seul (hors transaction),
-- avant les instructions qui utilisent la nouvelle valeur.
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'point_de_vente';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pos_id UUID REFERENCES points_of_sale(id) ON DELETE SET NULL;

-- Un seul accès actif par point de vente
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_pos_account
  ON profiles (pos_id)
  WHERE pos_id IS NOT NULL AND deleted_at IS NULL AND role = 'point_de_vente';

-- Téléphone du point de vente, saisi par l'administrateur à l'ajout du point de vente :
-- c'est l'identifiant de connexion de son compte (en plus de l'e-mail, facultatif).
ALTER TABLE points_of_sale ADD COLUMN IF NOT EXISTS telephone VARCHAR(50);

-- Recherche d'un compte point de vente par numéro (chiffres seuls) à la connexion
CREATE INDEX IF NOT EXISTS idx_profiles_pos_account_phone
  ON profiles ((regexp_replace(telephone, '\D', '', 'g')))
  WHERE role = 'point_de_vente' AND deleted_at IS NULL;
