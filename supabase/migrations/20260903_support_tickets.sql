-- ============================================================
-- OPTIWIFI - Support Tickets Table
-- ============================================================

-- Create support_tickets table for tracking client support issues
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

-- Activer RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- Politiques RLS : Admins gerent tous les tickets, utilisateurs voient les tiers ... 
-- Pour le support, seuls les admins (super_admin) peuvent gerer les tickets
DROP POLICY IF EXISTS "Admins gerent les tickets de support" ON support_tickets;
CREATE POLICY "Admins gerent les tickets de support"
    ON support_tickets
    FOR ALL
    USING (is_admin());

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_support_tickets ON support_tickets;
CREATE TRIGGER set_updated_at_support_tickets
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
