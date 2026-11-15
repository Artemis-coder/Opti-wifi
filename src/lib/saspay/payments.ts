// ============================================================
// OPTIWIFI - Paiement en ligne des licences (SasPay, checkout hébergé).
//
// Règle d'or : une licence n'est activée QUE par syncOnlinePayment(), après que SasPay a confirmé
// le paiement côté opérateur (GET /payments/{id}/verify/ → SUCCESS). Le webhook, le retour du
// navigateur et le cron ne font que déclencher cette vérification.
//
// Rapprochement : le webhook SasPay ne contient pas notre identifiant de commande. On garde l'id de
// la session de checkout, puis GET /checkout-sessions/{id}/status/ donne l'id de la transaction.
// Idempotence : UPDATE … WHERE status = 'pending' (une seule activation, même avec des appels simultanés).
// ============================================================
import { query } from '@/lib/neon/db';
import { activateLicense } from '@/lib/platform-actions';
import { notifyInBackground, notifySuperAdmins } from '@/lib/notifications';
import { recordSystemError } from '@/lib/system-errors';
import { trackServer } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';
import {
  cancelCheckoutSession,
  createCheckoutSession,
  getCheckoutSessionStatus,
  getSaspayConfig,
  getTransaction,
  SaspayError,
  verifyPayment,
} from '@/lib/saspay/client';

const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
/** Au-delà, une session jamais payée est abandonnée (annulée chez SasPay). */
const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;
/** Une session en cours est reprise (même lien) plutôt que recréée pendant ce délai. */
const RESUME_WITHIN_MS = 30 * 60 * 1000;

export type OnlinePaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'expired';

export interface OnlinePaymentRow {
  id: string;
  organization_id: string;
  plan_id: string;
  status: OnlinePaymentStatus;
  amount: string;
  currency: string;
  duration_months: number;
  checkout_session_id: string | null;
  checkout_url: string | null;
  transaction_id: string | null;
  transaction_reference: string | null;
  subscription_id: string | null;
  invoice_id: string | null;
  failure_reason: string | null;
  created_at: string;
}

export class OnlinePaymentError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

async function loadPayment(id: string): Promise<OnlinePaymentRow | null> {
  const { rows } = await query(`SELECT * FROM online_payments WHERE id = $1`, [id]);
  return (rows[0] as OnlinePaymentRow) || null;
}

/** Message d'erreur SasPay présentable au client (jamais le détail technique). */
function publicMessage(err: unknown): string {
  if (err instanceof SaspayError) {
    if (err.status === 422) return "Ce moyen de paiement n'est pas disponible pour le moment. Réessayez ou payez manuellement.";
    if (err.status === 429) return 'Trop de tentatives, réessayez dans une minute.';
  }
  return 'Le paiement en ligne est momentanément indisponible. Réessayez ou payez manuellement.';
}

// ── Démarrage d'un paiement ──────────────────────────────────────────────────

