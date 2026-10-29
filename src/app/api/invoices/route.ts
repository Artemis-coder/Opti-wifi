import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { listOrganizationInvoices } from '@/lib/invoices';

// Factures de licence de l'organisation (administrateur du client).
// Accessible même licence expirée : l'historique de paiement reste consultable.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!ctx.organizationId || ctx.role !== 'administrateur') {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }
  try {
    return NextResponse.json({ data: await listOrganizationInvoices(ctx.organizationId) });
  } catch (err) {
    console.error('Invoices GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des factures' }, { status: 500 });
  }
}
