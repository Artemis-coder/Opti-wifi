-- ============================================================
-- OPTIWIFI - Contenu du site vitrine (landing page), géré depuis le back-office
-- Une ligne par section (links, hero, sections, pricing, faq, final_cta, seo) :
-- valeur JSON validée par l'application (src/lib/site-content.ts).
-- Les lignes manquantes sont créées avec le contenu par défaut à la première
-- ouverture de l'onglet « Site vitrine ». Lecture publique via /api/public/site-content.
-- Script idempotent : peut être rejoué sans effet de bord.
-- ============================================================

CREATE TABLE IF NOT EXISTS site_content (
  key         VARCHAR(40) PRIMARY KEY
              CHECK (key IN ('links', 'hero', 'sections', 'pricing', 'faq', 'final_cta', 'seo')),
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Accès uniquement par l'API serveur (jamais via /api/db)
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
