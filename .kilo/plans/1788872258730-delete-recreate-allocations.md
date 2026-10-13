# Fix: Delete and Recreate Allocations for a Point of Sale

## Problem
User wants to:
1. Delete all existing allocations for a specific point of sale
2. Recreate new allocation data for that point of sale

## Current State
- Allocations stored in `ticket_allocations` table
- Linked to `points_of_sale`, `ticket_types`, `organizations`
- Created via `/allocations/new` page or exchange via `/allocations/exchange`
- Displayed in `/allocations` page grouped by POS

## Plan

### Step 1: Identify Target Point of Sale
Need to determine which POS to reset. Options:
- By POS name (e.g., "BorisWifi POS 1")
- By POS ID
- By organization (all POS for an organization)

### Step 2: Delete Existing Allocations
SQL to delete allocations for the target POS:

```sql
-- Option A: Delete by POS ID (most precise)
DELETE FROM ticket_allocations 
WHERE pos_id = 'TARGET_POS_ID';

-- Option B: Delete by POS name (if ID unknown)
DELETE FROM ticket_allocations 
WHERE pos_id IN (
  SELECT id FROM points_of_sale WHERE nom = 'TARGET_POS_NAME' AND organization_id = 'ORG_ID'
);

-- Option C: Delete all allocations for an organization
DELETE FROM ticket_allocations 
WHERE organization_id = 'ORG_ID';
```

### Step 3: Recreate New Allocations
Insert new allocation records:

```sql
-- Insert new allocations for the POS
INSERT INTO ticket_allocations (
  pos_id,
  ticket_type_id,
  quantite,
  notes,
  space_id,
  organization_id,
  date_allocation,
  type,
  statut
)
VALUES 
  ('POS_ID', 'TICKET_TYPE_ID_1', 100, 'Nouvelle allocation initiale', 'SPACE_ID', 'ORG_ID', '2026-09-10', 'allocation', 'actif'),
  ('POS_ID', 'TICKET_TYPE_ID_2', 50, 'Nouvelle allocation initiale', 'SPACE_ID', 'ORG_ID', '2026-09-10', 'allocation', 'actif');
```

### Step 4: Verify
```sql
SELECT 
  ta.id,
  ta.pos_id,
  p.nom AS pos_name,
  ta.ticket_type_id,
  tt.nom AS ticket_name,
  ta.quantite,
  ta.date_allocation,
  ta.type,
  ta.statut
FROM ticket_allocations ta
JOIN points_of_sale p ON p.id = ta.pos_id
JOIN ticket_types tt ON tt.id = ta.ticket_type_id
WHERE ta.pos_id = 'POS_ID'
ORDER BY ta.created_at DESC;
```

## Files to Reference
- `src/app/(dashboard)/allocations/page.tsx` - Display allocations
- `src/app/(dashboard)/allocations/new/page.tsx` - Create new allocations
- `src/app/(dashboard)/allocations/exchange/page.tsx` - Exchange allocations

## Validation
- Verify old allocations deleted
- Verify new allocations created correctly
- Check dashboard displays new data
- Ensure stock calculations work in exchange page

## Questions for User
1. Which specific point of sale should be targeted? (Name or ID)
2. Should this apply to one POS or all POS in an organization?
3. What are the new allocation values (ticket types and quantities)?
4. Should space_id be preserved or set to null?