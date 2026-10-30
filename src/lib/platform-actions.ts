// ============================================================
// OPTIWIFI - Actions super admin partagées (back-office et bot Telegram) :
// activation de licence, refus de demande, changement de statut d'organisation.
// Les règles (essai unique, audit, notification du client) vivent ici une seule fois.
// ============================================================
import { query } from '@/lib/neon/db';
import { hasUsedTrialPlan, isTrialPlan } from '@/lib/trial-plan';
import { notifyInBackground, notifyOrganizationAdmins, type NotificationInput } from '@/lib/notifications';
import { issueLicenseInvoice, type IssuedInvoice } from '@/lib/invoices';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ActionResult<T = Record<string, unknown>> =
  | { ok: true; data: T; message: string }
  | { ok: false; status: number; error: string; code?: string };

const fail = (status: number, error: string, code?: string): ActionResult<never> => ({ ok: false, status, error, code });

function frDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Licences ─────────────────────────────────────────────────────────────────

export interface ActivateLicenseInput {
  organizationId: string;
  planId: string;
  durationMonths: number;
  /**
   * Essai gratuit, seulement pour la première souscription et un forfait avec jours d'essai.
   * Par défaut : essai si l'organisation y a droit ; false pour une première licence payée.
   */
  trial?: boolean;
  /** Essai : durée en jours (par défaut, les jours d'essai du forfait). */
  durationDays?: number | null;
  requestId?: string | null;
  note?: string | null;
  platformUserId: string;
  /** false : pas de notification au client (l'appelant envoie la sienne) */
  notify?: boolean;
}

export const MAX_TRIAL_DAYS = 90;

/**
 * Attribue un forfait pour une durée donnée. La nouvelle période démarre à la fin de la
 * licence en cours (si elle court encore), sinon maintenant. Écritures atomiques.
 * Essai gratuit (première souscription d'un client, forfait avec jours d'essai) : durée en
 * jours, statut « Essai », sans facture. Ensuite, tout forfait, Découverte compris, est une
 * licence payée en mois et facturée.
 */
