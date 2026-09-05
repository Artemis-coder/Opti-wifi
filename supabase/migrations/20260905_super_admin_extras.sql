-- ============================================================
-- OPTIWIFI - PHASE 2 EXTRAS: audit cols + export indexes
-- Safe to re-run (all statements idempotent)
-- ============================================================

-- Add user_agent column to platform_audit_logs if missing
ALTER TABLE platform_audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add session_id column to platform_audit_logs if missing
ALTER TABLE platform_audit_logs
  ADD COLUMN IF NOT EXISTS session_id TEXT;


-- support_tickets table (for platform-level support from super admin)
CREATE TABLE IF NOT EXISTS support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  platform_user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  subject         VARCHAR(255) NOT NULL,
  body            TEXT,
  status          VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority        VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SupportTickets: super admin manages all" ON support_tickets;
CREATE POLICY "SupportTickets: super admin manages all" ON support_tickets
  FOR ALL USING (is_platform_super_admin());

-- Add support_ticket_id to platform_audit_logs for ticket tracing
ALTER TABLE platform_audit_logs
  ADD COLUMN IF NOT EXISTS support_ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL;

-- Index for audit log filtering by action and date
CREATE INDEX IF NOT EXISTS idx_platform_audit_action ON platform_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_platform_audit_platform_user ON platform_audit_logs(platform_user_id);

-- Index for subscriptions expiry alerts
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end ON subscriptions(trial_end);

-- Index for organizations search
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);
CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(email);

-- Index for payments filtering
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

-- Index for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Trigger for support_tickets updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_support_tickets') THEN
    CREATE TRIGGER set_updated_at_support_tickets
      BEFORE UPDATE ON support_tickets
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Additional default platform settings (idempotent)
INSERT INTO platform_settings (key, value, description, updated_at) VALUES
  ('support_email',                '"support@optiwifi.ci"',    'Email du support plateforme',                  NOW()),
  ('support_phone',                '""',                        'Téléphone du support',                         NOW()),
  ('notification_before_expiry',   '7',                         'Jours avant expiration pour alerter',          NOW()),
  ('notification_after_expiry',    '1',                         'Jours après expiration pour alerter',          NOW()),
  ('auto_renew_default',           'false',                     'Renouvellement auto par défaut',               NOW()),
  ('max_login_attempts',           '5',                         'Tentatives avant blocage du compte',           NOW()),
  ('session_timeout_minutes',      '30',                        'Durée inactivité avant déconnexion (minutes)', NOW())
ON CONFLICT (key) DO NOTHING;

-- Verification
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c2
   WHERE c2.table_name = t.table_name AND c2.table_schema = 'public') AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'organizations','platform_users','subscription_plans',
    'subscriptions','payments','invoices','platform_audit_logs',
    'platform_settings','support_tickets'
  )
ORDER BY table_name;
