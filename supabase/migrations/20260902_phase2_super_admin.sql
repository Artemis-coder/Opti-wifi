-- ============================================================
-- OPTIWIFI - PHASE 2: SUPER ADMIN MODULE (SaaS Multi-Tenant)
-- Migration: Plateform tenant tables + multi-tenant isolation
-- Idempotent: safe to re-run
-- ============================================================

-- ----------------------------------------------------------
-- ENUMERATIONS
-- ----------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
    CREATE TYPE organization_status AS ENUM ('trial', 'active', 'expiring', 'expired', 'suspended', 'cancelled', 'archived');
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
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_action') THEN
    CREATE TYPE permission_action AS ENUM ('view', 'edit', 'manage', 'suspend', 'delete');
  END IF;
END $$;

-- ----------------------------------------------------------
-- TABLE: organizations (clients SaaS / tenants)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  contact_name    VARCHAR(255),
  email           VARCHAR(255),
  phone           VARCHAR(50),
  address         TEXT,
  status          organization_status NOT NULL DEFAULT 'trial',
  currency        VARCHAR(10) NOT NULL DEFAULT 'XOF',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- TABLE: platform_users (super admins / support)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role            platform_role NOT NULL DEFAULT 'super_admin',
  full_name       VARCHAR(255),
  email           VARCHAR(255),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- TABLE: subscription_plans (offres commerciales)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  price           DECIMAL(12, 2) NOT NULL,
  currency        VARCHAR(10) NOT NULL DEFAULT 'XOF',
  billing_period  billing_period NOT NULL DEFAULT 'monthly',
  trial_days      INT DEFAULT 14,
  max_users       INT,
  max_points_of_sale INT,
  max_tickets_per_month INT,
  features        JSONB,
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- TABLE: subscriptions (liens org → plan)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id         UUID NOT NULL REFERENCES subscription_plans(id),
  status          subscription_status NOT NULL DEFAULT 'trialing',
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  trial_start     TIMESTAMPTZ,
  trial_end       TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  auto_renew      BOOLEAN DEFAULT false,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- TABLE: payments
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  plan_id         UUID REFERENCES subscription_plans(id),
  amount          DECIMAL(12, 2) NOT NULL,
  currency        VARCHAR(10) NOT NULL DEFAULT 'XOF',
  payment_method  VARCHAR(50),
  transaction_reference VARCHAR(255),
  status          payment_status NOT NULL DEFAULT 'pending',
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- TABLE: invoices
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  invoice_number  VARCHAR(100) NOT NULL,
  amount          DECIMAL(12, 2) NOT NULL,
  currency        VARCHAR(10) NOT NULL DEFAULT 'XOF',
  status          invoice_status NOT NULL DEFAULT 'draft',
  issued_at       TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- TABLE: platform_audit_logs (journal d'audit super admin)
-- ----------------------------------------------------------
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
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- TABLE: platform_settings (paramètres de la plateforme)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
  key             VARCHAR(100) PRIMARY KEY,
  value           JSONB NOT NULL,
  description     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
-- ÉTAPE 1: Ajout des colonnes organization_id sur tables existantes
-- ----------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE wifi_spaces
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE points_of_sale
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE ticket_allocations
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- ----------------------------------------------------------
-- ÉTAPE 2: Index pour les performances multi-tenant
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_wifi_spaces_organization_id ON wifi_spaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_points_of_sale_organization_id ON points_of_sale(organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_organization_id ON ticket_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_organization_id ON ticket_allocations(organization_id);
CREATE INDEX IF NOT EXISTS idx_collections_organization_id ON collections(organization_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_organization_id ON collection_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_entity ON platform_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_created_at ON platform_audit_logs(created_at);

-- ----------------------------------------------------------
-- ÉTAPE 3: Activer RLS sur toutes les nouvelles tables
-- ----------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Re-enable RLS on existing tables (already enabled, but idempotent)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wifi_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_of_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- ÉTAPE 4: Fonctions helper pour le multi-tenant + RBAC
-- ----------------------------------------------------------

-- is_platform_super_admin(): TRUE si l'utilisateur courant est super_admin ou platform_support
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  SET LOCAL row_security = 'off';
  RETURN EXISTS (
    SELECT 1 FROM platform_users
    WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND role IN ('super_admin', 'platform_support')
  );
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- get_user_organization_id(): retourne l'organization_id du profil courant
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  SET LOCAL row_security = 'off';
  SELECT organization_id INTO org_id FROM profiles WHERE id = auth.uid();
  RETURN org_id;
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------
-- ÉTAPE 5: Politiques RLS — platform_users (Super Admin access)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Platform users: super admin manages all" ON platform_users;
DROP POLICY IF EXISTS "Platform users: service role sees all" ON platform_users;
CREATE POLICY "Platform users: super admin manages all" ON platform_users
  FOR ALL USING (is_platform_super_admin());

-- ----------------------------------------------------------
-- ÉTAPE 6: Politiques RLS — organizations
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Orgs: super admin sees all" ON organizations;
DROP POLICY IF EXISTS "Orgs: users see their own" ON organizations;
CREATE POLICY "Orgs: super admin sees all" ON organizations
  FOR ALL USING (is_platform_super_admin());
CREATE POLICY "Orgs: users see their own org" ON organizations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = organizations.id)
  );

-- ----------------------------------------------------------
-- ÉTAPE 7: Politiques RLS — subscription_plans
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Plans: super admin manages all" ON subscription_plans;
DROP POLICY IF EXISTS "Plans: public can view active" ON subscription_plans;
CREATE POLICY "Plans: super admin manages all" ON subscription_plans
  FOR ALL USING (is_platform_super_admin());
CREATE POLICY "Plans: authenticated can view active" ON subscription_plans
  FOR SELECT USING (status = 'active');

-- ----------------------------------------------------------
-- ÉTAPE 8: Politiques RLS — subscriptions
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Subs: super admin sees all" ON subscriptions;
CREATE POLICY "Subs: super admin sees all" ON subscriptions
  FOR ALL USING (is_platform_super_admin());

-- ----------------------------------------------------------
-- ÉTAPE 9: Politiques RLS — payments
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Payments: super admin sees all" ON payments;
CREATE POLICY "Payments: super admin sees all" ON payments
  FOR ALL USING (is_platform_super_admin());

-- ----------------------------------------------------------
-- ÉTAPE 10: Politiques RLS — invoices
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Invoices: super admin sees all" ON invoices;
CREATE POLICY "Invoices: super admin sees all" ON invoices
  FOR ALL USING (is_platform_super_admin());

-- ----------------------------------------------------------
-- ÉTAPE 11: Politiques RLS — platform_audit_logs
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Audit: super admin sees all" ON platform_audit_logs;
CREATE POLICY "Audit: super admin sees all" ON platform_audit_logs
  FOR ALL USING (is_platform_super_admin());

-- ----------------------------------------------------------
-- ÉTAPE 12: Politiques RLS — platform_settings
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Settings: super admin manages all" ON platform_settings;
DROP POLICY IF EXISTS "Settings: public reads active" ON platform_settings;
CREATE POLICY "Settings: super admin manages all" ON platform_settings
  FOR ALL USING (is_platform_super_admin());
CREATE POLICY "Settings: public reads" ON platform_settings
  FOR SELECT USING (true);

-- ----------------------------------------------------------
-- ÉTAPE 13: Mise à jour RLS sur tables existantes (multi-tenant)
-- ----------------------------------------------------------
-- profiles: admin voit tout, utilisateur voit son profil + membres de son org
DROP POLICY IF EXISTS "Admins gerent tous les profils" ON profiles;
DROP POLICY IF EXISTS "Utilisateur voit son profil" ON profiles;
DROP POLICY IF EXISTS "Utilisateur modifie son profil" ON profiles;
DROP POLICY IF EXISTS "Utilisateur cree son profil" ON profiles;
DROP POLICY IF EXISTS "Profiles: super admin sees all" ON profiles;
DROP POLICY IF EXISTS "Profiles: org members see each other" ON profiles;

CREATE POLICY "Profiles: super admin sees all" ON profiles
  FOR ALL USING (is_platform_super_admin() OR is_admin());
CREATE POLICY "Profiles: org members see each other" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR (organization_id IS NOT NULL AND organization_id = get_user_organization_id())
  );
