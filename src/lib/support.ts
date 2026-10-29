// ============================================================
// OPTIWIFI - Support : tickets des clients et réponses du support (super admin).
// Règles partagées par /api/support (client) et /api/platform/support (super admin).
// ============================================================
import { query } from '@/lib/neon/db';
import {
  getOrganizationAdminIds,
  notifyInBackground,
  notifyOrganizationAdmins,
  notifySuperAdmins,
  notifyUsers,
  type NotificationInput,
} from '@/lib/notifications';

/** Administrateurs du client + auteur du ticket (même collecteur), chacun une seule fois. */
async function notifyTicketClient(organizationId: string, createdBy: string | null, n: NotificationInput) {
  const ids = await getOrganizationAdminIds(organizationId);
  await notifyUsers(createdBy ? [...ids, createdBy] : ids, n);
}

export const SUPPORT_CATEGORIES = ['billing', 'technical', 'account', 'other'] as const;
export const SUPPORT_PRIORITIES = ['low', 'normal', 'high'] as const;
export const SUPPORT_STATUSES = ['new', 'in_progress', 'resolved', 'closed'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

const STATUS_FR: Record<SupportStatus, string> = {
  new: 'Nouveau',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
};

export interface SupportTicketRow {
  id: string;
  ticket_number: string;
  organization_id: string | null;
  organization_name: string | null;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  opened_by_support: boolean;
  client_name: string;
  created_at: string;
  last_message_at: string;
  resolved_at: string | null;
  messages_count: number;
  last_from_support: boolean | null;
}

export interface SupportMessageRow {
  id: string;
  author_name: string | null;
  from_support: boolean;
  body: string;
  created_at: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Valide sujet, message, catégorie et priorité envoyés à la création. */
export function parseNewTicket(body: Record<string, unknown>):
  | { ok: true; subject: string; message: string; category: SupportCategory; priority: SupportPriority }
  | { ok: false; error: string } {
  const subject = str(body.subject, 200);
  const message = str(body.message, 5000);
  if (subject.length < 3) return { ok: false, error: 'Indiquez un sujet (3 caractères min.)' };
  if (message.length < 5) return { ok: false, error: 'Décrivez votre demande (5 caractères min.)' };
  const category = (SUPPORT_CATEGORIES as readonly string[]).includes(String(body.category)) ? (body.category as SupportCategory) : 'other';
  const priority = (SUPPORT_PRIORITIES as readonly string[]).includes(String(body.priority)) ? (body.priority as SupportPriority) : 'normal';
  return { ok: true, subject, message, category, priority };
}

const TICKET_COLUMNS = `t.id, t.ticket_number, t.organization_id, o.name AS organization_name, t.subject, t.category, t.priority,
  t.status, t.opened_by_support, t.client_name, t.created_at, t.last_message_at, t.resolved_at,
  (SELECT COUNT(*)::int FROM support_messages m WHERE m.ticket_id = t.id) AS messages_count,
  (SELECT m.from_support FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_from_support`;

/** Tickets d'une organisation (client), ou de toutes (super admin : organizationId null). */
export async function listTickets(organizationId: string | null, status?: string | null): Promise<SupportTicketRow[]> {
  const statusFilter = status && (SUPPORT_STATUSES as readonly string[]).includes(status) ? status : null;
  const { rows } = await query(
    `SELECT ${TICKET_COLUMNS}
       FROM support_tickets t LEFT JOIN organizations o ON o.id = t.organization_id
      WHERE ($1::uuid IS NULL OR t.organization_id = $1::uuid)
        AND ($2::text IS NULL OR t.status = $2::text)
      ORDER BY (t.status IN ('new', 'in_progress')) DESC, t.last_message_at DESC
      LIMIT 300`,
    [organizationId, statusFilter]
  );
  return rows as SupportTicketRow[];
}

export async function getTicket(id: string): Promise<{ ticket: SupportTicketRow; messages: SupportMessageRow[] } | null> {
  const [t, m] = await Promise.all([
    query(`SELECT ${TICKET_COLUMNS} FROM support_tickets t LEFT JOIN organizations o ON o.id = t.organization_id WHERE t.id = $1`, [id]),
    query(
      `SELECT id, author_name, from_support, body, created_at FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [id]
    ),
  ]);
  if (!t.rows[0]) return null;
  return { ticket: t.rows[0] as SupportTicketRow, messages: m.rows as SupportMessageRow[] };
}

/** Nombre de tickets par statut (KPI du back-office). */
export async function ticketCounts(): Promise<Record<SupportStatus, number>> {
  const { rows } = await query(`SELECT status, COUNT(*)::int AS n FROM support_tickets GROUP BY status`);
  const out = { new: 0, in_progress: 0, resolved: 0, closed: 0 } as Record<SupportStatus, number>;
  for (const r of rows) if (r.status in out) out[r.status as SupportStatus] = Number(r.n);
  return out;
}

/** Création d'un ticket : par le client (son organisation) ou par le support pour un client. */
export async function createTicket(input: {
  organizationId: string;
  authorUserId: string;
  authorName: string;
  fromSupport: boolean;
  subject: string;
  message: string;
  category: SupportCategory;
  priority: SupportPriority;
}): Promise<Result<{ id: string; ticket_number: string }>> {
  const org = await query('SELECT id, name FROM organizations WHERE id = $1', [input.organizationId]);
  if (!org.rows[0]) return fail(404, 'Client introuvable');
  const { rows } = await query(
    `WITH t AS (
       INSERT INTO support_tickets (organization_id, ticket_number, client_name, subject, message, category, priority,
                                    status, created_by, opened_by_support, last_message_at)
       VALUES ($1, 'SUP-' || lpad(nextval('support_ticket_number_seq')::text, 5, '0'), $2, $3, $4, $5, $6,
               'new', $7, $8, NOW())
       RETURNING id, ticket_number
     ), m AS (
       INSERT INTO support_messages (ticket_id, author_user_id, author_name, from_support, body)
       SELECT id, $7, $9, $8, $4 FROM t
     )
     SELECT id, ticket_number FROM t`,
    [
      input.organizationId,
      org.rows[0].name,
      input.subject,
      input.message,
      input.category,
      input.priority,
      input.authorUserId,
      input.fromSupport,
      input.authorName,
    ]
  );
  const ticket = rows[0] as { id: string; ticket_number: string };
  const orgName = org.rows[0].name as string;

  notifyInBackground(() =>
    input.fromSupport
      ? notifyOrganizationAdmins(input.organizationId, {
          type: 'support.new',
          title: `Le support OptiWifi vous a écrit : ${input.subject}`,
          body: input.message.slice(0, 180),
          link: `/support/${ticket.id}`,
        })
      : notifySuperAdmins({
          type: 'support.new',
          title: `Nouveau ticket ${ticket.ticket_number} : ${orgName}`,
          body: `${input.subject} — ${input.message.slice(0, 160)}`,
          link: `/platform/support/${ticket.id}`,
        })
  );
  return { ok: true, data: ticket };
}

/** Réponse dans le fil. Une réponse du client rouvre un ticket résolu ; une réponse du support le passe « En cours ». */
export async function addMessage(input: {
  ticketId: string;
  authorUserId: string;
  authorName: string;
  fromSupport: boolean;
  body: string;
}): Promise<Result<SupportMessageRow>> {
  const body = str(input.body, 5000);
  if (!body) return fail(400, 'Message vide');
  const t = await query('SELECT id, ticket_number, organization_id, subject, status, created_by FROM support_tickets WHERE id = $1', [
    input.ticketId,
  ]);
  const ticket = t.rows[0];
  if (!ticket) return fail(404, 'Ticket introuvable');
  if (ticket.status === 'closed' && !input.fromSupport) return fail(409, 'Ce ticket est fermé : ouvrez un nouveau ticket.');

  const { rows } = await query(
    `WITH m AS (
       INSERT INTO support_messages (ticket_id, author_user_id, author_name, from_support, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, author_name, from_support, body, created_at
     ), u AS (
       UPDATE support_tickets
          SET last_message_at = NOW(), updated_at = NOW(),
              status = CASE
                WHEN $4 AND status = 'new' THEN 'in_progress'
                WHEN NOT $4 AND status = 'resolved' THEN 'in_progress'
                ELSE status END,
              resolved_at = CASE WHEN NOT $4 AND status = 'resolved' THEN NULL ELSE resolved_at END
        WHERE id = $1
     )
     SELECT * FROM m`,
    [input.ticketId, input.authorUserId, input.authorName, input.fromSupport, body]
  );

  notifyInBackground(async () => {
    if (input.fromSupport) {
      if (!ticket.organization_id) return;
      await notifyTicketClient(ticket.organization_id, ticket.created_by, {
        type: 'support.reply',
        title: `Réponse du support : ${ticket.subject}`,
        body: body.slice(0, 180),
        link: `/support/${ticket.id}`,
      });
    } else {
      await notifySuperAdmins({
        type: 'support.reply',
        title: `Réponse client ${ticket.ticket_number} : ${ticket.subject}`,
        body: body.slice(0, 180),
        link: `/platform/support/${ticket.id}`,
      });
    }
  });
  return { ok: true, data: rows[0] as SupportMessageRow };
}

/** Changement de statut / priorité par le support. Le client est prévenu quand le ticket est résolu ou fermé. */
export async function updateTicket(input: {
  ticketId: string;
  status?: string;
  priority?: string;
}): Promise<Result<{ status: SupportStatus; priority: SupportPriority }>> {
  const status = input.status && (SUPPORT_STATUSES as readonly string[]).includes(input.status) ? input.status : null;
  const priority = input.priority && (SUPPORT_PRIORITIES as readonly string[]).includes(input.priority) ? input.priority : null;
  if (!status && !priority) return fail(400, 'Rien à modifier');
  const { rows } = await query(
    `UPDATE support_tickets t
        SET status = COALESCE($2, t.status), priority = COALESCE($3, t.priority), updated_at = NOW(),
            resolved_at = CASE WHEN $2 IN ('resolved', 'closed') AND t.resolved_at IS NULL THEN NOW()
                               WHEN $2 IN ('new', 'in_progress') THEN NULL ELSE t.resolved_at END
       FROM (SELECT status AS old_status FROM support_tickets WHERE id = $1) old
      WHERE t.id = $1
      RETURNING t.status, t.priority, old.old_status, t.organization_id, t.subject, t.created_by`,
    [input.ticketId, status, priority]
  );
  const r = rows[0];
  if (!r) return fail(404, 'Ticket introuvable');
  if (status && r.old_status !== r.status && (r.status === 'resolved' || r.status === 'closed') && r.organization_id) {
    notifyInBackground(async () => {
      await notifyTicketClient(r.organization_id, r.created_by, {
        type: 'support.status',
        title: `Ticket ${STATUS_FR[r.status as SupportStatus].toLowerCase()} : ${r.subject}`,
        body:
          r.status === 'resolved'
            ? 'Le support a marqué votre demande comme résolue. Répondez dans le ticket si le problème persiste.'
            : 'Le support a fermé ce ticket.',
        link: `/support/${input.ticketId}`,
      });
    });
  }
  return { ok: true, data: { status: r.status, priority: r.priority } };
}
