# Feature: Global Allocation Management (Delete/Modify All Allocations)

## Problem
User wants to manage ALL allocations across ALL points of sale:
- Delete all existing allocations globally
- Modify existing allocations
- Start fresh with new allocation data

## Current State
- Allocations stored in `ticket_allocations` table
- Linked to `points_of_sale`, `ticket_types`, `organizations`
- Created via `/allocations/new` page or exchange via `/allocations/exchange`
- Displayed in `/allocations` page grouped by POS
- No UI to bulk delete or modify all allocations

## Plan

### Step 1: Add Bulk Delete Action to Allocations Page
File: `src/app/(dashboard)/allocations/page.tsx`
- Add "Delete All Allocations" button (with confirmation modal)
- Delete all allocations for the current organization
- Use Supabase client to delete from `ticket_allocations` where `organization_id = user.organization_id`

### Step 2: Add Individual Allocation Delete/Edit
File: `src/app/(dashboard)/allocations/page.tsx`
- Add delete button per allocation row
- Add edit button per allocation row (opens modal to modify quantity, notes, etc.)
- Handle optimistic updates

### Step 3: Add API Endpoint for Bulk Operations
File: `src/app/api/allocations/bulk/route.ts` (new)
- POST: Bulk delete by organization_id
- PATCH: Bulk update multiple allocations
- DELETE: Delete all allocations for organization

### Step 4: Add SQL Script for Manual Execution (Backup)
For immediate manual execution in Supabase SQL Editor:

```sql
-- Delete ALL allocations for an organization
DELETE FROM ticket_allocations 
WHERE organization_id = 'ORG_ID_HERE';

-- Or delete ALL allocations globally (use with caution)
-- DELETE FROM ticket_allocations;
```

### Step 5: Verify
- Check allocations page shows empty state after deletion
- Verify new allocations can be created
- Check exchange page stock calculations work with new data

## Files to Modify
- `src/app/(dashboard)/allocations/page.tsx` - Add bulk delete button, individual delete/edit actions
- `src/app/api/allocations/bulk/route.ts` - New API endpoint
- `src/components/ui/Modal.tsx` - Reuse existing modal for confirmations

## Validation
- Manual test: Click "Delete All" → confirm → verify empty state
- Manual test: Click individual delete → confirm → verify row removed
- Manual test: Click individual edit → modify → verify updated
- Verify `npm run lint` passes
- Verify `npx tsc --noEmit` passes

## Open Questions
1. Should bulk delete be restricted to admin role only?
2. Should we add audit logging for bulk operations?
3. Do we need a "restore" feature or is permanent delete acceptable?