export async function startOnlinePayment(input: {
  organizationId: string;
  userId: string;
  planId: string;
  /** Origine du site (https://…) : sert à construire l'URL de retour. */
  siteOrigin: string;
}): Promise<{ id: string; checkoutUrl: string; resumed: boolean }> {
  const config = getSaspayConfig();
  if (!config.enabled || !config.environment) {
    throw new OnlinePaymentError("Le paiement en ligne n'est pas disponible pour le moment.", 503);
  }

  const [planRes, accountRes, pendingReqRes] = await Promise.all([
    query(
      `SELECT id, name, price, currency, billing_period FROM subscription_plans WHERE id = $1 AND status = 'active'`,
      [input.planId]
    ),
    query(
      `SELECT o.name AS org_name, o.email AS org_email, o.phone AS org_phone, o.country, o.contact_name,
              p.nom, p.email AS user_email, p.telephone
         FROM organizations o JOIN profiles p ON p.id = $2
        WHERE o.id = $1`,
      [input.organizationId, input.userId]
    ),
    query(`SELECT 1 FROM license_requests WHERE organization_id = $1 AND status = 'pending' LIMIT 1`, [
      input.organizationId,
    ]),
  ]);
  const plan = planRes.rows[0];
  const account = accountRes.rows[0];
  if (!plan) throw new OnlinePaymentError('Forfait introuvable ou inactif', 404);
  if (!account) throw new OnlinePaymentError('Organisation introuvable', 404);
  if (Number(plan.price) <= 0) throw new OnlinePaymentError('Ce forfait ne nécessite pas de paiement', 400);
  if (pendingReqRes.rows[0]) {
    throw new OnlinePaymentError(
      "Une demande de licence est déjà en attente de validation : attendez sa réponse avant de payer en ligne.",
      409
    );
  }
  const currency = String(plan.currency || 'XOF').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new OnlinePaymentError('Devise du forfait invalide', 400);
  // Prix et durée lus à chaque fois dans subscription_plans : un forfait modifié s'applique au paiement suivant
  const months = PERIOD_MONTHS[plan.billing_period] || 1;
  const amount = Number(plan.price).toFixed(2);

  // Paiement déjà en cours : on le resynchronise, puis on le reprend (même forfait, récent) ou on l'annule
  const existing = await query(`SELECT * FROM online_payments WHERE organization_id = $1 AND status = 'pending'`, [
    input.organizationId,
  ]);
  if (existing.rows[0]) {
    const current = await syncOnlinePayment(existing.rows[0].id).catch(() => existing.rows[0] as OnlinePaymentRow);
    if (current.status === 'succeeded') {
      throw new OnlinePaymentError('Votre paiement précédent vient d’être confirmé : votre licence est active.', 409);
    }
    if (current.status === 'pending') {
      const recent = Date.now() - new Date(current.created_at).getTime() < RESUME_WITHIN_MS;
      // Reprise seulement si rien n'a changé (même forfait, même prix, même durée) : sinon nouvelle session
      const samePrice =
        current.plan_id === input.planId &&
        Number(current.amount).toFixed(2) === amount &&
        current.currency === currency &&
        current.duration_months === months;
      if (recent && samePrice && current.checkout_url) {
        return { id: current.id, checkoutUrl: current.checkout_url, resumed: true };
      }
      await abandonPayment(current, samePrice ? 'Remplacé par un nouveau paiement' : 'Prix ou forfait modifié : nouvelle session créée');
      const after = await loadPayment(current.id);
      if (after?.status === 'pending' || after?.status === 'succeeded') {
        throw new OnlinePaymentError('Un paiement est en cours de confirmation. Réessayez dans quelques instants.', 409);
      }
    }
  }

  let id: string;
  try {
    const ins = await query(
      `INSERT INTO online_payments (organization_id, plan_id, requested_by, environment, amount, currency, duration_months)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [input.organizationId, input.planId, input.userId, config.environment, amount, currency, months]
    );
    id = ins.rows[0].id;
  } catch (err) {
    if (err instanceof Error && /uq_online_payments_one_pending/.test(err.message)) {
      throw new OnlinePaymentError('Un paiement est déjà en cours. Réessayez dans quelques instants.', 409);
    }
    throw err;
  }

  try {
    const session = await createCheckoutSession({
      amount,
      currency,
      description: `OptiWifi — licence ${plan.name} (${months} mois)`.slice(0, 200),
      customerEmail: account.org_email || account.user_email,
      customerName: (account.contact_name || account.nom || account.org_name || 'Client OptiWifi').slice(0, 100),
      customerPhone: account.org_phone || account.telephone || null,
      country: typeof account.country === 'string' && /^[A-Z]{2}$/.test(account.country) ? account.country : null,
      returnUrl: `${input.siteOrigin}/subscription/paiement?ref=${id}`,
      metadata: { online_payment_id: id, organization_id: input.organizationId, plan_id: input.planId },
    });
    if (!session.checkout_url) throw new SaspayError('Session sans checkout_url', 502, 'no_checkout_url');
    await query(
      `UPDATE online_payments SET checkout_session_id = $2, checkout_url = $3, updated_at = NOW() WHERE id = $1`,
      [id, session.id, session.checkout_url]
    );
    trackServer(input.userId, EVENTS.onlinePaymentStarted, {
      organization_id: input.organizationId,
      plan_id: input.planId,
      amount: Number(amount),
      currency,
    });
    return { id, checkoutUrl: session.checkout_url, resumed: false };
  } catch (err) {
    // Session non créée : le paiement est clos, le client peut réessayer tout de suite
    const reason = err instanceof Error ? err.message : 'Erreur inconnue';
    await query(
      `UPDATE online_payments SET status = 'failed', failure_reason = $2, updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
      [id, `Création de session : ${reason}`.slice(0, 500)]
    );
    console.error('SasPay checkout creation error:', err instanceof SaspayError ? `${err.status} ${err.code} ${err.message}` : err);
    if (err instanceof SaspayError && (err.status === 401 || err.status === 403)) {
      await recordSystemError('server', `Clé SasPay refusée (${err.status}) : ${err.message}`, { route: 'saspay' });
    }
    throw new OnlinePaymentError(publicMessage(err), 502);
  }
}

