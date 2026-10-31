import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { getSessionContext } from '@/lib/tenant';
import { whatsappFromNumber } from '@/lib/whatsapp';

// Contact WhatsApp du support (Paramètres du super admin → « Téléphone du support »),
// avec les informations du compte pour préremplir le message. Accessible à un compte en
// attente de validation (c'est justement là qu'il sert).
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const [settingRes, accountRes] = await Promise.all([
      query(`SELECT value FROM platform_settings WHERE key = 'support_phone'`),
      query(
        `SELECT p.nom, u.email, o.name AS organization_name
           FROM profiles p
           JOIN users u ON u.id = p.id
           LEFT JOIN organizations o ON o.id = p.organization_id
          WHERE p.id = $1`,
        [ctx.userId]
      ),
    ]);
    const raw = settingRes.rows[0]?.value;
    const phone = typeof raw === 'string' ? raw : raw != null ? String(raw) : '';
    const digits = phone.replace(/\D/g, '');
    const a = accountRes.rows[0] || {};
    return NextResponse.json({
      data: {
        whatsapp_url: digits.length >= 8 ? whatsappFromNumber(digits) : null,
        name: a.nom || null,
        email: a.email || null,
        organization_name: a.organization_name || null,
      },
    });
  } catch (err) {
    console.error('Support contact error:', err);
    return NextResponse.json({ error: 'Contact indisponible' }, { status: 500 });
  }
}
