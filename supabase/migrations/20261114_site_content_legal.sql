-- ============================================================
-- OPTIWIFI - CGU et CGV du site vitrine gérées depuis le back-office
-- Ajoute les sections « cgu » et « cgv » à site_content (contenu JSON validé
-- par l'application : src/lib/site-content-schema.ts).
-- Script idempotent : peut être rejoué sans effet de bord.
-- ============================================================

ALTER TABLE site_content DROP CONSTRAINT IF EXISTS site_content_key_check;
ALTER TABLE site_content ADD CONSTRAINT site_content_key_check
  CHECK (key IN ('links', 'hero', 'sections', 'pricing', 'faq', 'final_cta', 'seo', 'cgu', 'cgv'));