export async function activateLicense(input: ActivateLicenseInput): Promise<ActionResult<{
  subscription_id: string;
  start_date: string;
  end_date: string;
  organization_status: string;
  invoice_id: string | null;
  invoice_number: string | null;
}>> {
  const { organizationId, planId, requestId, platformUserId } = input;
  if (!UUID_RE.test(organizationId || '') || !UUID_RE.test(planId || '')) return fail(400, 'Organisation et forfait requis');
  if (requestId && !UUID_RE.test(requestId)) return fail(400, 'Demande invalide');
  const adminNote = typeof input.note === 'string' ? input.note.trim().slice(0, 500) || null : null;

  const [orgRes, planRes] = await Promise.all([
    query('SELECT id, name, status FROM organizations WHERE id = $1', [organizationId]),
    query(`SELECT id, name, trial_days FROM subscription_plans WHERE id = $1 AND status = 'active'`, [planId]),
  ]);
  const org = orgRes.rows[0];
  const plan = planRes.rows[0];
  if (!org) return fail(404, 'Organisation introuvable');
  if (!plan) return fail(404, 'Forfait introuvable ou inactif');
  // Essai : seulement à la première souscription ; un client qui revient sur ce forfait paie
  const trialAvailable = isTrialPlan(plan) && !(await hasUsedTrialPlan(organizationId));
  if (input.trial === true && !trialAvailable) {
    return fail(409, `${org.name} n'a plus droit à l'essai gratuit : activez une licence payante.`, 'TRIAL_ALREADY_USED');
  }
  const trial = trialAvailable && input.trial !== false;
  // Essai : en jours ; licence : en mois
  const days = trial ? Number(input.durationDays ?? plan.trial_days) : 0;
  const months = trial ? 0 : Number(input.durationMonths);
  if (trial && (!Number.isInteger(days) || days < 1 || days > MAX_TRIAL_DAYS)) {
    return fail(400, `Durée d'essai invalide (1 à ${MAX_TRIAL_DAYS} jours)`);
  }
  if (!trial && (!Number.isInteger(months) || months < 1 || months > 36)) return fail(400, 'Durée invalide (1 à 36 mois)');

  if (requestId) {
    const reqRes = await query('SELECT status FROM license_requests WHERE id = $1 AND organization_id = $2', [requestId, organizationId]);
    if (!reqRes.rows[0]) return fail(404, 'Demande introuvable');
    if (reqRes.rows[0].status !== 'pending') return fail(409, 'Cette demande a déjà été traitée');
  }

  const { rows } = await query(
    `WITH cur AS (
       SELECT MAX(end_date) FILTER (WHERE status IN ('active', 'trialing') AND end_date > NOW()) AS cur_end
         FROM subscriptions WHERE organization_id = $1
     ),
     superseded AS (
       UPDATE subscriptions SET status = 'expired', updated_at = NOW()
        WHERE organization_id = $1 AND status IN ('active', 'trialing', 'past_due', 'unpaid')
        RETURNING id
     ),
     ins AS (
       INSERT INTO subscriptions (organization_id, plan_id, status, start_date, end_date, trial_end, auto_renew, cancel_at_period_end)
       SELECT $1, $2, CASE WHEN $7::int > 0 THEN 'trialing' ELSE 'active' END::subscription_status,
              p.start_date,
              p.start_date + make_interval(months => $3, days => $7::int),
              CASE WHEN $7::int > 0 THEN p.start_date + make_interval(days => $7::int) END,
              false, false
         FROM cur, LATERAL (SELECT GREATEST(NOW(), COALESCE(cur.cur_end, NOW())) AS start_date) p
       RETURNING id, start_date, end_date
     ),
     org AS (
       UPDATE organizations
          SET status = CASE WHEN status = 'suspended' THEN status ELSE 'active'::organization_status END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING status
     ),
     req AS (
       UPDATE license_requests
          SET status = 'approved', processed_by = $5, processed_at = NOW(), admin_note = $6,
              subscription_id = (SELECT id FROM ins)
        WHERE id = $4 AND organization_id = $1 AND status = 'pending'
        RETURNING id
     )
     SELECT ins.id, ins.start_date, ins.end_date,
            (SELECT status FROM org) AS org_status,
            (SELECT COUNT(*) FROM superseded) AS superseded_count,
            (SELECT COUNT(*) FROM req) AS request_updated
       FROM ins`,
    [organizationId, planId, months, requestId || null, platformUserId, adminNote, days]
  );
  const sub = rows[0];

  await query(
    `INSERT INTO platform_audit_logs (platform_user_id, organization_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1, $2, 'license_activated', 'subscription', $3, $4, $5)`,
    [
      platformUserId,
      organizationId,
      sub.id,
      JSON.stringify({ organization_status: org.status }),
      JSON.stringify({
        plan_id: planId,
        plan_name: plan.name,
        ...(trial ? { duration_days: days } : { duration_months: months }),
        start_date: sub.start_date,
        end_date: sub.end_date,
        request_id: requestId || null,
        note: adminNote,
      }),
    ]
  );

  // Licence payante : paiement + facture, consultable par le client. Un échec ici
  // n'annule pas l'activation (la licence est déjà en place) : il est journalisé.
  let invoice: IssuedInvoice | null = null;
  try {
    invoice = await issueLicenseInvoice({ subscriptionId: sub.id, durationMonths: months, requestId: requestId || null });
  } catch (err) {
    console.error('License invoice error:', err);
  }

  const endLabel = frDate(sub.end_date);
  if (input.notify !== false) notifyInBackground(() =>
    notifyOrganizationAdmins(organizationId, {
      type: 'license.activated',
      title: trial
        ? `Votre période d'essai de ${days} jour${days > 1 ? 's' : ''} est activée`
        : requestId ? 'Votre demande de licence est approuvée' : 'Votre licence est activée',
      body: trial
        ? `Essai gratuit jusqu'au ${endLabel}. Choisissez ensuite un forfait pour continuer.`
        : `Forfait ${plan.name} actif jusqu'au ${endLabel}.${invoice ? ` Facture ${invoice.invoice_number} disponible.` : ''}`,
      link: invoice ? `/subscription/invoices/${invoice.id}` : '/subscription',
    })
  );

  return {
    ok: true,
    data: {
      subscription_id: sub.id,
      start_date: sub.start_date,
      end_date: sub.end_date,
      organization_status: sub.org_status,
      invoice_id: invoice?.id ?? null,
      invoice_number: invoice?.invoice_number ?? null,
    },
    message: trial
      ? `Essai ${plan.name} de ${days} jour${days > 1 ? 's' : ''} activé pour « ${org.name} » jusqu'au ${endLabel}.`
      : `Licence ${plan.name} activée pour « ${org.name} » jusqu'au ${endLabel}.${invoice ? ` Facture ${invoice.invoice_number} émise.` : ''}`,
  };
}

