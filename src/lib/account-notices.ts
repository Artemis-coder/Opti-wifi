// ============================================================
// OPTIWIFI - Bandeau d'informations du compte (espace client)
// Une liste d'avis calculés côté serveur : informations à compléter (téléphone…),
// abonnement qui se termine… Pour un nouvel avis, ajouter un bloc ici : le bandeau
// l'affiche sans autre changement.
// ============================================================
import { query } from '@/lib/neon/db';

export interface AccountNotice {
  /** Identifiant stable (sert au « Plus tard » de la session) */
  id: string;
  tone: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  action?: { label: string; href: string };
}

/** Abonnement payant : rappel dans les 10 derniers jours. Essai : pendant tout l'essai. */
const PAID_REMINDER_DAYS = 10;

function when(days: number): string {
  return days <= 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} jours`;
}

export async function getAccountNotices(ctx: {
  userId: string;
  role: string | null;
  organizationId: string | null;
}): Promise<AccountNotice[]> {
  const notices: AccountNotice[] = [];
  const isAdmin = ctx.role === 'administrateur';

  const [profileRes, orgRes, subRes] = await Promise.all([
    query(`SELECT telephone FROM profiles WHERE id = $1`, [ctx.userId]),
    ctx.organizationId && isAdmin
      ? query(`SELECT phone FROM organizations WHERE id = $1`, [ctx.organizationId])
      : Promise.resolve(null),
    ctx.organizationId && isAdmin
      ? query(
          `SELECT s.end_date, p.name AS plan_name, s.trial_end IS NOT NULL AS is_trial,
                  CEIL(EXTRACT(EPOCH FROM (s.end_date - NOW())) / 86400)::int AS days_left
             FROM subscriptions s
             LEFT JOIN subscription_plans p ON p.id = s.plan_id
            WHERE s.organization_id = $1 AND s.status IN ('active', 'trialing') AND s.end_date > NOW()
            ORDER BY s.end_date DESC
            LIMIT 1`,
          [ctx.organizationId]
        )
      : Promise.resolve(null),
  ]);

  // 1. Profil à compléter : numéro de téléphone (le sien, et celui de l'organisation pour le gérant)
  const missingPhone =
    !String(profileRes.rows[0]?.telephone || '').trim() || (orgRes && !String(orgRes.rows[0]?.phone || '').trim());
  if (missingPhone) {
    notices.push({
      id: 'profile.phone',
      tone: 'warning',
      title: 'Complétez votre profil',
      message: 'Ajoutez votre numéro de téléphone pour que nous puissions vous joindre au sujet de votre compte.',
      action: { label: 'Ajouter mon numéro', href: '/settings?complete=phone' },
    });
  }

  // 2. Abonnement qui se termine (licence la plus lointaine : un renouvellement déjà prévu fait foi)
  const sub = subRes?.rows[0];
  if (sub) {
    const days = Number(sub.days_left);
    const end = new Date(sub.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    if (sub.is_trial) {
      notices.push({
        id: `licence.trial.${end}`,
        tone: days <= 1 ? 'danger' : 'info',
        title: `Essai gratuit : fin ${when(days)}`,
        message: `Votre période d'essai se termine le ${end}. Choisissez un forfait pour continuer sans interruption.`,
        action: { label: 'Choisir un forfait', href: '/subscription' },
      });
    } else if (days <= PAID_REMINDER_DAYS) {
      notices.push({
        id: `licence.ending.${end}`,
        tone: days <= 2 ? 'danger' : 'warning',
        title: `Votre abonnement prend fin ${when(days)}`,
        message: `Votre forfait${sub.plan_name ? ` ${sub.plan_name}` : ''} se termine le ${end}. Renouvelez-le pour garder l'accès à vos données.`,
        action: { label: 'Renouveler', href: '/subscription' },
      });
    }
  }

  return notices;
}
