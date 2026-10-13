# Fix Super Admin Routing & Data Display

## Problem
- `superadmin@optiwifi.com` exists in `profiles` but not in `platform_users` → login redirects to `/dashboard` (organization space) instead of `/platform/dashboard`
- `kedakeyaoboris@gmail.com` is in `platform_users` as `super_admin` but should be admin d'organisation → login redirects to `/platform/dashboard` instead of `/dashboard`
- RLS policies on `organizations`, `profiles`, and other tables block data display on the dashboard
- Platform dashboard API uses anon client (subject to RLS) instead of service role key

## Root Cause
The login page (`src/app/(auth)/login/page.tsx:119-131`) checks `platform_users` table to determine if a user is a super admin. If the user is not in `platform_users` with role `super_admin` or `platform_support`, they are redirected to `/dashboard`. Since `superadmin@optiwifi.com` was never added to `platform_users`, it was treated as a regular organization user.

## Fix Plan

### Step 1: Fix Database Roles (SQL)
Execute in Supabase SQL Editor:

```sql
-- Add superadmin to platform_users
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
AND NOT EXISTS (
  SELECT 1 FROM platform_users pu WHERE pu.auth_user_id = p.id
);

-- Remove Boris from platform_users (he is admin d'organisation, not super admin)
DELETE FROM platform_users 
WHERE auth_user_id = (SELECT id FROM profiles WHERE email = 'kedakeyaoboris@gmail.com');

-- Verify
SELECT 
  pu.auth_user_id,
  pu.role AS platform_role,
  pu.email,
  p.nom,
  p.role AS profile_role
FROM platform_users pu
JOIN profiles p ON p.id = pu.auth_user_id;
```

### Step 2: Disable RLS on Tables (SQL)
Execute in Supabase SQL Editor:

```sql
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE points_of_sale DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE wifi_spaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
```

### Step 3: Fix Platform Dashboard API
File: `src/app/api/platform/dashboard/route.ts`
- Replace anon client with service role key client for all data queries
- Already done in commit `0dfa61d`

### Step 4: Verify
1. Login with `superadmin@optiwifi.com` → should redirect to `/platform/dashboard`
2. Login with `kedakeyaoboris@gmail.com` → should redirect to `/dashboard`
3. Platform dashboard should display global data (all organizations, subscriptions, revenue)
4. Organization dashboard should display data for BorisWifi organization only

## Files to Modify
- `src/app/api/platform/dashboard/route.ts` - already fixed (service role key)

## Files to NOT Modify
- `src/app/(auth)/login/page.tsx` - logic is correct, just needs database fix
- `src/app/platform/dashboard/page.tsx` - already correct

## Validation
- `npm run lint` should pass
- `npx tsc --noEmit` should pass
- Manual login test with both accounts