CREATE POLICY "Profiles: users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: users insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- wifi_spaces: super admin sees all, org members see their org's spaces
DROP POLICY IF EXISTS "Users can view all wifi_spaces" ON wifi_spaces;
DROP POLICY IF EXISTS "Admins can insert wifi_spaces" ON wifi_spaces;
DROP POLICY IF EXISTS "Admins can update wifi_spaces" ON wifi_spaces;
DROP POLICY IF EXISTS "Admins can delete wifi_spaces" ON wifi_spaces;

CREATE POLICY "Spaces: super admin and org members see own org" ON wifi_spaces
  FOR SELECT USING (
    is_platform_super_admin() OR is_admin()
    OR organization_id = get_user_organization_id()
  );
CREATE POLICY "Spaces: super admin and org admin manage" ON wifi_spaces
  FOR ALL USING (is_platform_super_admin() OR is_admin());

-- points_of_sale: super admin sees all, org members see their org's POS
DROP POLICY IF EXISTS "Admins gerent les POS" ON points_of_sale;
DROP POLICY IF EXISTS "Collecteurs lisent leurs POS" ON points_of_sale;

CREATE POLICY "POS: super admin and org members see own org" ON points_of_sale
  FOR SELECT USING (
    is_platform_super_admin() OR is_admin()
    OR organization_id = get_user_organization_id()
  );
