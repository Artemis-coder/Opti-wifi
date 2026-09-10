-- Global Allocation Management - Manual SQL Script
-- Run this in the Supabase SQL Editor for immediate execution without the UI.

-- Replace 'ORG_ID_HERE' with the target organization UUID.
-- This deletes ALL allocations for that organization.
DELETE FROM ticket_allocations
WHERE organization_id = 'ORG_ID_HERE';

-- ⚠️  DANGER: Uncomment the line below to delete EVERY allocation in the database (all organizations).
-- DELETE FROM ticket_allocations;
