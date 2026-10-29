-- ============================================================
-- OPTIWIFI - Moyens de paiement (Wave…)
-- Gérés par le super admin, affichés au client quand il se réabonne, sous forme d'affiche
-- « Payez avec <opérateur> » : couleur et logo de l'opérateur, QR code de paiement de
-- OptiWifi (colonne logo), numéro à copier, lien WhatsApp pour envoyer le justificatif.
-- Images stockées en data URL (préparées dans le navigateur).
-- Script idempotent : peut être rejoué sans effet de bord.
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