/** Annulation par le super admin (back-office) : un paiement confirmé entre-temps est conservé. */
export async function cancelOnlinePayment(id: string, reason = 'Annulé par le support'): Promise<OnlinePaymentRow> {
  const row = await loadPayment(id);
  if (!row) throw new OnlinePaymentError('Paiement introuvable', 404);
  if (row.status !== 'pending') return row;
  await abandonPayment(row, reason);
  return (await loadPayment(id))!;
}

/** Annule la session SasPay d'un paiement jamais payé (ou constate qu'il l'a été entre-temps). */
async function abandonPayment(row: OnlinePaymentRow, reason: string): Promise<void> {
  if (row.checkout_session_id) {
    try {
      await cancelCheckoutSession(row.checkout_session_id);
    } catch (err) {
      // 409 not_pending : la session n'est plus annulable chez SasPay. Payée → on confirme ;
      // sinon (tentative échouée, session close) le paiement est clos ici, sans rester bloqué.
      if (err instanceof SaspayError && err.status === 409) {
        const st = await getCheckoutSessionStatus(row.checkout_session_id);
        const paid = String(st.status).toUpperCase() === 'PAID' || String(st.transaction_status).toUpperCase() === 'SUCCESS';
        if (paid) {
          await syncOnlinePayment(row.id);
          return;
        }
      } else if (!(err instanceof SaspayError && (err.status === 404 || err.status === 410))) {
        throw err;
      }
    }
  }
  await query(
    `UPDATE online_payments SET status = 'cancelled', failure_reason = $2, updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
    [row.id, reason]
  );
}

// ── Synchronisation (seul point de décision) ─────────────────────────────────

/**
 * Interroge SasPay et met le paiement à jour. Active la licence si (et seulement si) le paiement
 * est confirmé. Sans effet sur un paiement déjà terminé. Ne lève pas d'erreur sur un incident
 * réseau : le paiement reste en attente et une synchronisation ultérieure tranchera.
 */
export async function syncOnlinePayment(id: string): Promise<OnlinePaymentRow> {
  const row = await loadPayment(id);
  if (!row) throw new OnlinePaymentError('Paiement introuvable', 404);
  if (row.status !== 'pending') return row;

  if (!row.checkout_session_id) {
    // Création interrompue (session jamais enregistrée)
    if (Date.now() - new Date(row.created_at).getTime() > 10 * 60 * 1000) {
      await query(
        `UPDATE online_payments SET status = 'failed', failure_reason = 'Session de paiement non créée', updated_at = NOW()
          WHERE id = $1 AND status = 'pending'`,
        [id]
      );
    }
    return (await loadPayment(id))!;
  }

  try {
    let session;
    try {
      session = await getCheckoutSessionStatus(row.checkout_session_id);
    } catch (err) {
      if (err instanceof SaspayError && err.status === 410) {
        await query(
          `UPDATE online_payments SET status = 'expired', last_checked_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
          [id]
        );
        return (await loadPayment(id))!;
      }
      throw err;
    }
    const sessionStatus = String(session.status || '').toUpperCase();

    await query(
      `UPDATE online_payments
          SET last_checked_at = NOW(), updated_at = NOW(),
              transaction_id = COALESCE($2, transaction_id),
              transaction_reference = COALESCE($3, transaction_reference)
        WHERE id = $1 AND status = 'pending'`,
      [id, session.transaction_id || null, session.transaction_reference || null]
    );

    if (session.transaction_id) {
      const tx = await verifyPayment(session.transaction_id);
      if (String(tx.status).toUpperCase() === 'SUCCESS') {
        await confirmPayment(row, tx.id, tx);
        return (await loadPayment(id))!;
      }
    }

    const TERMINAL: Record<string, OnlinePaymentStatus> = { CANCELLED: 'cancelled', EXPIRED: 'expired', FAILED: 'failed' };
    if (TERMINAL[sessionStatus]) {
      await query(
        `UPDATE online_payments SET status = $2, failure_reason = COALESCE(failure_reason, $3), updated_at = NOW()
          WHERE id = $1 AND status = 'pending'`,
        [id, TERMINAL[sessionStatus], `Session ${sessionStatus.toLowerCase()} chez SasPay`]
      );
    } else if (Date.now() - new Date(row.created_at).getTime() > ABANDON_AFTER_MS) {
      await abandonPayment(row, 'Session non payée sous 24 h');
    }
  } catch (err) {
    if (err instanceof SaspayError) {
      console.error(`SasPay sync ${id}: ${err.status} ${err.code} ${err.message}`);
      if (err.status === 401 || err.status === 403) {
        await recordSystemError('server', `Clé SasPay refusée pendant la vérification (${err.status})`, { route: 'saspay' });
      }
    } else {
      throw err;
    }
  }
  return (await loadPayment(id))!;
}

