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

    // 1. Collecte avec POS et collecteur (le query builder ne gère qu'un niveau de jointure)
    const { data: collection, error } = await supabase
      .from('collections')
      .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
      .eq('id', id)
      .single();

    if (
      error ||
      !collection ||
      !canAccessOrganization(ctx, collection.organization_id || collection.organisation_id)
    ) {
      return NextResponse.json({ error: 'Collecte introuvable' }, { status: 404 });
    }

    // Un collecteur ne consulte que les collectes de ses points de vente
    // Un compte point de vente ne consulte que son propre point de vente
    if (!ctx.isPlatformAdmin && ctx.role !== 'administrateur' && ctx.organizationId) {
      const visible = isPosAccount(ctx)
        ? (ctx.posId ? [ctx.posId] : [])
        : await getVisiblePosIds(ctx.userId, ctx.organizationId);
      if (!visible.includes(collection.pos_id)) {
        return NextResponse.json({ error: 'Collecte introuvable' }, { status: 404 });
      }
    }

    // 2. Items avec le type de ticket
    const { data: items, error: itemsError } = await supabase
      .from('collection_items')
      .select('*, ticket_type:ticket_types(*)')
      .eq('collection_id', id);

    if (itemsError) {
      console.warn('Collection items error:', itemsError);
    }

    if (isPosAccount(ctx)) {
      // Compte point de vente : pas de notes internes
      return NextResponse.json({ ...withoutNotes(collection), items: items || [] });
    }

    return NextResponse.json({ ...collection, items: items || [] });
  } catch (e: unknown) {
    console.error('Collection detail exception:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/** Correction : appliquée par l'administrateur, demande de validation pour un collecteur */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleRecordChange(req, 'collection', id, 'update');
}

/** Suppression : directe pour l'administrateur, demande de validation pour un collecteur */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleRecordChange(req, 'collection', id, 'delete');
}
