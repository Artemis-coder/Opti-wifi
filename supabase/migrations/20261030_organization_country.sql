-- Pays d'une organisation (code ISO 3166-1 alpha-2, ex. CI), déduit de la connexion
-- (en-tête Vercel x-vercel-ip-country) à l'inscription ou à la connexion d'un de ses membres.
-- Sert au KPI « Top 3 des pays » du tableau de bord du back-office. Idempotent.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country CHAR(2);
CREATE INDEX IF NOT EXISTS idx_organizations_country ON organizations (country);
