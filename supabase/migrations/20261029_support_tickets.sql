-- ============================================================
-- OPTIWIFI - Support : tickets rattachés au client, numérotés, avec fil de discussion
-- - Le client ouvre un ticket depuis son espace ; le support (super admin) répond, change
--   le statut ; le super admin peut aussi ouvrir un ticket pour un client.
-- - created_by pointait sur profiles : impossible pour le super admin (pas de profil client),
--   la création échouait. L'auteur est désormais un compte (users).
-- Script idempotent : peut être rejoué sans effet de bord.
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
