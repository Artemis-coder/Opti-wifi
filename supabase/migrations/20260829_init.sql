-- Migration SQL initiale pour OptiWifi

-- Types / Enums
CREATE TYPE user_role AS ENUM ('administrateur', 'collecteur');
CREATE TYPE collection_status AS ENUM ('brouillon', 'validee', 'annulee');
CREATE TYPE pos_status AS ENUM ('actif', 'inactif', 'suspendu');

-- Table Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'collecteur',
    telephone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Points de Vente (POS)
CREATE TABLE IF NOT EXISTS points_of_sale (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    ville VARCHAR(100) DEFAULT 'Abidjan',
    statut pos_status NOT NULL DEFAULT 'actif',
    collecteur_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Types de Tickets
CREATE TABLE IF NOT EXISTS ticket_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(100) NOT NULL,
    duree_heures INT NOT NULL,
    prix DECIMAL(12, 2) NOT NULL,
    actif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Allocations de Tickets
CREATE TABLE IF NOT EXISTS ticket_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_id UUID NOT NULL REFERENCES points_of_sale(id) ON DELETE CASCADE,
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
    quantite INT NOT NULL CHECK (quantite > 0),
    alloue_par UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Collections (Encaissements)
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_id UUID NOT NULL REFERENCES points_of_sale(id) ON DELETE CASCADE,
    collecteur_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    statut collection_status NOT NULL DEFAULT 'validee',
    montant_attendu DECIMAL(12, 2) NOT NULL DEFAULT 0,
    montant_collecte DECIMAL(12, 2) NOT NULL DEFAULT 0,
    difference DECIMAL(12, 2) GENERATED ALWAYS AS (montant_collecte - montant_attendu) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Détails des Collections
CREATE TABLE IF NOT EXISTS collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
    stock_debut INT NOT NULL DEFAULT 0,
    quantite_vendue INT NOT NULL CHECK (quantite_vendue >= 0),
    prix_unitaire DECIMAL(12, 2) NOT NULL,
    montant_total DECIMAL(12, 2) GENERATED ALWAYS AS (quantite_vendue * prix_unitaire) STORED
);

-- Table Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL,
    ancien_etat JSONB,
    nouvel_etat JSONB,
    effectue_par UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_of_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check if User is Admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'administrateur'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
-- Profiles
CREATE POLICY "Admins read write profiles" ON profiles FOR ALL USING (is_admin());
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);

-- Points of Sale
CREATE POLICY "Admins manage POS" ON points_of_sale FOR ALL USING (is_admin());
CREATE POLICY "Collectors read assigned POS" ON points_of_sale FOR SELECT USING (collecteur_id = auth.uid() OR is_admin());

-- Ticket Types
CREATE POLICY "Everyone authenticated reads active ticket types" ON ticket_types FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage ticket types" ON ticket_types FOR ALL USING (is_admin());

-- Ticket Allocations
CREATE POLICY "Admins manage allocations" ON ticket_allocations FOR ALL USING (is_admin());
CREATE POLICY "Collectors view allocations for assigned POS" ON ticket_allocations FOR SELECT USING (
    EXISTS (SELECT 1 FROM points_of_sale WHERE id = pos_id AND collecteur_id = auth.uid()) OR is_admin()
);

-- Collections
CREATE POLICY "Admins manage collections" ON collections FOR ALL USING (is_admin());
CREATE POLICY "Collectors manage own collections" ON collections FOR ALL USING (collecteur_id = auth.uid());

-- Collection Items
CREATE POLICY "Users access collection items via collection" ON collection_items FOR ALL USING (
    EXISTS (
        SELECT 1 FROM collections 
        WHERE collections.id = collection_items.collection_id 
        AND (collections.collecteur_id = auth.uid() OR is_admin())
    )
);

-- Trigger auto profile create on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nom, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nom', 'Utilisateur'),
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'collecteur')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

