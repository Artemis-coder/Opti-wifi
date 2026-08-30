# Plan: POS Detail View + Allocation-Aware Collection Wizard

## Status: Partially Implemented (see completed)

### Already Done & Committed
All of the following was implemented, validated (`tsc` + `eslint` pass), and pushed to GitHub (commit `7485bdc`):

1. **`src/app/(dashboard)/pos/[id]/page.tsx`** — POS detail page with:
   - Info card (name, address, ville, status, collector, creation date)
   - Edit button → opens EditPosModal
   - 4 KPI cards: Tickets Alloués, Tickets Vendus, Tickets Restants, Chiffre d'Affaires
   - Allocation summary table per ticket type (alloués, vendus, restants, CA, écarts)
   - Collection history table (date, montant attendu, montant encaissé, écart, statut)
   - Financial summary (3 columns: expected, collected, global difference)

2. **`src/app/(dashboard)/pos/edit-pos-modal.tsx`** — Reusable POS create/edit modal:
   - Fields: nom, adresse, ville, collecteur (select), statut (select: actif/inactif/suspendu)
   - INSERT when pos=null, UPDATE when pos provided
   - Uses `key` prop + `useState(pos?.field || default)` for form initialization
   - Sonner toasts for success/error

3. **`src/app/(dashboard)/pos/page.tsx`** — Modified:
   - Cards wrapped in `<Link>` to `/pos/[id]`
   - Edit (pencil) button on each card, opens EditPosModal pre-filled
   - Replaced inline create modal with `<EditPosModal>`

4. **`src/app/(dashboard)/tickets/edit-ticket-modal.tsx`** — Reusable ticket edit modal:
   - Fields: nom, duree_heures, prix, actif toggle switch
   - UPDATE via `supabase.from('ticket_types').update()`

5. **`src/app/(dashboard)/tickets/page.tsx`** — Modified:
   - Edit (pencil) button per ticket card → opens EditTicketModal
   - Active/inactive toggle (PauseCircle/PlayCircle icons) → PATCH `actif` field
   - Sonner toasts for all user feedback

6. **`src/app/(dashboard)/dashboard/page.tsx`** — Modified:
   - Added "Tickets Alloués" KPI card (sum of `ticket_allocations.quantite`)
   - Fixed unused `ArrowUpRight` import, fixed apostrophe in "Chiffre d'Affaires"

7. **Pre-existing (committed in earlier commits):**
   - `src/app/api/users/create/route.ts` — API route for auth user + profile creation
   - `src/app/(dashboard)/users/page.tsx` — Users page with API route integration
   - `src/app/layout.tsx` — `<Toaster>` component
   - `supabase/migrations/20260829_init.sql` — Non-fatal trigger
   - `supabase/fix_trigger_telephone.sql` — Manual fix script

### New Requirement: POS-Allocation-Filtered Collection Wizard

The user describes a workflow where the collection wizard (currently at `src/app/(dashboard)/collections/new/page.tsx`) must only show ticket types that have been **allocated to the selected POS**. Currently, it fetches ALL active ticket types regardless of POS.

#### Task: Modify Collection Wizard (`src/app/(dashboard)/collections/new/page.tsx`)

**Current behavior (lines 34-39):**
```tsx
const { data: posData } = await supabase.from('points_of_sale').select('*');
const { data: ticketData } = await supabase.from('ticket_types').select('*').eq('actif', true);
```

**Required behavior:**
1. When a POS is selected (step 1), fetch `ticket_allocations` for that POS joined with `ticket_types`:
   ```ts
   const { data: allocData } = await supabase
     .from('ticket_allocations')
     .select('*, ticket_type:ticket_types(*)')
     .eq('pos_id', posId);
   ```

2. Derive the available ticket types from allocations (only allocated tickets shown):
   ```ts
   const allocatedTickets = allocData.map(a => a.ticket_type);
   const allocatedQtys = allocData.map(a => a.quantite);
   ```

3. In Step 2 (quantity entry), only show ticket types that have allocations for the selected POS, with the allocated quantity displayed as reference (e.g., "Alloué: 100").

4. Validate entered quantities don't exceed allocated quantities (minus previously sold quantities in other collections for this POS).

**Implementation steps:**
- [ ] Add state variables: `allocatedTickets: TicketType[]`, `allocationMap: Record<string, number>` (ticket_type_id → allocated quantity)
- [ ] In `loadOptions()`, after POS selection, fetch allocations for the selected POS
- [ ] Filter step 2 ticket display to only allocated ticket types
- [ ] Show allocated quantity as reference text next to each ticket entry
- [ ] Add validation: entered quantity ≤ (allocated - already sold)
- [ ] Use sonner toasts for validation errors

**Data flow:**
- Step 1: User selects POS → triggers allocation fetch
- Step 2: Only allocated ticket types shown with allocated quantities
- Step 3-5: Unchanged (calcul, amount, validation)

**Edge cases:**
- POS with no allocations → show "Aucun ticket alloué à ce POS" message with link to allocations page
- POS with allocations but all tickets already sold → show warning
- Quantity entered exceeds available stock → validation error

### Manual DBA Step (Blocking)
- Execute `supabase/fix_trigger_telephone.sql` in Supabase SQL Editor
- Required because: auth user creation fails due to RLS on profiles table during GoTrue trigger
- Unblocks the "Créer un Utilisateur" functionality in the users page

### Validation
- `npx tsc --noEmit` — 0 errors ✅
- `npx eslint src/app/\(dashboard\)/pos/ src/app/\(dashboard\)/tickets/ src/app/\(dashboard\)/dashboard/ src/app/\(dashboard\)/collections/ --ext .ts,.tsx` — 0 errors
- Supabase queries return expected shapes with proper joins
