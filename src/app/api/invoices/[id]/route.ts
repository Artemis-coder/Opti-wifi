import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { getInvoice, getInvoiceIssuer } from '@/lib/invoices';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Détail d'une facture : administrateur de l'organisation facturée, ou super admin.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });

  try {
    const invoice = await getInvoice(id);
    const allowed =
      !!invoice &&
      (ctx.isPlatformAdmin || (ctx.role === 'administrateur' && ctx.organizationId === invoice.organization_id));
    // Même réponse qu'une facture inexistante : ne révèle pas les factures des autres clients
    if (!invoice || !allowed || invoice.status === 'draft') {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
    }
    return NextResponse.json({ data: { invoice, issuer: await getInvoiceIssuer() } });
  } catch (err) {
    console.error('Invoice GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement de la facture' }, { status: 500 });
  }
}
