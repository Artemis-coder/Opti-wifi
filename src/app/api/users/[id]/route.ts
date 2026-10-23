import { adminClient } from '@/lib/neon/admin';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: targetUserId } = await context.params;
    const supabase = adminClient;

    const cookieStore = await cookies();
    const clientSupabase = createServerClient(undefined, undefined, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
      }
    });

    const { data: { user: callerUser } } = await clientSupabase.auth.getUser();
    if (!callerUser) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    // Stats on activity to reassure the administrator
    const [collectionsRes, posRes, allocationsRes] = await Promise.all([
      supabase.from('collections').select('*', { count: 'exact', head: true }).eq('collecteur_id', targetUserId),
      supabase.from('points_of_sale').select('*', { count: 'exact', head: true }).eq('collecteur_id', targetUserId),
      supabase.from('ticket_allocations').select('*', { count: 'exact', head: true }).eq('alloue_par', targetUserId),
    ]);

    return NextResponse.json({
      success: true,
      profile: targetProfile,
      impact: {
        collectionsCount: collectionsRes.count || 0,
        posCount: posRes.count || 0,
        allocationsCount: allocationsRes.count || 0,
      }
    });
  } catch (error: unknown) {
    console.error('Error fetching user details:', error);
    const message = error instanceof Error ? error.message : 'Erreur interne.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: targetUserId } = await context.params;
    const supabase = adminClient;

    const cookieStore = await cookies();
    const clientSupabase = createServerClient(undefined, undefined, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
      }
    });

    const { data: { user: callerUser } } = await clientSupabase.auth.getUser();
    if (!callerUser) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    // Check caller profile and role
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role, organization_id')
      .eq('id', callerUser.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'administrateur') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
    }

    if (callerUser.id === targetUserId) {
      return NextResponse.json({
        error: 'Vous ne pouvez pas supprimer votre propre compte administrateur.'
      }, { status: 400 });
    }

    // Fetch target profile
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    // Check organization boundary
    if (callerProfile.organization_id && targetProfile.organization_id) {
      if (callerProfile.organization_id !== targetProfile.organization_id) {
        return NextResponse.json({ error: 'Accès non autorisé à cet utilisateur.' }, { status: 403 });
      }
    }

    // Prevent deleting the last administrator of the organization
    if (targetProfile.role === 'administrateur') {
      let adminCountQuery = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'administrateur')
        .eq('is_active', true);

      if (targetProfile.organization_id) {
        adminCountQuery = adminCountQuery.eq('organization_id', targetProfile.organization_id);
      }

      const { count: adminCount } = await adminCountQuery;
      if (adminCount !== null && adminCount <= 1) {
        return NextResponse.json({
          error: 'Impossible de supprimer le dernier administrateur actif de l’organisation.'
        }, { status: 400 });
      }
    }

    // 1. Unassign any assigned points of sale so they are freed up for other team members
    await supabase
      .from('points_of_sale')
      .update({ collecteur_id: null, updated_at: new Date().toISOString() })
      .eq('collecteur_id', targetUserId);

    // 2. Mark profile as inactive and soft-deleted
    // Historical collections and allocations continue referencing this profile record,
    // preserving cashier names, totals, and receipts without cascade destruction.
    const { error: profileUpdateErr } = await supabase
      .from('profiles')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    if (profileUpdateErr) {
      console.error('Failed to update profile to inactive:', profileUpdateErr);
      return NextResponse.json({ error: 'Erreur lors de la désactivation du profil.' }, { status: 500 });
    }

    // 3. Ban and revoke auth credentials in users table so they cannot log in
    await supabase.auth.admin.updateUserById(targetUserId, {
      ban_duration: '876000h', // ~100 years
    });

    return NextResponse.json({
      success: true,
      message: `L'utilisateur "${targetProfile.nom}" a été supprimé de l'équipe avec succès. Toutes ses collectes et données historiques restent intégralement préservées dans vos rapports.`,
    });
  } catch (error: unknown) {
    console.error('Error deleting user:', error);
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
