import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';

// Paramètres de la plateforme (table platform_settings, clé primaire « key », valeur JSONB).
// Requêtes SQL directes : l'upsert du query builder fait ON CONFLICT (id), colonne absente de cette table.

const KEY_RE = /^[a-z][a-z0-9_]{1,63}$/;
const MAX_VALUE_LENGTH = 2000;

export async function GET() {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { rows } = await query('SELECT key, value, description, updated_at FROM platform_settings ORDER BY key');
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('Platform settings GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des paramètres' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { key, value } = body as { key?: string; value?: unknown };

  if (!key || !KEY_RE.test(key) || value === undefined) {
    return NextResponse.json({ error: 'Paramètre invalide' }, { status: 400 });
  }
  if (!['string', 'number', 'boolean'].includes(typeof value) && value !== null) {
    return NextResponse.json({ error: 'Valeur invalide' }, { status: 400 });
  }
  const json = JSON.stringify(typeof value === 'string' ? value.trim() : value);
  if (json.length > MAX_VALUE_LENGTH) {
    return NextResponse.json({ error: 'Valeur trop longue' }, { status: 400 });
  }

  try {
    const old = await query('SELECT value FROM platform_settings WHERE key = $1', [key]);
    const { rows } = await query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING key, value, updated_at`,
      [key, json]
    );

    await query(
      `INSERT INTO platform_audit_logs (platform_user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
       VALUES ($1, 'platform_settings.update', 'platform_settings', $2, $3, $4, $5)`,
      [
        auth.platformUser.id,
        key,
        JSON.stringify({ value: old.rows[0]?.value ?? null }),
        JSON.stringify({ value: rows[0].value }),
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      ]
    );

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Platform settings PATCH error:', err);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement du paramètre" }, { status: 500 });
  }
}
