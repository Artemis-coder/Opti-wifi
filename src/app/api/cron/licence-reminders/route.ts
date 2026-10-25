import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { notifyOrganizationAdmins } from '@/lib/notifications';

// Rappels de licence (cron quotidien, voir vercel.json) :
// - licence qui expire dans les 7 jours → « demandez le renouvellement »
// - licence expirée depuis moins de 7 jours → « accès coupé, choisissez un forfait »
// Chaque rappel n'est envoyé qu'une fois (dedupe_key par abonnement).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Endpoint non configuré.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    // Licence en cours qui se termine dans les 7 jours, sans autre licence prenant le relais
    const expiring = await query(
      `SELECT s.id, s.organization_id, s.end_date, p.name AS plan, COALESCE(p.trial_days, 0) > 0 AS is_trial
         FROM subscriptions s
         JOIN organizations o ON o.id = s.organization_id
         LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.status IN ('active', 'trialing')
          AND s.end_date BETWEEN NOW() AND NOW() + interval '7 days'
          AND o.status NOT IN ('suspended', 'archived', 'cancelled', 'pending_approval')
          AND NOT EXISTS (
            SELECT 1 FROM subscriptions s2
             WHERE s2.organization_id = s.organization_id AND s2.id <> s.id
               AND s2.status IN ('active', 'trialing') AND s2.end_date > s.end_date
          )`
    );

    // Organisations dont la licence a expiré récemment et qui n'en ont plus aucune en cours
    const expired = await query(
      `SELECT DISTINCT ON (s.organization_id) s.id, s.organization_id, s.end_date
         FROM subscriptions s
         JOIN organizations o ON o.id = s.organization_id
        WHERE o.status NOT IN ('suspended', 'archived', 'cancelled', 'pending_approval')
          AND s.end_date BETWEEN NOW() - interval '7 days' AND NOW()
          AND NOT EXISTS (
            SELECT 1 FROM subscriptions s2
             WHERE s2.organization_id = s.organization_id
               AND s2.status IN ('active', 'trialing') AND (s2.end_date IS NULL OR s2.end_date > NOW())
          )
        ORDER BY s.organization_id, s.end_date DESC`
    );

    const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    for (const s of expiring.rows) {
      await notifyOrganizationAdmins(s.organization_id, {
        type: 'license.expiring',
        title: 'Votre licence expire bientôt',
        body: s.is_trial
          ? `Votre forfait ${s.plan} se termine le ${fmt(s.end_date)}. Choisissez un forfait pour continuer sans interruption.`
          : `Votre forfait ${s.plan} se termine le ${fmt(s.end_date)}. Demandez le renouvellement pour éviter une interruption.`,
        link: '/subscription',
        dedupeKey: `licence-expiring:${s.id}`,
      });
    }

    for (const s of expired.rows) {
      await notifyOrganizationAdmins(s.organization_id, {
        type: 'license.expired',
        title: 'Votre licence a expiré',
        body: `Votre licence a pris fin le ${fmt(s.end_date)} : l’accès à vos données est suspendu. Choisissez un forfait pour le rétablir.`,
        link: '/subscription',
        dedupeKey: `licence-expired:${s.id}`,
      });
    }

    return NextResponse.json({ ok: true, expiring: expiring.rows.length, expired: expired.rows.length });
  } catch (err) {
    console.error('Licence reminders cron error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
