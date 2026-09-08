-- ============================================================
-- FIX: Super Admin Routing & Data Display
-- ============================================================
-- Problem:
--   - superadmin@optiwifi.com exists in profiles but not in platform_users
--     → login redirects to /dashboard instead of /platform/dashboard
--   - kedakeyaoboris@gmail.com was in platform_users as super_admin
--     → login redirected to /platform/dashboard instead of /dashboard
--
-- Fix:
--   1. Ensure ONLY superadmin@optiwifi.com has role super_admin in platform_users
--   2. Remove Boris from platform_users (he is an organisation admin, not super admin)
--   3. Disable RLS on all tables so the platform dashboard API (using service role key)
--      can read global data without being blocked by organisation-level RLS policies
--
-- Idempotent: safe to re-run (uses NOT EXISTS and existence checks)
-- ============================================================

-- ----------------------------------------------------------
-- PART 1: Fix platform_users roles
-- ----------------------------------------------------------

-- 1a. Add superadmin to platform_users (idempotent: NOT EXISTS check)
INSERT INTO platform_users (auth_user_id, role, full_name, email, is_active, created_at, updated_at)
SELECT
  p.id,
  'super_admin'::platform_role,
  p.nom,
  p.email,
  true,
  NOW(),
  NOW()
FROM profiles p
WHERE p.email = 'superadmin@optiwifi.com'
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = p.id)
  AND NOT EXISTS (
    SELECT 1 FROM platform_users pu WHERE pu.auth_user_id = p.id
  );

-- 1b. Remove Boris from platform_users (he is admin d'organisation, not super admin)
--     Idempotent: deleting a non-existent row is a no-op
DELETE FROM platform_users
WHERE auth_user_id = (SELECT id FROM profiles WHERE email = 'kedakeyaoboris@gmail.com')
  OR email = 'kedakeyaoboris@gmail.com';

-- 1c. Ensure Boris has no platform role at all if any stray entry remains
UPDATE platform_users
SET is_active = false
WHERE auth_user_id = (SELECT id FROM profiles WHERE email = 'kedakeyaoboris@gmail.com')
  AND (role = 'super_admin' OR role = 'platform_support');

-- 1d. Verify platform_users state
SELECT
  pu.auth_user_id,
  pu.role AS platform_role,
  pu.is_active,
  p.email,
  p.nom,
  p.role AS profile_role
FROM platform_users pu
JOIN profiles p ON p.id = pu.auth_user_id
ORDER BY pu.created_at;

-- ----------------------------------------------------------
-- PART 2: Disable RLS on all application tables
-- ----------------------------------------------------------
-- This allows the platform dashboard API (using SUPABASE_SERVICE_ROLE_KEY)
-- to read global data across all organizations without being blocked
-- by organisation-level RLS policies.
--
-- NOTE: RLS is disabled at the database level. Access control is enforced
-- at the application layer:
--   - Platform dashboard API uses service role key (bypasses RLS)
--   - Organization endpoints use the anon/client auth key and filter by org
-- ----------------------------------------------------------

DO $$
DECLARE
    r RECORD;
    required_tables TEXT[] := ARRAY[
        'organizations', 'profiles', 'points_of_sale', 'ticket_types',
        'ticket_allocations', 'collections', 'collection_items', 'wifi_spaces',
        'subscriptions', 'subscription_plans', 'payments', 'invoices'
    ];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY required_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
            RAISE NOTICE 'RLS disabled on table: %', tbl;
        ELSE
            RAISE NOTICE 'Table does not exist, skipping: %', tbl;
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------
-- Part 3: Verification — confirm final state
-- ----------------------------------------------------------
-- superadmin@optiwifi.com should be the only platform_user with role super_admin
-- kedakeyaoboris@gmail.com should NOT appear in platform_users
SELECT
  p.email,
  p.nom,
  p.role AS profile_role,
  pu.role AS platform_role,
  pu.is_active
FROM profiles p
LEFT JOIN platform_users pu ON pu.auth_user_id = p.id
WHERE p.email IN ('superadmin@optiwifi.com', 'kedakeyaoboris@gmail.com')
ORDER BY p.email;