/** Refus d'une demande de licence en attente. */
export async function rejectLicenseRequest(input: { requestId: string; note?: string | null; platformUserId: string }): Promise<ActionResult> {
  const { requestId, platformUserId } = input;
  if (!UUID_RE.test(requestId || '')) return fail(400, 'Requête invalide');
  const adminNote = typeof input.note === 'string' ? input.note.trim().slice(0, 500) || null : null;

  const { rows } = await query(
    `UPDATE license_requests r
        SET status = 'rejected', processed_by = $2, processed_at = NOW(), admin_note = $3
       FROM organizations o
      WHERE r.id = $1 AND r.status = 'pending' AND o.id = r.organization_id
      RETURNING r.id, r.organization_id, o.name`,
    [requestId, platformUserId, adminNote]
  );
  if (!rows[0]) return fail(409, 'Demande introuvable ou déjà traitée');

  await query(
    `INSERT INTO platform_audit_logs (platform_user_id, organization_id, action, entity_type, entity_id, new_data)
     VALUES ($1, $2, 'license_request_rejected', 'license_request', $3, $4)`,
    [platformUserId, rows[0].organization_id, requestId, JSON.stringify({ note: adminNote })]
  );

  const orgId = rows[0].organization_id as string;
  notifyInBackground(() =>
    notifyOrganizationAdmins(orgId, {
      type: 'license_request.rejected',
      title: "Votre demande de licence n'a pas été acceptée",
      body: adminNote ? `Motif : ${adminNote}` : 'Vous pouvez choisir un autre forfait ou contacter le support.',
      link: '/subscription',
    })
  );
  return { ok: true, data: { id: requestId }, message: `Demande de « ${rows[0].name} » refusée.` };
}

// ── Statut des organisations ─────────────────────────────────────────────────

export const ORGANIZATION_ACTIONS = ['approve', 'activate', 'suspend', 'reactivate', 'cancel', 'archive'] as const;
export type OrganizationAction = (typeof ORGANIZATION_ACTIONS)[number];

const NEW_STATUS: Record<OrganizationAction, string> = {
  approve: 'active',
  activate: 'active',
  reactivate: 'active',
  suspend: 'suspended',
  cancel: 'cancelled',
  // Suppression réversible : accès coupé pour tous les membres, données conservées
  archive: 'archived',
};

const ACTION_MESSAGES: Record<OrganizationAction, string> = {
  approve: 'inscription validée',
  activate: 'espace activé',
  reactivate: 'espace réactivé, accès rétabli',
  suspend: 'espace suspendu, accès coupé pour tous ses membres',
  cancel: 'inscription refusée',
  archive: 'organisation supprimée, accès coupé (données conservées, réactivation possible)',
};

