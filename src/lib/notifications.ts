// ============================================================
// OPTIWIFI - Notifications : in-app (table notifications), push navigateur
// (Web Push / VAPID) et Telegram pour le super admin.
// L'envoi ne doit jamais faire échouer l'action qui le déclenche : toutes les
// erreurs sont journalisées et absorbées. Appeler via notifyInBackground()
// depuis une route pour ne pas ralentir la réponse.
// ============================================================
import { after } from 'next/server';
import webpush from 'web-push';
import { query } from '@/lib/neon/db';
import { sendTelegramMessage } from '@/lib/telegram';

export type NotificationType =
  | 'registration.new'
  | 'registration.approved'
  | 'registration.rejected'
  | 'license_request.new'
  | 'license_request.rejected'
  | 'license.activated'
  | 'license.expiring'
  | 'license.expired'
  | 'organization.suspended'
  | 'organization.reactivated'
  | 'organization.archived'
  | 'account.password_reset'
  | 'team.collection_created'
  | 'team.member_added';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  /** Chemin interne vers la page à ouvrir (ex. /platform/license-requests). */
  link?: string | null;
  /** Évite les doublons pour un même destinataire (rappels automatiques). */
  dedupeKey?: string | null;
}

let vapidConfigured: boolean | null = null;
function configureVapid(): boolean {
  if (vapidConfigured !== null) return vapidConfigured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@optiwifi.site';
  if (!publicKey || !privateKey) {
    vapidConfigured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

async function sendPush(userIds: string[], n: NotificationInput): Promise<void> {
  if (!configureVapid() || userIds.length === 0) return;
  const { rows } = await query(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1::uuid[])',
    [userIds]
  );
  const payload = JSON.stringify({ title: n.title, body: n.body || '', url: n.link || '/', tag: n.type });
  await Promise.all(
    rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24 }
        );
        await query('UPDATE push_subscriptions SET last_used_at = NOW() WHERE id = $1', [sub.id]);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // Abonnement expiré ou révoqué par le navigateur : on le supprime
        if (status === 404 || status === 410) {
          await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        } else {
          console.error('Push notification error:', status || err);
        }
      }
    })
  );
}

/** Crée la notification in-app pour chaque destinataire puis envoie le push. */
export async function notifyUsers(userIds: string[], n: NotificationInput): Promise<void> {
  const recipients = [...new Set(userIds.filter(Boolean))];
  if (recipients.length === 0) return;
  try {
    const { rows } = await query(
      `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key)
       SELECT u, $2, $3, $4, $5, $6 FROM unnest($1::uuid[]) AS u
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING user_id`,
      [recipients, n.type, n.title.slice(0, 200), n.body ?? null, n.link ?? null, n.dedupeKey ?? null]
    );
    // Push uniquement pour les notifications réellement créées (pas les doublons ignorés)
    await sendPush(rows.map((r) => r.user_id as string), n);
  } catch (err) {
    console.error('notifyUsers error:', err);
  }
}

/** Comptes super admin actifs. */
export async function getSuperAdminUserIds(): Promise<string[]> {
  const { rows } = await query(
    `SELECT pu.auth_user_id FROM platform_users pu
       JOIN users u ON u.id = pu.auth_user_id
      WHERE pu.role = 'super_admin' AND pu.is_active = true
        AND (u.banned_until IS NULL OR u.banned_until <= NOW())`
  );
  return rows.map((r) => r.auth_user_id as string);
}

/** Administrateurs actifs d'une organisation (optionnellement sans l'auteur de l'action). */
export async function getOrganizationAdminIds(organizationId: string, excludeUserId?: string | null): Promise<string[]> {
  const { rows } = await query(
    `SELECT p.id FROM profiles p
      WHERE p.organization_id = $1 AND p.role = 'administrateur'
        AND p.is_active IS NOT FALSE AND p.deleted_at IS NULL
        AND ($2::uuid IS NULL OR p.id <> $2::uuid)`,
    [organizationId, excludeUserId ?? null]
  );
  return rows.map((r) => r.id as string);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Super admins : in-app + push, et Telegram en production uniquement. */
export async function notifySuperAdmins(n: NotificationInput): Promise<void> {
  await notifyUsers(await getSuperAdminUserIds(), n);
  if (process.env.VERCEL_ENV === 'production') {
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site';
    const lines = [`🔔 <b>${escapeHtml(n.title)}</b>`];
    if (n.body) lines.push(escapeHtml(n.body));
    if (n.link) lines.push(`${base}${n.link}`);
    await sendTelegramMessage({ text: lines.join('\n'), parse_mode: 'HTML' }).catch(() => false);
  }
}

export async function notifyOrganizationAdmins(
  organizationId: string,
  n: NotificationInput,
  excludeUserId?: string | null
): Promise<void> {
  await notifyUsers(await getOrganizationAdminIds(organizationId, excludeUserId), n);
}

/** Planifie l'envoi après la réponse HTTP (ne ralentit pas l'action, n'échoue jamais). */
export function notifyInBackground(task: () => Promise<void>): void {
  after(async () => {
    try {
      await task();
    } catch (err) {
      console.error('Notification task error:', err);
    }
  });
}

/** Nouvel encaissement : prévient les administrateurs de l'organisation (sauf l'auteur). */
export async function notifyCollectionCreated(
  organizationId: string,
  actorId: string,
  collection: { id?: string; pos_id?: string; montant_collecte?: number | string | null }
): Promise<void> {
  // La création peut ne renvoyer que l'id : on relit la collecte (de la même organisation)
  const info = await query(
    `SELECT c.montant_collecte, pos.nom AS pos, pr.nom AS auteur
       FROM collections c
       LEFT JOIN points_of_sale pos ON pos.id = c.pos_id
       LEFT JOIN profiles pr ON pr.id = $2
      WHERE c.id = $1 AND COALESCE(c.organization_id, c.organisation_id) = $3`,
    [collection.id ?? null, actorId, organizationId]
  );
  if (!info.rows[0]) return;
  const amount = new Intl.NumberFormat('fr-FR').format(Number(info.rows[0].montant_collecte || 0));
  await notifyOrganizationAdmins(
    organizationId,
    {
      type: 'team.collection_created',
      title: 'Nouvel encaissement',
      body: `${amount} FCFA encaissés${info.rows[0]?.pos ? ` au POS ${info.rows[0].pos}` : ''}${info.rows[0]?.auteur ? ` par ${info.rows[0].auteur}` : ''}.`,
      link: collection.id ? `/collections/${collection.id}` : '/collections',
    },
    actorId
  );
}
