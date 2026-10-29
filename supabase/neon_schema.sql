-- ============================================================
-- OPTIWIFI - Neon Database Schema
-- ============================================================
-- Migration depuis Supabase vers Neon (PostgreSQL)
-- Toutes les tables + auth.users de remplacement
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

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
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
    CREATE TYPE organization_status AS ENUM ('trial', 'active', 'expiring', 'expired', 'suspended', 'cancelled', 'archived', 'pending_approval');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'unpaid', 'cancelled', 'expired', 'suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_period') THEN
    CREATE TYPE billing_period AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'successful', 'failed', 'refunded', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'paid', 'overdue', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role') THEN
    CREATE TYPE platform_role AS ENUM ('super_admin', 'platform_support');
  END IF;
END $$;

-- ============================================================
-- TABLE: users (replacement for Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  email_confirmed BOOLEAN NOT NULL DEFAULT false,
  banned_until    TIMESTAMPTZ,
  user_metadata   JSONB,
  app_metadata    JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE: organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  contact_name  VARCHAR(255),
  email         VARCHAR(255),
  phone         VARCHAR(50),
  address       TEXT,
  status        organization_status NOT NULL DEFAULT 'trial',
  currency      VARCHAR(10) NOT NULL DEFAULT 'XOF',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nom           VARCHAR(255) NOT NULL DEFAULT 'Utilisateur',
  email         VARCHAR(255) NOT NULL UNIQUE,
  role          user_role NOT NULL DEFAULT 'collecteur',
  telephone     VARCHAR(50),
  devise        VARCHAR(10) DEFAULT 'XOF',
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  deleted_at    TIMESTAMPTZ DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: wifi_spaces
-- ============================================================
CREATE TABLE IF NOT EXISTS wifi_spaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           TEXT NOT NULL,
  description   TEXT,
  adresse       TEXT,
  ville         TEXT,
  statut        TEXT DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'suspendu')),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: points_of_sale
