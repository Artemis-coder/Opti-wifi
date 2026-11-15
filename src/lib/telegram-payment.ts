// ============================================================
// OPTIWIFI - Menu Telegram « 💳 Paiement en ligne » : statut de SasPay et bascule
// SasPay ↔ paiement manuel en un bouton (même réglage que le back-office).
// Réponses directes, sans passer par l'IA.
// ============================================================
import { query } from '@/lib/neon/db';
import { escapeTelegramHtml, sendTelegramMessage } from '@/lib/telegram';
import { checkSaspayConnection, getSaspayConfig, SaspayError } from '@/lib/saspay/client';
import { getPaymentMode, setPaymentMode, type PaymentMode } from '@/lib/saspay/mode';

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

/** Statut : connexion SasPay, mode proposé aux clients, dernier webhook, paiements des dernières 24 h. */
export async function paymentStatusView(): Promise<{ text: string; keyboard: Record<string, unknown> }> {
  const config = getSaspayConfig();
  const mode = await getPaymentMode();
  const effective: PaymentMode = mode === 'saspay' && config.enabled ? 'saspay' : 'manual';

  // Test réel de la clé (lecture seule)
  let connection: string;
  if (!config.enabled) connection = `❌ Indisponible : ${e(config.problem || 'non configuré')}`;
  else {
    try {
      const { networks } = await checkSaspayConnection();
      connection = `✅ Connectée (${networks.length} réseaux ouverts)`;
    } catch (err) {
      const status = err instanceof SaspayError ? err.status : 0;
      connection =
        status === 401
          ? '❌ Clé refusée par SasPay'
          : status === 0
            ? '❌ SasPay injoignable'
            : `❌ Erreur SasPay (HTTP ${status})`;
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
  const h = hook.rows[0];
  const d = day.rows[0] || { ok: 0, ko: 0, pending: 0, to_fix: 0 };

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
    const previous = await getPaymentMode();
    if (action === 'saspay' && !getSaspayConfig().enabled) {
      await send(chatId, '❌ SasPay est indisponible : activation impossible pour le moment.', PAYMENT_MENU.reply_markup);
    } else if (previous !== action) {
      await setPaymentMode(action);
      await query(
        `INSERT INTO platform_audit_logs (platform_user_id, action, entity_type, old_data, new_data)
         VALUES (NULL, 'payment_mode_changed', 'platform_settings', $1, $2)`,
        [JSON.stringify({ mode: previous }), JSON.stringify({ mode: action, source: 'telegram' })]
      ).catch((err) => console.error('payment_mode audit (telegram) error:', err));
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
