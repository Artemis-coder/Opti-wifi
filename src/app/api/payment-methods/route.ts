import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { listPaymentMethods } from '@/lib/payment-methods';
import { query } from '@/lib/neon/db';
import { countryFromPhone, DEFAULT_COUNTRY, findCountry } from '@/lib/countries';

// Moyens de paiement actifs, affichés au client pour payer sa licence.
// Accessible même licence expirée : c'est justement là qu'il doit payer.
// `default_country` : pays du compte (organisation, sinon téléphone) pour présélectionner
// les moyens de paiement de ce pays.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const [methods, accountRes] = await Promise.all([
      listPaymentMethods(true),
      query(
        `SELECT o.country, o.phone, p.telephone
           FROM profiles p LEFT JOIN organizations o ON o.id = p.organization_id
          WHERE p.id = $1`,
        [ctx.userId]
      ),
    ]);
    const account = accountRes.rows[0] || {};
    const defaultCountry =
      [account.country, countryFromPhone(account.phone), countryFromPhone(account.telephone)].find(
        (c): c is string => typeof c === 'string' && !!findCountry(c)
      ) || DEFAULT_COUNTRY;

    const data = methods.map(
      ({ id, name, account_number, account_name, whatsapp_url, description, logo, brand_logo, brand_color, countries }) => ({
        id,
        name,
        account_number,
        account_name,
        whatsapp_url,
        description,
        logo,
        brand_logo,
        brand_color,
        countries: countries || [],
      })
    );
    return NextResponse.json(
      { data, default_country: defaultCountry },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    );
  } catch (err) {
    console.error('Payment methods (client) GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des moyens de paiement' }, { status: 500 });
  }
}
