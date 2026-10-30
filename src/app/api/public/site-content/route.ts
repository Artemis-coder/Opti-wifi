import { NextResponse } from 'next/server';
import { loadPublicPlans, loadSiteContent } from '@/lib/site-content';

/**
 * Lecture publique du contenu du site vitrine (aucune authentification).
 * N'expose que le contenu éditorial et les forfaits actifs : aucune donnée client.
 * Le site la relit au plus toutes les 60 s (cache ISR côté site).
 */
export async function GET() {
  try {
    const [{ content, updatedAt }, plans] = await Promise.all([loadSiteContent(), loadPublicPlans()]);
    const hidden = new Set(content.pricing.hidden_plan_ids);
    return NextResponse.json(
      { content, updatedAt, plans: plans.filter((p) => !hidden.has(p.id)) },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err) {
    console.error('Public site content error:', err);
    return NextResponse.json({ error: 'Contenu indisponible' }, { status: 503 });
  }
}