-- ============================================================
CREATE TABLE IF NOT EXISTS points_of_sale (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           VARCHAR(255) NOT NULL,
  adresse       TEXT,
  ville         VARCHAR(100) DEFAULT 'Abidjan',
  statut        pos_status NOT NULL DEFAULT 'actif',
  collecteur_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  space_id      UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: ticket_types
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           VARCHAR(100) NOT NULL,
  duree_heures  INT NOT NULL,
  prix          DECIMAL(12, 2) NOT NULL,
  actif         BOOLEAN NOT NULL DEFAULT true,
  space_id      UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: ticket_allocations
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_allocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_id          UUID NOT NULL REFERENCES points_of_sale(id) ON DELETE CASCADE,
  ticket_type_id  UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  quantite        INT NOT NULL CHECK (quantite > 0),
  alloue_par      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes           TEXT,
  space_id        UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  date_allocation DATE DEFAULT CURRENT_DATE,
  type            VARCHAR(30) NOT NULL DEFAULT 'allocation'
                CHECK (type IN ('allocation', 'exchange_return', 'exchange_receive')),
  exchange_group_id UUID,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  statut          VARCHAR(50) DEFAULT 'validee',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: collections
-- ============================================================
CREATE TABLE IF NOT EXISTS collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_id          UUID NOT NULL REFERENCES points_of_sale(id) ON DELETE CASCADE,
  collecteur_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  space_id        UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  organisation_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  statut          collection_status NOT NULL DEFAULT 'validee',
  montant_attendu DECIMAL(12, 2) NOT NULL DEFAULT 0,
  montant_collecte DECIMAL(12, 2) NOT NULL DEFAULT 0,
  difference      DECIMAL(12, 2) GENERATED ALWAYS AS (montant_collecte - montant_attendu) STORED,
  commission      DECIMAL(12, 2) NOT NULL DEFAULT 0,
  date_collecte   DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: collection_items
-- ============================================================
CREATE TABLE IF NOT EXISTS collection_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  ticket_type_id  UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  stock_debut     INT NOT NULL DEFAULT 0,
  quantite_vendue INT NOT NULL CHECK (quantite_vendue >= 0),
  prix_unitaire   DECIMAL(12, 2) NOT NULL,
  montant_total   DECIMAL(12, 2) GENERATED ALWAYS AS (quantite_vendue * prix_unitaire) STORED,
  space_id        UUID REFERENCES wifi_spaces(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: subscription_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(100) NOT NULL UNIQUE,
  description       TEXT,
  price             DECIMAL(12, 2) NOT NULL,
  currency          VARCHAR(10) NOT NULL DEFAULT 'XOF',
  billing_period    billing_period NOT NULL DEFAULT 'monthly',
  trial_days        INT DEFAULT 14,
  max_users         INT,
  max_points_of_sale INT,
  max_tickets_per_month INT,
  features          JSONB,
  status            VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id             UUID NOT NULL REFERENCES subscription_plans(id),
  status              subscription_status NOT NULL DEFAULT 'trialing',
  start_date          TIMESTAMPTZ,
  end_date            TIMESTAMPTZ,
  trial_start         TIMESTAMPTZ,
  trial_end           TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  auto_renew          BOOLEAN DEFAULT false,
  cancelled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id     UUID REFERENCES subscriptions(id),
  plan_id             UUID REFERENCES subscription_plans(id),
  amount              DECIMAL(12, 2) NOT NULL,
  currency            VARCHAR(10) NOT NULL DEFAULT 'XOF',
  payment_method      VARCHAR(50),
  transaction_reference VARCHAR(255),
  status              payment_status NOT NULL DEFAULT 'pending',
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id     UUID REFERENCES subscriptions(id),
  invoice_number      VARCHAR(100) NOT NULL,
  amount              DECIMAL(12, 2) NOT NULL,
  currency            VARCHAR(10) NOT NULL DEFAULT 'XOF',
  status              invoice_status NOT NULL DEFAULT 'draft',
  issued_at           TIMESTAMPTZ,
  due_at              TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      VARCHAR(100) NOT NULL,
  operation       VARCHAR(20) NOT NULL,
  ancien_etat     JSONB,
  nouvel_etat     JSONB,
  effectue_par    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: platform_users
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role            platform_role NOT NULL DEFAULT 'super_admin',
  full_name       VARCHAR(255),
  email           VARCHAR(255),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: platform_audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(50),
  entity_id       TEXT,
  old_data        JSONB,
  new_data        JSONB,
  ip_address      INET,
  user_agent      TEXT,
  session_id      TEXT,
  support_ticket_id UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: platform_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  key             VARCHAR(100) PRIMARY KEY,
  value           JSONB NOT NULL,
  description     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: support_tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name     VARCHAR(255) NOT NULL,
  subject         VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_wifi_spaces_organization_id ON wifi_spaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_points_of_sale_organization_id ON points_of_sale(organization_id);
CREATE INDEX IF NOT EXISTS idx_points_of_sale_space_id ON points_of_sale(space_id);
CREATE INDEX IF NOT EXISTS idx_points_of_sale_collecteur_id ON points_of_sale(collecteur_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_space_id ON ticket_types(space_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_organization_id ON ticket_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_space_id ON ticket_allocations(space_id);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_pos_id ON ticket_allocations(pos_id);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_type ON ticket_allocations(type);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_exchange_group ON ticket_allocations(exchange_group_id);
CREATE INDEX IF NOT EXISTS idx_collections_organization_id ON collections(organization_id);
CREATE INDEX IF NOT EXISTS idx_collections_pos_id ON collections(pos_id);
CREATE INDEX IF NOT EXISTS idx_collections_collecteur_id ON collections(collecteur_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_space_id ON collection_items(space_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_entity ON platform_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_created_at ON platform_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_platform_users_auth_user_id ON platform_users(auth_user_id);

-- ============================================================
-- TRIGGERS: set_updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'users', 'profiles', 'organizations', 'wifi_spaces',
    'points_of_sale', 'ticket_types', 'ticket_allocations',
    'collections', 'collection_items', 'subscription_plans',
    'subscriptions', 'payments', 'invoices', 'audit_logs',
    'platform_users', 'platform_audit_logs', 'platform_settings',
    'support_tickets'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- get_current_user_id(): returns the authenticated user ID from session variable
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true)::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- get_current_user_role(): returns the role from session variable
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_user_role', true);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- get_current_org_id(): returns the organization_id from session variable
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.current_org_id', true)::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- is_platform_super_admin(): check if current user is a platform super admin
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_users
    WHERE auth_user_id = public.current_user_id()
      AND is_active = true
      AND role IN ('super_admin', 'platform_support')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- perform_ticket_exchange (adapted for Neon - no auth.uid dependency)
-- ============================================================
CREATE OR REPLACE FUNCTION public.perform_ticket_exchange(
  p_pos_id        UUID,
  p_space_id      UUID   DEFAULT NULL,
  p_notes         TEXT   DEFAULT NULL,
  p_user_id       UUID   DEFAULT NULL,
  p_returns       JSONB  DEFAULT '[]'::jsonb,
  p_receives      JSONB  DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exchange_group UUID := gen_random_uuid();
  v_item          JSONB;
  v_ticket_price  NUMERIC;
  v_return_value  NUMERIC := 0;
  v_receive_value NUMERIC := 0;
  v_ticket_type_id UUID;
  v_quantite      INT;
  v_allocated_qty INT;
  v_sold_qty      INT;
  v_available_qty INT;
BEGIN
  -- 1. Valider le point de vente
  IF NOT EXISTS (SELECT 1 FROM points_of_sale WHERE id = p_pos_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Point de vente introuvable');
  END IF;

  -- Déduire le space_id du POS si non spécifié
  IF p_space_id IS NULL THEN
    SELECT space_id INTO p_space_id FROM points_of_sale WHERE id = p_pos_id;
  END IF;

  -- 2. Valider qu'il y a des tickets à rendre et à recevoir
  IF jsonb_array_length(p_returns) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Aucun ticket à rendre spécifié');
  END IF;

  IF jsonb_array_length(p_receives) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Aucun ticket à recevoir spécifié');
  END IF;

  -- 3. Valider chaque ticket à rendre et calculer la valeur totale
  FOR v_item IN SELECT jsonb_array_elements(p_returns)
  LOOP
    v_ticket_type_id := COALESCE(
      NULLIF(v_item->>'ticket_type_id', ''),
      NULLIF(v_item->>'ticketTypeId', '')
    )::UUID;

    v_quantite := COALESCE((v_item->>'quantite')::INT, (v_item->>'quantity')::INT, 0);

    IF v_ticket_type_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Identifiant de ticket manquant dans la liste des rendus');
    END IF;

    IF v_quantite <= 0 THEN
      RETURN jsonb_build_object('success', false, 'message', 'La quantité à rendre doit être supérieure à 0');
    END IF;

    -- Récupérer le prix du ticket
    SELECT prix INTO v_ticket_price
    FROM ticket_types
    WHERE id = v_ticket_type_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Type de ticket introuvable pour le rendu: ' || v_ticket_type_id::text);
    END IF;

    -- Vérifier le stock disponible au POS
    SELECT COALESCE(SUM(
      CASE
        WHEN ta.type = 'exchange_return' THEN -ta.quantite
        ELSE ta.quantite
      END
    ), 0) INTO v_allocated_qty
    FROM ticket_allocations ta
    WHERE ta.pos_id = p_pos_id
      AND ta.ticket_type_id = v_ticket_type_id;

    SELECT COALESCE(SUM(ci.quantite_vendue), 0) INTO v_sold_qty
    FROM collection_items ci
    JOIN collections c ON ci.collection_id = c.id
    WHERE c.pos_id = p_pos_id
      AND ci.ticket_type_id = v_ticket_type_id;

    v_available_qty := v_allocated_qty - v_sold_qty;

    IF v_available_qty < v_quantite THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('Stock insuffisant pour le ticket (Disponible: %s, Demandé: %s)', v_available_qty, v_quantite)
      );
    END IF;

    v_return_value := v_return_value + (v_quantite * v_ticket_price);
  END LOOP;

  -- 4. Valider chaque ticket à recevoir et calculer la valeur totale
  FOR v_item IN SELECT jsonb_array_elements(p_receives)
  LOOP
    v_ticket_type_id := COALESCE(
      NULLIF(v_item->>'ticket_type_id', ''),
      NULLIF(v_item->>'ticketTypeId', '')
    )::UUID;

    v_quantite := COALESCE((v_item->>'quantite')::INT, (v_item->>'quantity')::INT, 0);

    IF v_ticket_type_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Identifiant de ticket manquant dans la liste des réceptions');
    END IF;

    IF v_quantite <= 0 THEN
      RETURN jsonb_build_object('success', false, 'message', 'La quantité à recevoir doit être supérieure à 0');
    END IF;

    SELECT prix INTO v_ticket_price
    FROM ticket_types
    WHERE id = v_ticket_type_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Type de ticket introuvable pour la réception: ' || v_ticket_type_id::text);
    END IF;

    v_receive_value := v_receive_value + (v_quantite * v_ticket_price);
  END LOOP;

  -- 5. Vérifier l'équivalence de valeur
  IF v_return_value != v_receive_value THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Valeur non équivalente: tickets rendus = %s FCFA, tickets reçus = %s FCFA (écart: %s FCFA)',
                        v_return_value, v_receive_value, abs(v_return_value - v_receive_value))
    );
  END IF;

  -- 6. Insérer les enregistrements de retour (exchange_return)
  FOR v_item IN SELECT jsonb_array_elements(p_returns)
  LOOP
    v_ticket_type_id := COALESCE(
      NULLIF(v_item->>'ticket_type_id', ''),
      NULLIF(v_item->>'ticketTypeId', '')
    )::UUID;
    v_quantite := COALESCE((v_item->>'quantite')::INT, (v_item->>'quantity')::INT, 0);

    INSERT INTO ticket_allocations
      (pos_id, ticket_type_id, quantite, type, exchange_group_id, notes, space_id, alloue_par, date_allocation)
    VALUES
      (p_pos_id, v_ticket_type_id, v_quantite, 'exchange_return', v_exchange_group, p_notes, p_space_id, COALESCE(p_user_id, public.current_user_id()), CURRENT_DATE);
  END LOOP;

  -- 7. Insérer les enregistrements de réception (exchange_receive)
  FOR v_item IN SELECT jsonb_array_elements(p_receives)
  LOOP
    v_ticket_type_id := COALESCE(
      NULLIF(v_item->>'ticket_type_id', ''),
      NULLIF(v_item->>'ticketTypeId', '')
    )::UUID;
    v_quantite := COALESCE((v_item->>'quantite')::INT, (v_item->>'quantity')::INT, 0);

    INSERT INTO ticket_allocations
      (pos_id, ticket_type_id, quantite, type, exchange_group_id, notes, space_id, alloue_par, date_allocation)
    VALUES
      (p_pos_id, v_ticket_type_id, v_quantite, 'exchange_receive', v_exchange_group, p_notes, p_space_id, COALESCE(p_user_id, public.current_user_id()), CURRENT_DATE);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Échange effectué avec succès',
    'exchange_group_id', v_exchange_group::text
  );
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wifi_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_of_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY IF NOT EXISTS "users_own_access" ON users
  FOR ALL USING (id = public.current_user_id());

-- Profiles: users can access profiles in their organization
CREATE POLICY IF NOT EXISTS "profiles_org_access" ON profiles
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR id = public.current_user_id()
  );

-- Organizations: users can access their own organization
CREATE POLICY IF NOT EXISTS "organizations_own_access" ON organizations
  FOR ALL USING (
    id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- WiFi spaces: scoped to organization
CREATE POLICY IF NOT EXISTS "wifi_spaces_org_access" ON wifi_spaces
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- Points of sale: scoped to organization
CREATE POLICY IF NOT EXISTS "pos_org_access" ON points_of_sale
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- Ticket types: scoped to organization
CREATE POLICY IF NOT EXISTS "ticket_types_org_access" ON ticket_types
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- Ticket allocations: scoped to organization
CREATE POLICY IF NOT EXISTS "ticket_allocations_org_access" ON ticket_allocations
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- Collections: scoped to organization
CREATE POLICY IF NOT EXISTS "collections_org_access" ON collections
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- Collection items: scoped to organization
CREATE POLICY IF NOT EXISTS "collection_items_org_access" ON collection_items
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- Subscriptions: scoped to organization
CREATE POLICY IF NOT EXISTS "subscriptions_org_access" ON subscriptions
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- Payments: scoped to organization
CREATE POLICY IF NOT EXISTS "payments_org_access" ON payments
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- Invoices: scoped to organization
CREATE POLICY IF NOT EXISTS "invoices_org_access" ON invoices
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- Audit logs: scoped to organization
CREATE POLICY IF NOT EXISTS "audit_logs_org_access" ON audit_logs
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- Support tickets: scoped to organization
CREATE POLICY IF NOT EXISTS "support_tickets_org_access" ON support_tickets
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- Platform users: only super admins
CREATE POLICY IF NOT EXISTS "platform_users_admin_only" ON platform_users
  FOR ALL USING (public.is_platform_super_admin());

-- Platform audit logs: only super admins
CREATE POLICY IF NOT EXISTS "platform_audit_logs_admin_only" ON platform_audit_logs
  FOR ALL USING (public.is_platform_super_admin());

-- Platform settings: only super admins
CREATE POLICY IF NOT EXISTS "platform_settings_admin_only" ON platform_settings
  FOR ALL USING (public.is_platform_super_admin());

-- ============================================================
-- OPTIWIFI - Demandes de licence (renouvellement / nouveau forfait)
-- Le client demande, le super admin valide et active la licence.
-- Script idempotent : peut être rejoué sans effet de bord.
-- ============================================================

CREATE TABLE IF NOT EXISTS license_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id         UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  duration_months INT NOT NULL DEFAULT 1 CHECK (duration_months BETWEEN 1 AND 36),
  type            VARCHAR(20) NOT NULL DEFAULT 'renewal'
                CHECK (type IN ('renewal', 'new', 'upgrade')),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  message         TEXT,
  requested_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  processed_by    UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  processed_at    TIMESTAMPTZ,
  admin_note      TEXT,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_requests_status ON license_requests(status);
CREATE INDEX IF NOT EXISTS idx_license_requests_org_id ON license_requests(organization_id);

-- Une seule demande en attente par organisation
CREATE UNIQUE INDEX IF NOT EXISTS uq_license_requests_one_pending
  ON license_requests(organization_id) WHERE status = 'pending';

DROP TRIGGER IF EXISTS trg_license_requests_updated_at ON license_requests;
CREATE TRIGGER trg_license_requests_updated_at
  BEFORE UPDATE ON license_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE license_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "license_requests_org_access" ON license_requests;
CREATE POLICY "license_requests_org_access" ON license_requests
  FOR ALL USING (
    organization_id = public.current_org_id()
    OR public.is_platform_super_admin()
  );

-- ============================================================
-- OPTIWIFI - Organisation obligatoire sur les allocations de tickets
-- La fonction perform_ticket_exchange (et d'anciens écrans) créaient des
-- allocations sans organization_id : elles devenaient invisibles une fois
-- l'isolation par organisation appliquée.
-- 1. Trigger : organization_id déduit du point de vente à l'insertion.
-- 2. Rattrapage des lignes existantes.
-- Script idempotent : peut être rejoué sans effet de bord.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_allocation_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.pos_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
      FROM points_of_sale WHERE id = NEW.pos_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_allocations_organization_id ON ticket_allocations;
CREATE TRIGGER trg_ticket_allocations_organization_id
  BEFORE INSERT ON ticket_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_allocation_organization_id();

UPDATE ticket_allocations a
   SET organization_id = p.organization_id
  FROM points_of_sale p
 WHERE p.id = a.pos_id
   AND a.organization_id IS NULL
   AND p.organization_id IS NOT NULL;

-- ============================================================
-- OPTIWIFI - Colonnes updated_at manquantes
-- Le trigger set_updated_at (BEFORE UPDATE) est attaché à ces tables mais la
-- colonne updated_at n'existe pas : toute mise à jour échoue
-- (« record "new" has no field "updated_at" »), y compris les mises à jour
-- en cascade (ON DELETE SET NULL lors de la suppression d'un compte).
-- Concerne notamment la modification d'un encaissement (collections).
-- Script idempotent : peut être rejoué sans effet de bord.
-- ============================================================

ALTER TABLE collections        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE collection_items   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE audit_logs         ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE platform_audit_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- OPTIWIFI - Notifications (in-app + push navigateur)
-- Script idempotent : peut être rejoué sans effet de bord.
-- ============================================================

-- Notification destinée à un compte (client ou super admin)
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(60) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  link        VARCHAR(300),
  -- Évite les doublons pour les rappels automatiques (ex. licence qui expire)
  dedupe_key  VARCHAR(200),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedupe ON notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Abonnements aux notifications push du navigateur (un par appareil / navigateur)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   VARCHAR(300),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Accès uniquement par l'API serveur (jamais via /api/db)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABLE: payment_methods (moyens de paiement des licences)
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_methods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,   -- numéro de paiement (copiable)
  account_name   VARCHAR(100),           -- titulaire du compte
  whatsapp_url   VARCHAR(300),           -- lien WhatsApp pour le justificatif ; vide = wa.me/<account_number>
  description    TEXT,
  logo           TEXT CHECK (logo IS NULL OR (logo LIKE 'data:image/%' AND length(logo) <= 1000000)),  -- QR code
  brand_logo     TEXT CHECK (brand_logo IS NULL OR (brand_logo LIKE 'data:image/%' AND length(brand_logo) <= 300000)),
  brand_color    VARCHAR(7) CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9a-fA-F]{6}$'),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Rattrapage si la table existait déjà (première version de ce script)
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS whatsapp_url VARCHAR(300);
ALTER TABLE payment_methods DROP COLUMN IF EXISTS receipt_number;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS brand_logo TEXT
  CHECK (brand_logo IS NULL OR (brand_logo LIKE 'data:image/%' AND length(brand_logo) <= 300000));
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS brand_color VARCHAR(7)
  CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_logo_check;
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_logo_check
  CHECK (logo IS NULL OR (logo LIKE 'data:image/%' AND length(logo) <= 1000000));

CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active, sort_order);

DROP TRIGGER IF EXISTS trg_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER trg_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Accès uniquement par l'API serveur (jamais via /api/db)
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Demande de licence : moyen utilisé et référence de la transaction (facultatifs)
ALTER TABLE license_requests ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL;
ALTER TABLE license_requests ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

-- ============================================================
-- Factures de licence (paiement + facture émis à l'activation)
-- ============================================================

-- Numérotation continue des factures : OPT-<année>-<n° sur 5 chiffres>
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS license_request_id UUID REFERENCES license_requests(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS plan_name VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quantity INT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS duration_months INT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);
-- Client facturé, figé à l'émission : { name, contact_name, email, phone, address }
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billed_to JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_number ON invoices(invoice_number);
-- Une seule facture par licence (pas de doublon si l'activation est rejouée)
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_subscription ON invoices(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_org_issued ON invoices(organization_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id, paid_at DESC);

-- Accès uniquement par l'API serveur (jamais via /api/db)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INITIAL DATA
-- ============================================================
-- Default data is inserted by migration script from backup or
-- by the application at runtime for fresh installs

-- ============================================================
-- Support : tickets par client, numérotés, fil de discussion
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq;

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(20);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'other';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'normal';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS opened_by_support BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_category_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_category_check
  CHECK (category IN ('billing', 'technical', 'account', 'other'));
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_priority_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_priority_check
  CHECK (priority IN ('low', 'normal', 'high'));

-- Auteur : un compte (client ou super admin), plus seulement un profil client
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_created_by_fkey;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Tickets existants : organisation déduite de l'auteur, numéro attribué
UPDATE support_tickets t SET organization_id = p.organization_id
  FROM profiles p WHERE p.id = t.created_by AND t.organization_id IS NULL;
UPDATE support_tickets
   SET ticket_number = 'SUP-' || lpad(nextval('support_ticket_number_seq')::text, 5, '0')
 WHERE ticket_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_support_tickets_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(organization_id, last_message_at DESC);

-- Fil de discussion d'un ticket (le premier message est celui de la création)
CREATE TABLE IF NOT EXISTS support_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name    VARCHAR(255),
  from_support   BOOLEAN NOT NULL DEFAULT false,
  body           TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id, created_at);

-- Message initial des tickets existants repris dans le fil
INSERT INTO support_messages (ticket_id, author_user_id, author_name, body, created_at)
SELECT t.id, t.created_by, t.client_name, t.message, t.created_at
  FROM support_tickets t
 WHERE NOT EXISTS (SELECT 1 FROM support_messages m WHERE m.ticket_id = t.id);

-- Accès uniquement par l'API serveur (jamais via /api/db)
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Secrets d'intégration saisis dans le back-office (chiffrés)
-- ============================================================

CREATE TABLE IF NOT EXISTS integration_secrets (
  key             VARCHAR(60) PRIMARY KEY,
  value_encrypted TEXT NOT NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Accès uniquement par l'API serveur (jamais via /api/db)
ALTER TABLE integration_secrets ENABLE ROW LEVEL SECURITY;
