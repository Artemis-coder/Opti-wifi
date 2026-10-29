import { NextResponse } from 'next/server';
import { getPlatformUserFromSession, requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import { listPaymentMethods, parsePaymentMethodInput, PAYMENT_METHOD_COLUMNS } from '@/lib/payment-methods';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Colonnes modifiables (noms fixés ici, valeurs toujours paramétrées)
const EDITABLE = [
  'name',
  'account_number',
  'account_name',
  'whatsapp_url',
  'description',
  'logo',
  'brand_logo',
  'brand_color',
  'is_active',
  'sort_order',
] as const;

async function audit(platformUserId: string, action: string, entityId: string, newData: Record<string, unknown> | null) {
  // Les images ne sont pas recopiées dans le journal (data URL volumineuses)
  const data = newData
    ? {
        ...newData,
        ...('logo' in newData ? { logo: newData.logo ? '[image]' : null } : {}),
        ...('brand_logo' in newData ? { brand_logo: newData.brand_logo ? '[image]' : null } : {}),
      }
    : null;
  await query(
    `INSERT INTO platform_audit_logs (platform_user_id, action, entity_type, entity_id, new_data)
     VALUES ($1, $2, 'payment_method', $3, $4)`,
    [platformUserId, action, entityId, data ? JSON.stringify(data) : null]
  ).catch((err) => console.error('Payment method audit error:', err));
}

export async function GET() {
  const auth = await getPlatformUserFromSession();
  if (!auth.authenticated) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  try {
    return NextResponse.json({ data: await listPaymentMethods(false) });
  } catch (err) {
    console.error('Payment methods GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des moyens de paiement' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parsePaymentMethodInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;

  try {
    const { rows } = await query(
      `INSERT INTO payment_methods (name, account_number, account_name, whatsapp_url, description, logo, brand_logo, brand_color,
                                    is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
               COALESCE($10, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM payment_methods)))
       RETURNING ${PAYMENT_METHOD_COLUMNS}`,
      [
        d.name,
        d.account_number,
        d.account_name ?? null,
        d.whatsapp_url ?? null,
        d.description ?? null,
        d.logo ?? null,
        d.brand_logo ?? null,
        d.brand_color ?? null,
        d.is_active ?? true,
        d.sort_order ?? null,
      ]
    );
    await audit(auth.platformUser.id, 'payment_method_created', rows[0].id, d);
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Payment methods POST error:', err);
    return NextResponse.json({ error: "Erreur lors de l'ajout du moyen de paiement" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Moyen de paiement invalide' }, { status: 400 });
  const parsed = parsePaymentMethodInput(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const fields = EDITABLE.filter((k) => k in parsed.data);
  if (fields.length === 0) return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
  const values = fields.map((k) => parsed.data[k] ?? null);

  try {
    const { rows } = await query(
      `UPDATE payment_methods SET ${fields.map((k, i) => `${k} = $${i + 2}`).join(', ')}
        WHERE id = $1
        RETURNING ${PAYMENT_METHOD_COLUMNS}`,
      [id, ...values]
    );
    if (!rows[0]) return NextResponse.json({ error: 'Moyen de paiement introuvable' }, { status: 404 });
    await audit(auth.platformUser.id, 'payment_method_updated', id, parsed.data);
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Payment methods PATCH error:', err);
    return NextResponse.json({ error: 'Erreur lors de la modification' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get('id') || '';
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Moyen de paiement invalide' }, { status: 400 });

  try {
    // Les demandes de licence qui le citaient gardent leur référence de transaction (payment_method_id → NULL)
    const { rows } = await query('DELETE FROM payment_methods WHERE id = $1 RETURNING id, name', [id]);
    if (!rows[0]) return NextResponse.json({ error: 'Moyen de paiement introuvable' }, { status: 404 });
    await audit(auth.platformUser.id, 'payment_method_deleted', id, { name: rows[0].name });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Payment methods DELETE error:', err);
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
  }
}
