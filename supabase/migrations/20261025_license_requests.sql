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
