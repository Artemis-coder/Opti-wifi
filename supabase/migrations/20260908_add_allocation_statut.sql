-- ============================================================
-- Migration : Ajout du statut de fonctionnalité sur ticket_allocations
-- Objectif : pouvoir classifier les tickets alloués (fonctionnel / non fonctionnel / en réparation)
--            et afficher la KPI "Tickets Non Fonctionnels" sur la page des allocations.
-- ============================================================

-- ETAPE 1 : Créer l'ENUM allocation_statut (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'allocation_statut'
  ) THEN
    CREATE TYPE allocation_statut AS ENUM (
      'fonctionnel',
      'non_fonctionnel',
      'en_reparation'
    );
  END IF;
END $$;

-- ETAPE 2 : Ajouter la colonne statut sur ticket_allocations
ALTER TABLE ticket_allocations
  ADD COLUMN IF NOT EXISTS statut allocation_statut DEFAULT 'fonctionnel' NOT NULL;

-- ETAPE 3 : Index pour les requêtes de filtrage par statut
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_statut
  ON ticket_allocations(statut);

-- ETAPE 4 : Commentaire
COMMENT ON COLUMN ticket_allocations.statut IS
  'Statut de fonctionnalité des tickets alloués : fonctionnel (par défaut), non_fonctionnel (défaut retourné), en_reparation (en réparation)';