import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getSessionContext, canAccessOrganization, isPosAccount } from '@/lib/tenant';
import { getVisiblePosIds } from '@/lib/collector-scope';
import { handleRecordChange } from '@/lib/record-changes';

async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(undefined, undefined, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
}

/** Retire les notes internes (jamais montrées à un compte point de vente). */
function withoutNotes<T extends Record<string, unknown>>(row: T): Omit<T, 'notes'> {
  const copy: Record<string, unknown> = { ...row };
  delete copy.notes;
  return copy as Omit<T, 'notes'>;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const { id } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: allocation, error: allocError } = await supabase
      .from('ticket_allocations')
      .select('*, pos:points_of_sale(*), ticket_type:ticket_types(*)')
      .eq('id', id)
      .single();

    if (allocError || !allocation || !canAccessOrganization(ctx, allocation.organization_id)) {
      console.error('Allocation detail error:', allocError);
      return NextResponse.json(
        { error: 'Allocation introuvable', details: allocError?.message },
        { status: 404 }
      );
    }

    // Un collecteur ne consulte que les allocations de ses points de vente
    // Un compte point de vente ne consulte que son propre point de vente
    if (!ctx.isPlatformAdmin && ctx.role !== 'administrateur' && ctx.organizationId) {
      const visible = isPosAccount(ctx)
        ? (ctx.posId ? [ctx.posId] : [])
        : await getVisiblePosIds(ctx.userId, ctx.organizationId);
      if (!visible.includes(allocation.pos_id)) {
        return NextResponse.json({ error: 'Allocation introuvable' }, { status: 404 });
      }
    }

    let allocatorProfile = null;
    if (allocation.alloue_par) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', allocation.alloue_par)
        .single();
      allocatorProfile = profile || null;
    }

    let exchangeOperations = [];
    if (allocation.exchange_group_id) {
      const { data: ops } = await supabase
        .from('ticket_allocations')
        .select('*, ticket_type:ticket_types(*)')
        .eq('exchange_group_id', allocation.exchange_group_id)
        .eq('organization_id', allocation.organization_id);
      exchangeOperations = ops || [];
    }

    if (isPosAccount(ctx)) {
      // Compte point de vente : ni notes internes, ni opérations des autres points de vente,
      // ni coordonnées de l'administrateur.
      const allocator = allocatorProfile as { nom?: string } | null;
      return NextResponse.json({
        ...withoutNotes(allocation),
        allocateur: allocator ? { nom: allocator.nom } : null,
        exchangeOperations: (exchangeOperations as Record<string, unknown>[])
          .filter((op) => op.pos_id === allocation.pos_id)
          .map(withoutNotes),
      });
    }

    return NextResponse.json({
      ...allocation,
      allocateur: allocatorProfile,
      exchangeOperations,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    console.error('Allocation detail exception:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Correction : appliquée par l'administrateur, demande de validation pour un collecteur */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleRecordChange(req, 'allocation', id, 'update');
}

/** Suppression : directe pour l'administrateur, demande de validation pour un collecteur */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleRecordChange(req, 'allocation', id, 'delete');
}