CREATE POLICY "POS: super admin and org admin manage" ON points_of_sale
  FOR ALL USING (is_platform_super_admin() OR is_admin());

-- ticket_types: super admin sees all, org members see their org's (or global)
DROP POLICY IF EXISTS "Tous voient les tickets actifs" ON ticket_types;
DROP POLICY IF EXISTS "Admins gerent les ticket types" ON ticket_types;

CREATE POLICY "TicketTypes: super admin and org members see own org or global" ON ticket_types
  FOR SELECT USING (
    is_platform_super_admin() OR is_admin()
    OR organization_id IS NULL
    OR organization_id = get_user_organization_id()
  );
CREATE POLICY "TicketTypes: super admin and org admin manage" ON ticket_types
  FOR ALL USING (is_platform_super_admin() OR is_admin());

-- ticket_allocations
DROP POLICY IF EXISTS "Admins gerent les allocations" ON ticket_allocations;
DROP POLICY IF EXISTS "Collecteurs voient leurs allocations" ON ticket_allocations;

CREATE POLICY "Allocations: super admin sees all" ON ticket_allocations
  FOR SELECT USING (
    is_platform_super_admin() OR is_admin()
    OR organization_id = get_user_organization_id()
  );
CREATE POLICY "Allocations: manage by admin/super" ON ticket_allocations
  FOR INSERT WITH CHECK (is_platform_super_admin() OR is_admin());
CREATE POLICY "Allocations: update by admin/super" ON ticket_allocations
  FOR UPDATE USING (is_platform_super_admin() OR is_admin());
CREATE POLICY "Allocations: delete by admin/super" ON ticket_allocations
  FOR DELETE USING (is_platform_super_admin() OR is_admin());

-- collections
DROP POLICY IF EXISTS "Admins gerent toutes les collectes" ON collections;
DROP POLICY IF EXISTS "Collecteurs gerent leurs collectes" ON collections;

CREATE POLICY "Collections: super admin sees all" ON collections
  FOR SELECT USING (
    is_platform_super_admin() OR is_admin()
    OR organization_id = get_user_organization_id()
  );
CREATE POLICY "Collections: manage by admin/super" ON collections
  FOR ALL USING (is_platform_super_admin() OR is_admin());

-- collection_items
DROP POLICY IF EXISTS "Acces items via collection" ON collection_items;

CREATE POLICY "CollectionItems: super admin and accessible via collection" ON collection_items
  FOR ALL USING (
    is_platform_super_admin() OR is_admin()
    OR EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_items.collection_id
      AND (collections.organization_id = get_user_organization_id()
           OR collections.collecteur_id = auth.uid())
    )
  );

-- audit_logs (client-side, existing)
DROP POLICY IF EXISTS "Admins voient les logs" ON audit_logs;
CREATE POLICY "AuditLogs: super admin and admin see" ON audit_logs
  FOR ALL USING (is_platform_super_admin() OR is_admin());

-- ----------------------------------------------------------
-- ÉTAPE 14: Migration des données existantes
-- ----------------------------------------------------------
-- Créer une organisation "default" et assigner tous les profils existants
DO $$
DECLARE
  default_org_id UUID;
  default_plan_id UUID;
