import { NextResponse } from 'next/server';
import { getPlatformUserFromSession, requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import {
  SITE_CONTENT_KEYS,
  SITE_DEFAULTS,
  isSiteContentKey,
  loadPublicPlans,
  loadSiteContent,
  parseSiteContent,
} from '@/lib/site-content';

/**
 * Contenu du site vitrine. GET : tout le contenu + les forfaits (pour choisir
 * celui mis en avant). PUT { key, value } : enregistre une section.
 */
export async function GET() {
  const auth = await getPlatformUserFromSession();
  if (!auth.authenticated) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  try {
    // Première ouverture : le contenu actuel du site est enregistré en base,
    // pour que tout ce qui est affiché sur le site s'y retrouve.
    for (const key of SITE_CONTENT_KEYS) {
      await query(`INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [
        key,
        JSON.stringify(SITE_DEFAULTS[key]),
      ]);
    }
    const [{ content, updatedAt }, plans] = await Promise.all([loadSiteContent(), loadPublicPlans()]);
    return NextResponse.json({ data: { content, updatedAt, plans } });
  } catch (err) {
    console.error('Site content GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement du contenu du site' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as { key?: unknown; value?: unknown };
  if (!isSiteContentKey(body.key)) return NextResponse.json({ error: 'Section inconnue' }, { status: 400 });
  const key = body.key;
  const parsed = parseSiteContent(key, body.value);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { rows: before } = await query(`SELECT value FROM site_content WHERE key = $1`, [key]);
    await query(
      `INSERT INTO site_content (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [key, JSON.stringify(parsed.value), auth.user.id]
    );
    await query(
      `INSERT INTO platform_audit_logs (platform_user_id, action, entity_type, entity_id, old_data, new_data)
       VALUES ($1, 'site_content.update', 'site_content', $4, $2, $3)`,
      [
        auth.platformUser.id,
        before[0] ? JSON.stringify({ [key]: before[0].value }) : null,
        JSON.stringify({ [key]: parsed.value }),
        key,
      ]
    ).catch((err) => console.error('Site content audit error:', err));
    return NextResponse.json({ success: true, data: parsed.value });
  } catch (err) {
    console.error('Site content PUT error:', err);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement" }, { status: 500 });
  }
}
