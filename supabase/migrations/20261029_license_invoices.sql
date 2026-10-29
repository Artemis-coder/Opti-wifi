-- ============================================================
-- OPTIWIFI - Factures de licence
-- À l'activation d'une licence payante (paiement validé par le support), l'application
-- enregistre le paiement (payments) et émet une facture (invoices) consultable par le client.
-- Les informations de facturation sont figées à l'émission (forfait, prix, client).
-- Script idempotent : peut être rejoué sans effet de bord.
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