/** Paiement confirmé : verrouille le paiement, active la licence, prévient tout le monde. */
async function confirmPayment(
  row: OnlinePaymentRow,
  transactionId: string,
  tx: { reference?: string; requested_amount: string; currency: string; debited_amount?: string | null; net_amount?: string | null; flow_direction?: string; network_code?: string | null }
): Promise<void> {
  if (tx.flow_direction && String(tx.flow_direction).toUpperCase() !== 'INBOUND') {
    await flagIssue(row, `Transaction ${transactionId} inattendue (sens ${tx.flow_direction})`);
    return;
  }
  // Montant : la session a été créée par nous au prix du forfait ; si la devise est la même,
  // le montant de la transaction doit correspondre (une conversion de devise est possible côté SasPay).
  if (tx.currency?.toUpperCase() === row.currency && Number(tx.requested_amount) + 0.01 < Number(row.amount)) {
    await flagIssue(row, `Montant reçu ${tx.requested_amount} ${tx.currency} inférieur au prix ${row.amount} ${row.currency}`);
    return;
  }

  let network = tx.network_code ?? null;
  if (!network) network = await getTransaction(transactionId).then((t) => t.network_code ?? null).catch(() => null);
  const reference = tx.reference || row.transaction_reference || transactionId;

  const claim = await query(
    `UPDATE online_payments
        SET status = 'succeeded', paid_at = NOW(), updated_at = NOW(), transaction_id = $2,
            transaction_reference = $3, amount_charged = $4, amount_net = $5, network = $6
      WHERE id = $1 AND status = 'pending'
      RETURNING id`,
    [row.id, transactionId, reference, tx.debited_amount || null, tx.net_amount || null, network]
  );
  if (!claim.rows[0]) return; // déjà traité par un autre appel (webhook, cron, retour navigateur)

  const result = await activateLicense({
    organizationId: row.organization_id,
    planId: row.plan_id,
    durationMonths: row.duration_months,
    trial: false,
    platformUserId: null,
    note: `Paiement en ligne SasPay ${reference}`,
    paymentMethod: `SasPay${network ? ` (${network})` : ''}`,
    paymentReference: reference,
  }).catch((err) => ({ ok: false as const, status: 500, error: err instanceof Error ? err.message : String(err) }));

  if (!result.ok) {
    await query(`UPDATE online_payments SET failure_reason = $2, updated_at = NOW() WHERE id = $1`, [
      row.id,
      `Paiement reçu mais licence non activée : ${result.error}`.slice(0, 500),
    ]);
    await recordSystemError('server', `Paiement ${reference} reçu mais licence non activée : ${result.error}`, { route: 'saspay' });
    notifyInBackground(() =>
      notifySuperAdmins({
        type: 'payment.issue',
        title: 'Paiement reçu, licence NON activée',
        body: `Le paiement SasPay ${reference} (${row.amount} ${row.currency}) est confirmé mais l'activation a échoué : ${result.error}. Activez la licence à la main.`,
        link: '/platform/payments',
        ring: true,
      })
    );
    return;
  }

  await query(`UPDATE online_payments SET subscription_id = $2, invoice_id = $3, updated_at = NOW() WHERE id = $1`, [
    row.id,
    result.data.subscription_id,
    result.data.invoice_id,
  ]);

  trackServer(`org:${row.organization_id}`, EVENTS.onlinePaymentSucceeded, {
    organization_id: row.organization_id,
    plan_id: row.plan_id,
    amount: Number(row.amount),
    currency: row.currency,
    network,
  });

  notifyInBackground(async () => {
    const org = await query(`SELECT name FROM organizations WHERE id = $1`, [row.organization_id]);
    await notifySuperAdmins({
      type: 'payment.received',
      title: `Paiement en ligne reçu : ${org.rows[0]?.name || 'client'}`,
      body: `${Number(row.amount).toLocaleString('fr-FR')} ${row.currency}${network ? ` via ${network}` : ''} (réf. ${reference}). Licence activée automatiquement.`,
      link: '/platform/payments',
    });
  });
}

