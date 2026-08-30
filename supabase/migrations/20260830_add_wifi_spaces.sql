-- ============================================================
-- OPTIWIFI - Ajout table wifi_spaces et isolation par espace
-- ============================================================

-- ETAPE 1 : Creation de la table wifi_spaces
CREATE TABLE IF NOT EXISTS wifi_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  adresse TEXT,
  ville TEXT,
  statut TEXT DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'suspendu')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ETAPE 2 : Ajout colonne space_id dans points_of_sale
ALTER TABLE points_of_sale
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE CASCADE;

-- ETAPE 3 : Ajout colonne space_id dans ticket_types
ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE CASCADE;

-- ETAPE 4 : Ajout colonne space_id dans ticket_allocations
ALTER TABLE ticket_allocations
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE CASCADE;

-- ETAPE 5 : Ajout colonne space_id dans collections
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE CASCADE;

-- ETAPE 6 : Ajout colonne space_id dans collection_items
ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES wifi_spaces(id) ON DELETE CASCADE;

-- ETAPE 7 : RLS policies pour wifi_spaces
ALTER TABLE wifi_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all wifi_spaces" ON wifi_spaces
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert wifi_spaces" ON wifi_spaces
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update wifi_spaces" ON wifi_spaces
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete wifi_spaces" ON wifi_spaces
  FOR DELETE USING (auth.role() = 'authenticated');

-- ETAPE 8 : Index pour les performances
CREATE INDEX IF NOT EXISTS idx_points_of_sale_space_id ON points_of_sale(space_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_space_id ON ticket_types(space_id);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_space_id ON ticket_allocations(space_id);
CREATE INDEX IF NOT EXISTS idx_collections_space_id ON collections(space_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_space_id ON collection_items(space_id);
