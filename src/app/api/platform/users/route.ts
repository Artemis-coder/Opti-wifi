import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/neon/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/neon/db';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(undefined, undefined, {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    if (user.role !== 'administrateur') {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const orgFilter = searchParams.get('org');
    const searchFilter = searchParams.get('search');

    let sql = `
      SELECT
        p.id,
        p.nom,
        p.email,
        p.role,
        p.telephone,
        p.devise,
        p.organization_id,
        p.is_active,
        p.deleted_at,
        p.created_at,
        o.name as organization_name,
        o.status as organization_status
      FROM profiles p
      LEFT JOIN organizations o ON p.organization_id = o.id
      WHERE p.role IN ('administrateur', 'collecteur')
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (orgFilter) {
      sql += ` AND p.organization_id = $${paramIndex}`;
      params.push(orgFilter);
      paramIndex++;
    }

    if (searchFilter) {
      sql += ` AND (p.nom ILIKE $${paramIndex} OR p.email ILIKE $${paramIndex})`;
      params.push(`%${searchFilter}%`);
      paramIndex++;
    }

    sql += ` ORDER BY p.created_at DESC`;

    const { rows: users } = await query(sql, params);

    const authResult = await query(
      `SELECT id, banned_until FROM users WHERE id = ANY($1)`,
      [users.map((u: any) => u.id)]
    );

    const authMap = new Map(
      (authResult.rows || []).map((au: any) => [
        au.id,
        au.banned_until ? new Date(au.banned_until) > new Date() : false
      ])
    );

    const enrichedUsers = (users || []).map((u: any) => ({
      ...u,
      is_banned: authMap.get(u.id) || false,
      organization: u.organization_name ? {
        id: u.organization_id,
        name: u.organization_name,
        status: u.organization_status,
      } : null,
    }));

    return NextResponse.json({ data: enrichedUsers });
  } catch (err: unknown) {
    const isDev = process.env.NODE_ENV !== 'production';
    const message = isDev && err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(undefined, undefined, {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.role !== 'administrateur') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId et action requis' }, { status: 400 });
    }

    switch (action) {
      case 'deactivate': {
        await query(`UPDATE profiles SET is_active = false WHERE id = $1`, [userId]);
        await query(`UPDATE users SET banned_until = NOW() + INTERVAL '876000h' WHERE id = $1`, [userId]);
        return NextResponse.json({ success: true, message: 'Utilisateur désactivé' });
      }

      case 'activate': {
        await query(`UPDATE profiles SET is_active = true WHERE id = $1`, [userId]);
        await query(`UPDATE users SET banned_until = NULL WHERE id = $1`, [userId]);
        return NextResponse.json({ success: true, message: 'Utilisateur activé' });
      }

      case 'change_role': {
        const { role: newRole, organization_id } = body;
        if (!newRole || !['administrateur', 'collecteur'].includes(newRole)) {
          return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
        }

        const updateFields = ['role = $2'];
        const params = [userId, newRole];
        let paramIndex = 3;

        if (organization_id) {
          updateFields.push(`organization_id = $${paramIndex}`);
          params.push(organization_id);
          paramIndex++;
        }

        await query(
          `UPDATE profiles SET ${updateFields.join(', ')} WHERE id = $1`,
          params
        );

        await query(
          `UPDATE users SET user_metadata = jsonb_set(
            COALESCE(user_metadata, '{}'::jsonb),
            '{role}',
            to_jsonb($2::text)
          ), app_metadata = jsonb_set(
            COALESCE(app_metadata, '{}'::jsonb),
            '{role}',
            to_jsonb($2::text)
          ) WHERE id = $1`,
          [userId, newRole]
        );

        return NextResponse.json({
          success: true,
          message: `Rôle mis à jour : ${newRole}`,
          data: { id: userId, role: newRole },
        });
      }

      case 'reset_password': {
        const { rows } = await query(`SELECT email FROM profiles WHERE id = $1`, [userId]);
        if (!rows || rows.length === 0) {
          return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
        }

        const plainPassword = `OptiWifi_${crypto.randomUUID().slice(0, 12)}!`;
        const passwordHash = await import('@/lib/neon/auth').then(m => m.hashPassword(plainPassword));
        await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);

        return NextResponse.json({
          success: true,
          message: 'Mot de passe réinitialisé',
          temporary_password: plainPassword,
        });
      }

      default:
        return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }
  } catch (err: unknown) {
    const isDev = process.env.NODE_ENV !== 'production';
    const message = isDev && err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}