export async function setOrganizationStatus(input: {
  organizationId: string;
  action: string;
  reason?: string | null;
  platformUserId: string;
  ipAddress?: string | null;
}): Promise<ActionResult<{ new_status: string; trial: { days: number; end_date: string } | null }>> {
  const { organizationId, platformUserId } = input;
  const action = input.action as OrganizationAction;
  if (!organizationId || !input.action) return fail(400, 'organizationId et action requis');
  if (!ORGANIZATION_ACTIONS.includes(action)) return fail(400, 'Action invalide');
  if (!UUID_RE.test(organizationId)) return fail(404, 'Organisation introuvable');
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) || null : null;

  const orgRes = await query('SELECT id, name, status FROM organizations WHERE id = $1', [organizationId]);
  const org = orgRes.rows[0];
  if (!org) return fail(404, 'Organisation introuvable');

  const newStatus = NEW_STATUS[action];
  await query(`UPDATE organizations SET status = $2::organization_status, updated_at = NOW() WHERE id = $1`, [organizationId, newStatus]);
  await query(
    `INSERT INTO platform_audit_logs (platform_user_id, organization_id, action, entity_type, entity_id, old_data, new_data, ip_address)
     VALUES ($1, $2, $3, 'organization', $4, $5, $6, $7)`,
    [
      platformUserId,
      organizationId,
      `organization.${action}`,
      organizationId,
      JSON.stringify({ status: org.status }),
      JSON.stringify({ status: newStatus, reason }),
      input.ipAddress || null,
    ]
  );

  // Validation d'une inscription sans abonnement : essai gratuit automatique, de la durée
  // définie dans le forfait d'essai (Découverte). Un échec n'empêche pas la validation.
  let trial: { days: number; end_date: string } | null = null;
  if (action === 'approve') {
    try {
      const { rows } = await query(
        `SELECT p.id, p.trial_days FROM subscription_plans p
          WHERE p.status = 'active' AND COALESCE(p.trial_days, 0) > 0
            AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.organization_id = $1)
          ORDER BY p.price ASC, p.trial_days DESC LIMIT 1`,
        [organizationId]
      );
      if (rows[0]) {
        const res = await activateLicense({
          organizationId,
          planId: rows[0].id,
          durationMonths: 0,
          note: 'Essai automatique à la validation de l’inscription',
          platformUserId,
          notify: false,
        });
        if (res.ok) trial = { days: Number(rows[0].trial_days), end_date: res.data.end_date };
        else console.error('Auto trial error:', res.error);
      }
    } catch (err) {
      console.error('Auto trial error:', err);
    }
  }

  const CLIENT_NOTIFICATIONS: Record<OrganizationAction, NotificationInput> = {
    approve: {
      type: 'registration.approved',
      title: 'Votre inscription est validée',
      body: trial
        ? `Bienvenue sur OptiSpace : votre espace est accessible avec un essai gratuit de ${trial.days} jour${trial.days > 1 ? 's' : ''}, jusqu'au ${frDate(trial.end_date)}.`
        : 'Bienvenue sur OptiSpace : votre espace est maintenant accessible.',
      link: '/dashboard',
    },
    cancel: { type: 'registration.rejected', title: "Votre inscription n'a pas été validée", body: reason && reason !== 'Super admin action' ? `Motif : ${reason}` : 'Contactez le support pour plus d’informations.', link: '/login' },
    suspend: { type: 'organization.suspended', title: 'Votre espace a été suspendu', body: 'L’accès à vos données est temporairement coupé. Contactez le support.', link: '/dashboard' },
    reactivate: { type: 'organization.reactivated', title: 'Votre espace est réactivé', body: 'Vous avez de nouveau accès à toutes vos données.', link: '/dashboard' },
    activate: { type: 'organization.reactivated', title: 'Votre espace est activé', body: 'Vous avez accès à toutes vos données.', link: '/dashboard' },
    archive: { type: 'organization.archived', title: 'Votre espace a été fermé', body: 'Contactez le support pour plus d’informations.', link: '/login' },
  };
  notifyInBackground(() => notifyOrganizationAdmins(organizationId, CLIENT_NOTIFICATIONS[action]));

  const trialNote = trial ? ` Essai gratuit de ${trial.days} jour${trial.days > 1 ? 's' : ''} jusqu'au ${frDate(trial.end_date)}.` : '';
  return { ok: true, data: { new_status: newStatus, trial }, message: `« ${org.name} » : ${ACTION_MESSAGES[action]}.${trialNote}` };
}
