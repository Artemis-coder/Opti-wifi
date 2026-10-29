import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { listPaymentMethods } from '@/lib/payment-methods';

// Moyens de paiement actifs, affichés au client pour payer sa licence.
// Accessible même licence expirée : c'est justement là qu'il doit payer.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const methods = await listPaymentMethods(true);
    const data = methods.map(({ id, name, account_number, account_name, receipt_number, description, logo, brand_logo, brand_color }) => ({
      id,
      name,
      account_number,
      account_name,
      receipt_number,
      description,
      logo,
      brand_logo,
      brand_color,
    }));
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (err) {
    console.error('Payment methods (client) GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des moyens de paiement' }, { status: 500 });
  }
}
