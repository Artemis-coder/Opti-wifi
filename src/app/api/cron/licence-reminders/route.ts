import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { notifyOrganizationAdmins } from '@/lib/notifications';
import {
  EXPIRY_REMINDER_DAYS,
  expiringMessage,
  offerLink,
  reminderStage,
  trialEndedMessage,
  trialEndingMessage,
  trialReminderStage,
  type OfferedPlan,
} from '@/lib/licence-reminders';

// Rappels de licence (cron quotidien, voir vercel.json) :
// - licence qui expire : rappels à J-10, J-5 et J-2 → « renouvelez »
// - licence expirée depuis moins de 7 jours → « accès coupé, choisissez un forfait »
// - essai gratuit (forfait avec jours d'essai) : rappels à J-3 et J-1 puis à la fin, en
//   proposant le forfait de base (le moins cher des forfaits payants)
// Chaque rappel n'est envoyé qu'une fois (dedupe_key par abonnement et par palier).

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Endpoint non configuré.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    // Licence en cours qui se termine dans les 10 jours, sans autre licence prenant le relais
    const expiring = await query(
      `SELECT s.id, s.organization_id, s.end_date, p.name AS plan, COALESCE(p.trial_days, 0) > 0 AS is_trial,
              GREATEST(1, CEIL(EXTRACT(EPOCH FROM (s.end_date - s.start_date)) / 86400))::int AS length_days
         FROM subscriptions s
         JOIN organizations o ON o.id = s.organization_id
         LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.status IN ('active', 'trialing')
          AND s.end_date BETWEEN NOW() AND NOW() + make_interval(days => $1)
          AND o.status NOT IN ('suspended', 'archived', 'cancelled', 'pending_approval')
          AND NOT EXISTS (
            SELECT 1 FROM subscriptions s2
             WHERE s2.organization_id = s.organization_id AND s2.id <> s.id
               AND s2.status IN ('active', 'trialing') AND s2.end_date > s.end_date
          )`,
      [Math.max(...EXPIRY_REMINDER_DAYS)]
    );

    // Organisations dont la licence a expiré récemment et qui n'en ont plus aucune en cours
    const expired = await query(
      `SELECT DISTINCT ON (s.organization_id) s.id, s.organization_id, s.end_date, COALESCE(p.trial_days, 0) > 0 AS is_trial
         FROM subscriptions s
         JOIN organizations o ON o.id = s.organization_id
         LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE o.status NOT IN ('suspended', 'archived', 'cancelled', 'pending_approval')
          AND s.end_date BETWEEN NOW() - interval '7 days' AND NOW()
          AND NOT EXISTS (
            SELECT 1 FROM subscriptions s2
             WHERE s2.organization_id = s.organization_id
               AND s2.status IN ('active', 'trialing') AND (s2.end_date IS NULL OR s2.end_date > NOW())
          )
        ORDER BY s.organization_id, s.end_date DESC`
    );

    // Forfait de base proposé à la fin d'un essai
    const base = await query(
      `SELECT id, name, price::float AS price, currency, billing_period FROM subscription_plans
        WHERE status = 'active' AND price > 0 AND COALESCE(trial_days, 0) = 0
        ORDER BY price ASC LIMIT 1`
    );
    const basePlan = (base.rows[0] as OfferedPlan | undefined) ?? null;

    const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    const sent: Record<string, number> = {};
    for (const s of expiring.rows) {
      const daysLeft = Math.ceil((new Date(s.end_date).getTime() - Date.now()) / 86_400_000);
      if (s.is_trial === true) {
        const trialStage = trialReminderStage(daysLeft, Number(s.length_days));
        if (trialStage === null) continue;
        await notifyOrganizationAdmins(s.organization_id, {
          type: 'license.expiring',
          ...trialEndingMessage(daysLeft, fmt(s.end_date), basePlan),
          link: offerLink(basePlan),
          dedupeKey: `trial-ending:${s.id}:j${trialStage}`,
        });
        sent[`essai_j${trialStage}`] = (sent[`essai_j${trialStage}`] || 0) + 1;
        continue;
      }
      const stage = reminderStage(daysLeft);
      if (stage === null) continue;
      const message = expiringMessage(stage, daysLeft, s.plan || 'actuel', fmt(s.end_date), false);
      await notifyOrganizationAdmins(s.organization_id, {
        type: 'license.expiring',
        ...message,
        link: '/subscription',
        // Un rappel par palier (J-10, J-5, J-2) et par licence
        dedupeKey: `licence-expiring:${s.id}:j${stage}`,
      });
      sent[`j${stage}`] = (sent[`j${stage}`] || 0) + 1;
    }

    for (const s of expired.rows) {
      await notifyOrganizationAdmins(s.organization_id, {
        type: 'license.expired',
        ...(s.is_trial === true
          ? trialEndedMessage(fmt(s.end_date), basePlan)
          : {
              title: 'Votre licence a expiré',
              body: `Votre licence a pris fin le ${fmt(s.end_date)} : l’accès à vos données est suspendu. Choisissez un forfait pour le rétablir.`,
            }),
        link: s.is_trial === true ? offerLink(basePlan) : '/subscription',
        dedupeKey: `licence-expired:${s.id}`,
      });
    }

    return NextResponse.json({ ok: true, expiring: expiring.rows.length, stages: sent, expired: expired.rows.length });
  } catch (err) {
    console.error('Licence reminders cron error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
