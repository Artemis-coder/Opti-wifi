import { type NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/neon/server';
import { query } from '@/lib/neon/db';
import { hashPassword } from '@/lib/neon/auth';

export async function GET(request: NextRequest) {
  try {
    // Réservé au super admin de la plateforme (un administrateur client a aussi le rôle « administrateur »)
    const auth = await requirePlatformAdmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
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

    const params: (string | number)[] = [];
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
      [users.map((u: { id: string }) => u.id)]
    );

    const authMap = new Map(
      (authResult.rows || []).map((au: { id: string; banned_until: string | null }) => [
        au.id,
        au.banned_until ? new Date(au.banned_until) > new Date() : false
      ])
    );

    const enrichedUsers = (users || []).map((u: Record<string, unknown>) => ({
      ...u,
      is_banned: authMap.get(u.id as string) || false,
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Création d'un compte (administrateur ou collecteur) dans une organisation cliente.
// Restauré : la refonte 0757a1d avait supprimé ce handler utilisé par la page.
export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const nom = typeof body.nom === 'string' ? body.nom.trim().slice(0, 255) : '';
  const role = body.role || 'administrateur';
  const organizationId = body.organization_id;
  const telephone = typeof body.telephone === 'string' ? body.telephone.trim().slice(0, 50) || null : null;
  const devise = typeof body.devise === 'string' && body.devise ? body.devise.slice(0, 10) : 'XOF';

  if (!EMAIL_RE.test(email) || !nom) {
    return NextResponse.json({ error: 'Email valide et nom requis.' }, { status: 400 });
  }
  if (!organizationId || !UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: 'Organisation requise.' }, { status: 400 });
  }
  if (!['administrateur', 'collecteur'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }
  if (body.password && (typeof body.password !== 'string' || body.password.length < 6)) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' }, { status: 400 });
  }

  try {
    const org = await query('SELECT id FROM organizations WHERE id = $1', [organizationId]);
    if (!org.rows[0]) {
      return NextResponse.json({ error: 'Organisation introuvable.' }, { status: 404 });
    }
    const existing = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 });
    }

    const plainPassword = body.password || `OptiWifi_${crypto.randomUUID().slice(0, 12)}!`;
    const passwordHash = await hashPassword(plainPassword);

    // Compte et profil créés dans la même requête : tout ou rien
    const { rows } = await query(
      `WITH u AS (
         INSERT INTO users (email, password_hash, email_confirmed, user_metadata, app_metadata, created_at, updated_at)
         VALUES ($1, $2, true, jsonb_build_object('nom', $3::text, 'role', $4::text, 'organization_id', $5::text),
                 jsonb_build_object('role', $4::text, 'must_change_password', true), NOW(), NOW())
         RETURNING id
       )
       INSERT INTO profiles (id, nom, email, role, telephone, devise, organization_id, is_active)
       SELECT u.id, $3, $1, $4::user_role, $6, $7, $5::uuid, true FROM u
       RETURNING id`,
      [email, passwordHash, nom, role, organizationId, telephone, devise]
    );
    const newUserId = rows[0].id;

    await query(
      `INSERT INTO platform_audit_logs (platform_user_id, organization_id, action, entity_type, entity_id, new_data)
       VALUES ($1, $2, 'user.create', 'profile', $3, $4)`,
      [auth.platformUser.id, organizationId, newUserId, JSON.stringify({ email, nom, role })]
    );

    return NextResponse.json({
      success: true,
      message: `Compte « ${nom} » créé avec succès.`,
      data: { id: newUserId, email, role },
      temporary_password: body.password ? undefined : plainPassword,
    });
  } catch (err) {
    console.error('Platform user create error:', err);
    return NextResponse.json({ error: 'Erreur lors de la création du compte.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Réservé au super admin de la plateforme (un administrateur client a aussi le rôle « administrateur »)
    const auth = await requirePlatformAdmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
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
        const passwordHash = await hashPassword(plainPassword);
        // Mot de passe temporaire : l'utilisateur devra choisir le sien à la prochaine connexion
        await query(
          `UPDATE users
              SET password_hash = $1,
                  app_metadata = COALESCE(app_metadata, '{}'::jsonb) || '{"must_change_password": true}'::jsonb,
                  updated_at = NOW()
            WHERE id = $2`,
          [passwordHash, userId]
        );

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