BEGIN
  -- Créer l'organisation par défaut si elle n'existe pas
  INSERT INTO organizations (name, contact_name, email, status, currency, created_at, updated_at)
  VALUES ('OptiWifi Default', 'Admin', 'admin@optiwifi.ci', 'active', 'XOF', NOW(), NOW())
  ON CONFLICT DO NOTHING
  RETURNING id INTO default_org_id;

  -- Si l'insert a échoué (déjà existant), récupérer l'ID
  IF default_org_id IS NULL THEN
    SELECT id INTO default_org_id FROM organizations WHERE name = 'OptiWifi Default' LIMIT 1;
  END IF;

  -- Assigner tous les profils existants sans organization_id
  UPDATE profiles
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;

  -- Assigner tous les espaces, POS, tickets, allocations, collections, items
  UPDATE wifi_spaces SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE points_of_sale SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE ticket_types SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE ticket_allocations SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE collections SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE collection_items SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- Créer un plan "Découverte" par défaut
  INSERT INTO subscription_plans
    (name, description, price, currency, billing_period, trial_days, max_users, max_points_of_sale, max_tickets_per_month, features, status, created_at, updated_at)
  VALUES
    ('Découverte', 'Plan gratuit pour essayer la plateforme', 0, 'XOF', 'monthly', 14, 1, 5, 500,
     '{"basic_reports": true, "wifi_spaces": true}'::jsonb, 'active', NOW(), NOW())
  ON CONFLICT DO NOTHING
  RETURNING id INTO default_plan_id;

  IF default_plan_id IS NULL THEN
    SELECT id INTO default_plan_id FROM subscription_plans WHERE name = 'Découverte' LIMIT 1;
  END IF;

  -- Créer un abonnement par défaut pour l'organisation par défaut
  IF default_org_id IS NOT NULL AND default_plan_id IS NOT NULL THEN
    INSERT INTO subscriptions
      (organization_id, plan_id, status, start_date, end_date, trial_start, trial_end, auto_renew, created_at, updated_at)
    VALUES
      (default_org_id, default_plan_id, 'active', NOW(), NOW() + INTERVAL '3650 days',
       NOW(), NOW() + INTERVAL '3650 days', false, NOW(), NOW())
    ON CONFLICT DO NOTHING;
  END IF;

  -- Créer un platform_user pour chaque administrateur existant (migration)
  INSERT INTO platform_users (auth_user_id, role, full_name, email, is_active, created_at, updated_at)
  SELECT
    p.id,
    'super_admin'::platform_role,
    p.nom,
    p.email,
    true,
    NOW(),
    NOW()
  FROM profiles p
  WHERE p.role = 'administrateur'
  ON CONFLICT (auth_user_id) DO NOTHING;

  RAISE NOTICE 'Migration completed: organization=%', default_org_id;
END $$;

-- ----------------------------------------------------------
-- ÉTAPE 15: Paramètres par défaut de la plateforme
-- ----------------------------------------------------------
INSERT INTO platform_settings (key, value, description, updated_at) VALUES
  ('platform_name', '"OptiWifi"', 'Nom de la plateforme', NOW()),
  ('platform_logo', '"/assets/logo.jpg"', 'Logo de la plateforme', NOW()),
  ('platform_currency', '"XOF"', 'Devise principale', NOW()),
  ('trial_days', '14', 'Durée d''essai gratuit en jours', NOW()),
  ('grace_period_days', '3', 'Période de grâce après expiration', NOW()),
  ('maintenance_mode', 'false', 'Active/désactive le mode maintenance', NOW()),
  ('maintenance_message', '"La plateforme est actuellement en maintenance. Nous revenons très bientôt."', 'Message de maintenance', NOW()),
  ('allow_registration', 'true', 'Autoriser la création de comptes', NOW())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = NOW();

-- ----------------------------------------------------------
-- ÉTAPE 16: Triggers pour updated_at automatique
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers individuellement (idempotents)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_organizations') THEN
    CREATE TRIGGER set_updated_at_organizations
      BEFORE UPDATE ON organizations
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_subscriptions') THEN
    CREATE TRIGGER set_updated_at_subscriptions
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_platform_users') THEN
    CREATE TRIGGER set_updated_at_platform_users
      BEFORE UPDATE ON platform_users
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_subscription_plans') THEN
    CREATE TRIGGER set_updated_at_subscription_plans
      BEFORE UPDATE ON subscription_plans
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_platform_settings') THEN
    CREATE TRIGGER set_updated_at_platform_settings
      BEFORE UPDATE ON platform_settings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ----------------------------------------------------------
-- VÉRIFICATION
-- ----------------------------------------------------------
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
