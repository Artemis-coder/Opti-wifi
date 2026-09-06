-- ============================================================
-- Add 'pending_approval' value to organization_status enum
-- This is required for the registration flow where new orgs
-- need super admin approval before becoming active.
-- ============================================================

-- Add pending_approval to the enum if not already present
DO $$
BEGIN
  -- Check if 'pending_approval' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'organization_status'::regtype 
    AND enumlabel = 'pending_approval'
  ) THEN
    ALTER TYPE organization_status ADD VALUE 'pending_approval';
  END IF;
END $$;
