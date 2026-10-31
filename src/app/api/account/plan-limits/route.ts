import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { getSessionContext } from '@/lib/tenant';

// Limites du forfait en cours (utilisateurs, collecteurs) et utilisation actuelle, avec les
// forfaits disponibles : la page Utilisateurs & équipe prévient avant d'ajouter un membre.
// Les limites sont aussi appliquées côté serveur à la création (/api/users/create).
// Limite : null ou négative = illimitée ; 0 = aucun.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.organizationId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const [subRes, countRes, plansRes] = await Promise.all([
      query(
        `SELECT p.id, p.name, p.max_users, p.max_collectors
           FROM subscriptions s
           JOIN subscription_plans p ON p.id = s.plan_id
          WHERE s.organization_id = $1 AND s.status IN ('active', 'trialing')
            AND (s.end_date IS NULL OR s.end_date > NOW())
          ORDER BY s.created_at DESC
          LIMIT 1`,
        [ctx.organizationId]
      ),
      query(
        `SELECT COUNT(*)::int AS users,
                COUNT(*) FILTER (WHERE role = 'collecteur')::int AS collectors
           FROM profiles
          WHERE organization_id = $1 AND is_active = true`,
        [ctx.organizationId]
      ),
      query(
        `SELECT id, name, price::float AS price, currency, billing_period, trial_days,
                max_users, max_collectors, max_points_of_sale
           FROM subscription_plans
          WHERE status = 'active'
          ORDER BY price ASC`
      ),
    ]);

    const plan = subRes.rows[0] || null;
    const counts = countRes.rows[0] || { users: 0, collectors: 0 };
    const limit = (v: unknown) => (v === null || v === undefined || Number(v) < 0 ? null : Number(v));

    return NextResponse.json({
      data: {
        plan: plan ? { id: plan.id, name: plan.name } : null,
        users: { current: Number(counts.users), limit: plan ? limit(plan.max_users) : null },
        collectors: { current: Number(counts.collectors), limit: plan ? limit(plan.max_collectors) : null },
        plans: plansRes.rows,
      },
    });
  } catch (err) {
    console.error('Plan limits error:', err);
    return NextResponse.json({ error: 'Erreur de chargement des limites' }, { status: 500 });
  }
}
