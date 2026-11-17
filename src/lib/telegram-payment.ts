// ============================================================
// OPTIWIFI - Menu Telegram « 💳 Paiement en ligne » : statut de SasPay et bascule
// SasPay ↔ paiement manuel en un bouton (même réglage que le back-office).
// Réponses directes, sans passer par l'IA.
// ============================================================
import { query } from '@/lib/neon/db';
import { escapeTelegramHtml, sendTelegramMessage } from '@/lib/telegram';
import { checkSaspayConnection, getSaspayConfig, SaspayError } from '@/lib/saspay/client';
import { getPaymentMode, setPaymentMode, type PaymentMode } from '@/lib/saspay/mode';

export type { PaymentMode };

export const PAYMENT_BUTTON = '💳 Paiement en ligne';
const BTN_STATUS = '🔄 Statut du paiement';

export const PAYMENT_MENU = {
  reply_markup: {
    keyboard: [[{ text: BTN_STATUS }], [{ text: '🔙 Menu Principal' }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

const e = escapeTelegramHtml;
const when = (d: string | Date) =>
  new Date(d).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'short', timeStyle: 'short' });

async function send(chatId: string, text: string, replyMarkup: Record<string, unknown>) {
  await sendTelegramMessage({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup: replyMarkup });
}

export interface PaymentStatus {
  mode: PaymentMode;
  effective: PaymentMode;
  enabled: boolean;
  environment: string | null;
  connection: { ok: boolean; label: string };
  lastWebhook: { event_type: string; signature_ok: boolean; received_at: string } | null;
  day: { ok: number; ko: number; pending: number; to_fix: number };
}

/** Statut : connexion SasPay (test réel de la clé), mode proposé aux clients, dernier webhook, 24 h. */
export async function getPaymentStatus(): Promise<PaymentStatus> {
  const config = getSaspayConfig();
  const mode = await getPaymentMode();
  const effective: PaymentMode = mode === 'saspay' && config.enabled ? 'saspay' : 'manual';

  let connection: PaymentStatus['connection'];
  if (!config.enabled) connection = { ok: false, label: `Indisponible : ${config.problem || 'non configuré'}` };
  else {
    try {
      const { networks } = await checkSaspayConnection();
      connection = { ok: true, label: `Connectée (${networks.length} réseaux ouverts)` };
    } catch (err) {
      const status = err instanceof SaspayError ? err.status : 0;
      connection = {
        ok: false,
        label: status === 401 ? 'Clé refusée par SasPay' : status === 0 ? 'SasPay injoignable' : `Erreur SasPay (HTTP ${status})`,
      };
    }
  }

  const [hook, day] = await Promise.all([
    query(`SELECT event_type, signature_ok, received_at FROM saspay_webhook_events ORDER BY received_at DESC LIMIT 1`),
    query(
      `SELECT COUNT(*) FILTER (WHERE status = 'succeeded')::int AS ok,
              COUNT(*) FILTER (WHERE status IN ('failed', 'expired', 'cancelled'))::int AS ko,
              COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
              COUNT(*) FILTER (WHERE status = 'succeeded' AND subscription_id IS NULL)::int AS to_fix
         FROM online_payments WHERE created_at > NOW() - INTERVAL '24 hours'`
    ),
  ]).catch(() => [{ rows: [] }, { rows: [] }]);
  return {
    mode,
    effective,
    enabled: config.enabled,
    environment: config.environment ?? null,
    connection,
    lastWebhook: (hook.rows[0] as PaymentStatus['lastWebhook']) ?? null,
    day: (day.rows[0] as PaymentStatus['day']) || { ok: 0, ko: 0, pending: 0, to_fix: 0 },
  };
}

/** Bascule SasPay / manuel (chat ou Mini App), avec trace dans le journal d'audit. */
export async function changePaymentMode(mode: PaymentMode, source: string): Promise<{ ok: true; changed: boolean } | { ok: false; error: string }> {
  if (mode === 'saspay' && !getSaspayConfig().enabled) return { ok: false, error: 'SasPay est indisponible : activation impossible pour le moment.' };
  const previous = await getPaymentMode();
  if (previous === mode) return { ok: true, changed: false };
  await setPaymentMode(mode);
  await query(
    `INSERT INTO platform_audit_logs (platform_user_id, action, entity_type, old_data, new_data)
     VALUES (NULL, 'payment_mode_changed', 'platform_settings', $1, $2)`,
    [JSON.stringify({ mode: previous }), JSON.stringify({ mode, source })]
  ).catch((err) => console.error(`payment_mode audit (${source}) error:`, err));
  return { ok: true, changed: true };
}

export async function paymentStatusView(): Promise<{ text: string; keyboard: Record<string, unknown> }> {
  const { mode, effective, enabled: configEnabled, environment, connection: conn, lastWebhook: h, day: d } = await getPaymentStatus();
  const config = { enabled: configEnabled, environment };
  const connection = `${conn.ok ? '✅' : '❌'} ${e(conn.label)}`;

  const lines = [
    '💳 <b>Paiement en ligne (SasPay)</b>',
    '',
    `<b>Proposé aux clients :</b> ${effective === 'saspay' ? '🟢 Paiement en ligne' : '🟠 Paiement manuel'}`,
    mode === 'saspay' && effective === 'manual' ? '<i>SasPay choisi mais indisponible : les clients voient le paiement manuel.</i>' : '',
    `<b>Connexion SasPay${config.environment ? ` (${config.environment === 'LIVE' ? 'réel' : 'test'})` : ''} :</b> ${connection}`,
    `<b>Dernier webhook :</b> ${
      h ? `${e(h.event_type)} · ${when(h.received_at)}${h.signature_ok ? '' : ' · ⚠️ signature refusée'}` : 'aucun reçu'
    }`,
    `<b>24 dernières heures :</b> ✅ ${d.ok} payé${d.ok > 1 ? 's' : ''} · ❌ ${d.ko} non abouti${d.ko > 1 ? 's' : ''} · ⏳ ${d.pending} en attente`,
    d.to_fix > 0 ? `⚠️ <b>${d.to_fix} paiement(s) reçu(s) sans licence activée</b> : à traiter dans Transactions.` : '',
  ].filter(Boolean);

  const toggle =
    effective === 'saspay'
      ? { text: '⏸️ Basculer en paiement manuel', callback_data: 'pay:manual' }
      : config.enabled
        ? { text: '▶️ Activer le paiement en ligne', callback_data: 'pay:saspay' }
        : null;
  const keyboard = {
    inline_keyboard: [...(toggle ? [[toggle]] : []), [{ text: '🔄 Actualiser', callback_data: 'pay:refresh' }]],
  };
  return { text: lines.join('\n'), keyboard };
}

/** Bouton du clavier ou commande /paiement. Renvoie true si le texte a été traité. */
export async function handlePaymentButton(text: string, chatId: string): Promise<boolean> {
  if (text !== PAYMENT_BUTTON && text !== BTN_STATUS && text !== '/paiement') return false;
  if (text === PAYMENT_BUTTON) await send(chatId, '💳 <b>Paiement en ligne</b>', PAYMENT_MENU.reply_markup);
  const view = await paymentStatusView();
  await send(chatId, view.text, view.keyboard);
  return true;
}

/** Boutons sous le statut : pay:manual, pay:saspay, pay:refresh. */
export async function handlePaymentCallback(action: string, chatId: string): Promise<void> {
  if (action === 'manual' || action === 'saspay') {
    const result = await changePaymentMode(action, 'telegram');
    if (!result.ok) {
      await send(chatId, `❌ ${e(result.error)}`, PAYMENT_MENU.reply_markup);
    } else if (result.changed) {
      await send(
        chatId,
        action === 'manual'
          ? '⏸️ <b>Paiement manuel activé</b> : les clients voient de nouveau les moyens manuels (QR code, numéro).'
          : '▶️ <b>Paiement en ligne activé</b> : les clients voient « Passer au paiement » (SasPay).',
        PAYMENT_MENU.reply_markup
      );
    }
  }
  const view = await paymentStatusView();
  await send(chatId, view.text, view.keyboard);
}
