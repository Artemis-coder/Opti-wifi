-- Support : nouvelle catégorie « Proposition de fonctionnalité » (feature). Idempotent.
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_category_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_category_check
  CHECK (category IN ('billing', 'technical', 'account', 'feature', 'other'));
