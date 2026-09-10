import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase environment variables are not configured. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local or your deployment environment.'
  );
}

interface BulkDeleteBody {
  organization_id: string;
  allocation_ids?: string[];
}

interface BulkUpdateItem {
  id: string;
  quantite?: number;
  notes?: string | null;
  statut?: string;
}

interface BulkUpdateBody {
  organization_id: string;
  updates: BulkUpdateItem[];
}

async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

async function requireAdmin(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Authentification requise.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Profil utilisateur introuvable.' }, { status: 403 }) };
  }

  if (profile.role !== 'administrateur') {
    return { error: NextResponse.json({ error: 'Accès refusé: privilèges insuffisants.' }, { status: 403 }) };
  }

  return { user, profile };
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const authResult = await requireAdmin(supabase);
  if (authResult.error) {
    return authResult.error;
  }

  const { profile } = authResult;

  try {
    const body: BulkDeleteBody = await request.json();

    if (!body.organization_id) {
      return NextResponse.json({ error: 'organization_id est requis.' }, { status: 400 });
    }

    if (profile.organization_id !== body.organization_id) {
      return NextResponse.json({ error: 'Accès refusé: organisation invalide.' }, { status: 403 });
    }

    let query = supabase
      .from('ticket_allocations')
      .delete()
      .eq('organization_id', body.organization_id);

    if (body.allocation_ids && body.allocation_ids.length > 0) {
      query = query.in('id', body.allocation_ids);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Bulk delete error:', error);
      return NextResponse.json({ error: error.message || 'Erreur lors de la suppression des allocations.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: body.allocation_ids && body.allocation_ids.length > 0
        ? `${body.allocation_ids.length} allocation(s) supprimée(s).`
        : 'Toutes les allocations ont été supprimées.',
    });
  } catch (error: unknown) {
    console.error('Bulk delete error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur. Veuillez contacter l\'administrateur.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const authResult = await requireAdmin(supabase);
  if (authResult.error) {
    return authResult.error;
  }

  const { profile } = authResult;

  try {
    const body: BulkUpdateBody = await request.json();

    if (!body.organization_id) {
      return NextResponse.json({ error: 'organization_id est requis.' }, { status: 400 });
    }

    if (profile.organization_id !== body.organization_id) {
      return NextResponse.json({ error: 'Accès refusé: organisation invalide.' }, { status: 403 });
    }

    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return NextResponse.json({ error: 'Aucune mise à jour fournie.' }, { status: 400 });
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const update of body.updates) {
      const updatePayload: Record<string, unknown> = {};

      if (typeof update.quantite === 'number') {
        updatePayload.quantite = Math.max(0, update.quantite);
      }
      if (typeof update.notes !== 'undefined') {
        updatePayload.notes = update.notes;
      }
      if (typeof update.statut === 'string') {
        updatePayload.statut = update.statut;
      }

      if (Object.keys(updatePayload).length === 0) {
        results.push({ id: update.id, success: false, error: 'Aucun champ à mettre à jour.' });
        continue;
      }

      const { data, error } = await supabase
        .from('ticket_allocations')
        .update(updatePayload)
        .eq('id', update.id)
        .eq('organization_id', body.organization_id)
        .select('id')
        .single();

      if (error) {
        console.error('Update allocation error:', error);
        results.push({ id: update.id, success: false, error: error.message });
      } else {
        results.push({ id: update.id, success: true });
      }
    }

    const failed = results.filter((r) => !r.success);
    const succeeded = results.filter((r) => r.success);

    if (failed.length === 0) {
      return NextResponse.json({
        success: true,
        message: `${succeeded.length} allocation(s) mise(s) à jour.`,
        results,
      });
    }

    return NextResponse.json({
      success: false,
      message: `${succeeded.length} réussie(s), ${failed.length} échouée(s).`,
      results,
    }, { status: 207 });
  } catch (error: unknown) {
    console.error('Bulk update error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur. Veuillez contacter l\'administrateur.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const authResult = await requireAdmin(supabase);
  if (authResult.error) {
    return authResult.error;
  }

  const { profile } = authResult;

  try {
    const body: { organization_id?: string } = await request.json();

    if (!body.organization_id) {
      return NextResponse.json({ error: 'organization_id est requis.' }, { status: 400 });
    }

    if (profile.organization_id !== body.organization_id) {
      return NextResponse.json({ error: 'Accès refusé: organisation invalide.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('ticket_allocations')
      .delete()
      .eq('organization_id', body.organization_id);

    if (error) {
      console.error('Delete all allocations error:', error);
      return NextResponse.json({ error: error.message || 'Erreur lors de la suppression des allocations.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Toutes les allocations ont été supprimées.',
    });
  } catch (error: unknown) {
    console.error('Delete all allocations error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur. Veuillez contacter l\'administrateur.' },
      { status: 500 }
    );
  }
}
