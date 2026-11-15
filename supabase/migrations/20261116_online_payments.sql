-- Paiement en ligne des licences via SasPay (voir docs/PAIEMENT_SASPAY.md).
-- Idempotente : peut être relancée sans risque. Tables accessibles uniquement par l'API
-- serveur (absentes de la liste blanche de /api/db).

CREATE TABLE IF NOT EXISTS online_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id               UUID NOT NULL REFERENCES subscription_plans(id),
  requested_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  provider              VARCHAR(20) NOT NULL DEFAULT 'saspay',
  environment           VARCHAR(10) NOT NULL CHECK (environment IN ('SANDBOX', 'LIVE')),
  amount                DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  currency              VARCHAR(3) NOT NULL,
  duration_months       INT NOT NULL CHECK (duration_months BETWEEN 1 AND 36),
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'expired')),
  checkout_session_id   VARCHAR(64) UNIQUE,
  checkout_url          TEXT,
  transaction_id        VARCHAR(64) UNIQUE,
  transaction_reference VARCHAR(100),
  amount_charged        DECIMAL(12, 2),
  amount_net            DECIMAL(12, 2),
  network               VARCHAR(40),
  subscription_id       UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id            UUID REFERENCES invoices(id) ON DELETE SET NULL,
  failure_reason        TEXT,
  last_checked_at       TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_online_payments_org ON online_payments(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_online_payments_pending ON online_payments(created_at) WHERE status = 'pending';

-- Un seul paiement en ligne en cours par organisation (double clic, deux onglets)
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_payments_one_pending ON online_payments(organization_id) WHERE status = 'pending';

ALTER TABLE online_payments ENABLE ROW LEVEL SECURITY;

-- Journal des webhooks reçus (audit, diagnostic). Pas de donnée bancaire : payload SasPay tel quel.
CREATE TABLE IF NOT EXISTS saspay_webhook_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type     VARCHAR(60) NOT NULL,
  transaction_id VARCHAR(64),
  signature_ok   BOOLEAN NOT NULL,
  payload        JSONB,
  received_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saspay_webhook_events_received ON saspay_webhook_events(received_at DESC);

ALTER TABLE saspay_webhook_events ENABLE ROW LEVEL SECURITY;
