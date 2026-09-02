-- ============================================================
-- OPTIWIFI - Script SQL Complet
-- IMPORTANT: Coller dans Supabase SQL Editor et cliquer "Run"
-- URL: https://supabase.com/dashboard/project/nvaavjyogadlimkosdsr/sql
-- ============================================================

-- ETAPE 0 : Creation idempotente (preservation des donnees existantes)
-- Cette migration est idempotente: elle peut etre re-executee sans perdre de donnees.
-- Les objets existants (tables, types, fonctions, triggers) sont preserves.

-- ENUMs (utilisation de DO blocks car CREATE TYPE IF NOT EXISTS n'est pas supporté)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('administrateur', 'collecteur');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'collection_status') THEN
    CREATE TYPE collection_status AS ENUM ('brouillon', 'validee', 'annulee');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pos_status') THEN
    CREATE TYPE pos_status AS ENUM ('actif', 'inactif', 'suspendu');
  END IF;
END $$;

-- ETAPE 2 : Table PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nom         VARCHAR(255) NOT NULL DEFAULT 'Utilisateur',
    email       VARCHAR(255) NOT NULL UNIQUE,
    role        user_role NOT NULL DEFAULT 'collecteur',
    telephone   VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ETAPE 3 : Table POINTS_OF_SALE
CREATE TABLE IF NOT EXISTS points_of_sale (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(255) NOT NULL,
    adresse         TEXT,
    ville           VARCHAR(100) DEFAULT 'Abidjan',
    statut          pos_status NOT NULL DEFAULT 'actif',
    collecteur_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ETAPE 4 : Table TICKET_TYPES
CREATE TABLE IF NOT EXISTS ticket_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(100) NOT NULL,
    duree_heures    INT NOT NULL,
    prix            DECIMAL(12, 2) NOT NULL,
    actif           BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ETAPE 5 : Table TICKET_ALLOCATIONS
CREATE TABLE IF NOT EXISTS ticket_allocations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_id          UUID NOT NULL REFERENCES points_of_sale(id) ON DELETE CASCADE,
    ticket_type_id  UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
    quantite        INT NOT NULL CHECK (quantite > 0),
    alloue_par      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ETAPE 6 : Table COLLECTIONS
CREATE TABLE IF NOT EXISTS collections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_id              UUID NOT NULL REFERENCES points_of_sale(id) ON DELETE CASCADE,
    collecteur_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    statut              collection_status NOT NULL DEFAULT 'validee',
    montant_attendu     DECIMAL(12, 2) NOT NULL DEFAULT 0,
    montant_collecte    DECIMAL(12, 2) NOT NULL DEFAULT 0,
    difference          DECIMAL(12, 2) GENERATED ALWAYS AS (montant_collecte - montant_attendu) STORED,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ETAPE 7 : Table COLLECTION_ITEMS
CREATE TABLE IF NOT EXISTS collection_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id       UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    ticket_type_id      UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
    stock_debut         INT NOT NULL DEFAULT 0,
    quantite_vendue     INT NOT NULL CHECK (quantite_vendue >= 0),
    prix_unitaire       DECIMAL(12, 2) NOT NULL,
    montant_total       DECIMAL(12, 2) GENERATED ALWAYS AS (quantite_vendue * prix_unitaire) STORED
);

-- ETAPE 8 : Table AUDIT_LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name      VARCHAR(100) NOT NULL,
    operation       VARCHAR(20) NOT NULL,
    ancien_etat     JSONB,
    nouvel_etat     JSONB,
    effectue_par    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ETAPE 9 : Activer RLS sur toutes les tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_of_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ETAPE 10 : Fonction helper is_admin()
-- Note: SET LOCAL row_security = 'off' prevent infinite recursion
-- (the profiles table RLS policy calls is_admin(), which would loop)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  SET LOCAL row_security = 'off';
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrateur'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ETAPE 11 : Politiques RLS (idempotentes: drop + recreate)
-- Profiles
DROP POLICY IF EXISTS "Utilisateur voit son profil" ON profiles;
DROP POLICY IF EXISTS "Utilisateur modifie son profil" ON profiles;
DROP POLICY IF EXISTS "Utilisateur cree son profil" ON profiles;
DROP POLICY IF EXISTS "Admins gerent tous les profils" ON profiles;
CREATE POLICY "Utilisateur voit son profil" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Utilisateur modifie son profil" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Utilisateur cree son profil" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins gerent tous les profils" ON profiles FOR ALL USING (is_admin());

-- Points de Vente
DROP POLICY IF EXISTS "Admins gerent les POS" ON points_of_sale;
DROP POLICY IF EXISTS "Collecteurs lisent leurs POS" ON points_of_sale;
CREATE POLICY "Admins gerent les POS" ON points_of_sale FOR ALL USING (is_admin());
CREATE POLICY "Collecteurs lisent leurs POS" ON points_of_sale FOR SELECT USING (collecteur_id = auth.uid() OR is_admin());

-- Ticket Types
DROP POLICY IF EXISTS "Tous voient les tickets actifs" ON ticket_types;
DROP POLICY IF EXISTS "Admins gerent les ticket types" ON ticket_types;
CREATE POLICY "Tous voient les tickets actifs" ON ticket_types FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gerent les ticket types" ON ticket_types FOR ALL USING (is_admin());

-- Ticket Allocations
DROP POLICY IF EXISTS "Admins gerent les allocations" ON ticket_allocations;
DROP POLICY IF EXISTS "Collecteurs voient leurs allocations" ON ticket_allocations;
CREATE POLICY "Admins gerent les allocations" ON ticket_allocations FOR ALL USING (is_admin());
CREATE POLICY "Collecteurs voient leurs allocations" ON ticket_allocations FOR SELECT USING (
    EXISTS (SELECT 1 FROM points_of_sale WHERE id = pos_id AND collecteur_id = auth.uid()) OR is_admin()
);

-- Collections
DROP POLICY IF EXISTS "Admins gerent toutes les collectes" ON collections;
DROP POLICY IF EXISTS "Collecteurs gerent leurs collectes" ON collections;
CREATE POLICY "Admins gerent toutes les collectes" ON collections FOR ALL USING (is_admin());
CREATE POLICY "Collecteurs gerent leurs collectes" ON collections FOR ALL USING (collecteur_id = auth.uid());

-- Collection Items
DROP POLICY IF EXISTS "Acces items via collection" ON collection_items;
CREATE POLICY "Acces items via collection" ON collection_items FOR ALL USING (
    EXISTS (
        SELECT 1 FROM collections
        WHERE collections.id = collection_items.collection_id
        AND (collections.collecteur_id = auth.uid() OR is_admin())
    )
);

-- Audit Logs
DROP POLICY IF EXISTS "Admins voient les logs" ON audit_logs;
CREATE POLICY "Admins voient les logs" ON audit_logs FOR ALL USING (is_admin());

-- ETAPE 12 : Trigger auto-creation du profil a l'inscription
-- Ce trigger est CRITIQUE : il insert le nom, email et role
-- saisis dans le formulaire d'inscription directement dans profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Désactiver RLS pour cette transaction : le trigger s'exécute dans le
  -- contexte de GoTrue (sans JWT), donc auth.uid() = NULL et les politiques
  -- RLS échouent. SET LOCAL row_security = off contourne ce problème.
  BEGIN
    SET LOCAL row_security = 'off';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Tenter de créer/mettre à jour le profil (ne bloque jamais l'inscription)
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
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ETAPE 13 : Donnees initiales - Types de Tickets
INSERT INTO ticket_types (nom, duree_heures, prix, actif) VALUES
  ('Pass 1 Heure',        1,   200,  true),
  ('Pass 2 Heures',       2,   350,  true),
  ('Pass 5 Heures',       5,   500,  true),
  ('Pass 24h - Journee',  24,  1000, true),
  ('Pass 7 Jours',        168, 4500, true),
  ('Pass 30 Jours',       720, 15000,true)
ON CONFLICT DO NOTHING;

-- VERIFICATION : lister toutes les tables creees
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