/** Incohérence à faire vérifier par un humain : le paiement reste en attente, l'admin est alerté. */
async function flagIssue(row: OnlinePaymentRow, reason: string): Promise<void> {
  const res = await query(
    `UPDATE online_payments SET failure_reason = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'pending' AND failure_reason IS DISTINCT FROM $2 RETURNING id`,
    [row.id, reason.slice(0, 500)]
  );
  if (!res.rows[0]) return; // déjà signalé
  await recordSystemError('server', reason, { route: 'saspay' });
  notifyInBackground(() =>
    notifySuperAdmins({ type: 'payment.issue', title: 'Paiement en ligne à vérifier', body: reason, link: '/platform/payments', ring: true })
  );
}

/**
 * Forfait modifié (prix, devise, durée) ou désactivé : les sessions SasPay encore ouvertes pour ce
 * forfait sont annulées, pour qu'aucun client ne paie l'ancien prix depuis un onglet resté ouvert.
 * Un paiement déjà confirmé entre-temps est conservé (abandonPayment resynchronise sur 409).
 */
export async function cancelPendingPaymentsForPlan(planId: string): Promise<number> {
  const { rows } = await query(`SELECT * FROM online_payments WHERE plan_id = $1 AND status = 'pending'`, [planId]);
  let cancelled = 0;
  for (const row of rows as OnlinePaymentRow[]) {
    try {
      await abandonPayment(row, 'Forfait modifié : session annulée');
      if ((await loadPayment(row.id))?.status === 'cancelled') cancelled++;
    } catch (err) {
      console.error('Cancel pending payment error:', err);
    }
  }
  return cancelled;
}

/** Synchronise les paiements en attente récents (webhook non rattaché, cron de rattrapage). */
export async function syncPendingPayments(opts: { maxAgeHours?: number; limit?: number } = {}): Promise<{
  checked: number;
  succeeded: number;
}> {
  const { rows } = await query(
    `SELECT id FROM online_payments
      WHERE status = 'pending' AND created_at > NOW() - make_interval(hours => $1::int)
      ORDER BY created_at DESC LIMIT $2`,
    [opts.maxAgeHours ?? 48, opts.limit ?? 50]
  );
  let succeeded = 0;
  for (const r of rows) {
    const after = await syncOnlinePayment(r.id).catch((err) => {
      console.error('SasPay pending sync error:', err);
      return null;
    });
    if (after?.status === 'succeeded') succeeded++;
  }
  return { checked: rows.length, succeeded };
}

