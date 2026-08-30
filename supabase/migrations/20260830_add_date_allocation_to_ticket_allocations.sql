ALTER TABLE ticket_allocations
  ADD COLUMN IF NOT EXISTS date_allocation date DEFAULT CURRENT_DATE;

COMMENT ON COLUMN ticket_allocations.date_allocation IS 'Date effective de l''allocation des tickets au point de vente';