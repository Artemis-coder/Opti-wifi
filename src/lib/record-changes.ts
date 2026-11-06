// ============================================================
// OPTIWIFI - Modification et suppression d'une collecte ou d'une allocation
// - Administrateur de l'espace : appliquée tout de suite
// - Collecteur : demande envoyée à l'administrateur, appliquée après sa validation
// Contrôles : appartenance à l'espace, droits du collecteur (ses propres saisies), champs
// autorisés, et stock du point de vente jamais négatif après une allocation modifiée.
// ============================================================
import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { getSessionContext, type SessionContext } from '@/lib/tenant';
import { getVisiblePosIds } from '@/lib/collector-scope';
import { getOrganizationAdminIds, notifyInBackground, notifyUsers } from '@/lib/notifications';

export type EntityType = 'collection' | 'allocation';
export type ChangeAction = 'update' | 'delete';
type Row = Record<string, unknown>;

/** Champs qu'on peut corriger (le reste découle de la saisie : point de vente, tickets…) */
const EDITABLE: Record<EntityType, Record<string, 'amount' | 'int' | 'date' | 'text'>> = {
  collection: { montant_collecte: 'amount', commission: 'amount', date_collecte: 'date', notes: 'text' },
  allocation: { quantite: 'int', date_allocation: 'date', notes: 'text' },
};

export const FIELD_LABELS: Record<string, string> = {
  montant_collecte: 'Montant encaissé',
  commission: 'Commission',
  date_collecte: 'Date de collecte',
  notes: 'Notes',
  quantite: 'Quantité',
  date_allocation: "Date d'allocation",
};

const TABLE: Record<EntityType, string> = { collection: 'collections', allocation: 'ticket_allocations' };

class ChangeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const frDate = (d: unknown) => (d ? new Date(String(d)).toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' }) : '');

/** Élément de l'espace avec un libellé lisible, ou null */
async function loadEntity(type: EntityType, id: string, organizationId: string): Promise<{ row: Row; label: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (type === 'collection') {
    const { rows } = await query(
      `SELECT c.*, p.nom AS pos_nom FROM collections c LEFT JOIN points_of_sale p ON p.id = c.pos_id
        WHERE c.id = $1 AND (c.organization_id = $2 OR c.organisation_id = $2)`,
      [id, organizationId]
    );
    const r = rows[0];
    return r ? { row: r, label: `Collecte du ${frDate(r.date_collecte || r.created_at)} · ${r.pos_nom ?? 'point de vente'}` } : null;
  }
  const { rows } = await query(
    `SELECT a.*, p.nom AS pos_nom, t.nom AS ticket_nom FROM ticket_allocations a
       LEFT JOIN points_of_sale p ON p.id = a.pos_id
       LEFT JOIN ticket_types t ON t.id = a.ticket_type_id
      WHERE a.id = $1 AND a.organization_id = $2`,
    [id, organizationId]
  );
  const r = rows[0];
  return r ? { row: r, label: `Allocation de ${r.quantite} × ${r.ticket_nom ?? 'tickets'} · ${r.pos_nom ?? 'point de vente'}` } : null;
}

/** Ne garde que les champs autorisés, avec des valeurs valides */
function sanitize(type: EntityType, raw: unknown): Row {
  const out: Row = {};
  const input = (raw && typeof raw === 'object' ? raw : {}) as Row;
  for (const [field, kind] of Object.entries(EDITABLE[type])) {
    if (!(field in input)) continue;
    const v = input[field];
    if (kind === 'amount') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new ChangeError(`${FIELD_LABELS[field]} invalide.`);
      out[field] = Math.round(n * 100) / 100;
    } else if (kind === 'int') {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 10_000_000) throw new ChangeError(`${FIELD_LABELS[field]} invalide (nombre entier, au moins 1).`);
      out[field] = n;
    } else if (kind === 'date') {
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ChangeError(`${FIELD_LABELS[field]} invalide.`);
      out[field] = v;
    } else {
      out[field] = typeof v === 'string' ? v.trim().slice(0, 1000) || null : null;
    }
  }
  return out;
}

/** Ne garde que ce qui change réellement */
function diff(row: Row, changes: Row): { changes: Row; previous: Row } {
  const c: Row = {};
  const p: Row = {};
  for (const [k, v] of Object.entries(changes)) {
    const before = row[k] instanceof Date ? (row[k] as Date).toISOString().slice(0, 10) : row[k];
    const same = typeof v === 'number' ? Number(before) === v : String(before ?? '') === String(v ?? '');
    if (!same) {
      c[k] = v;
      p[k] = before ?? null;
    }
  }
  return { changes: c, previous: p };
}

/** Stock du point de vente pour ce type de ticket : jamais négatif après le changement */
async function checkAllocationStock(row: Row, newQuantity: number | null): Promise<void> {
  const { rows } = await query(
    `SELECT
       COALESCE((SELECT SUM(CASE WHEN a.type = 'exchange_return' THEN -a.quantite ELSE a.quantite END)
                   FROM ticket_allocations a WHERE a.pos_id = $1 AND a.ticket_type_id = $2), 0)::int AS allocated,
       COALESCE((SELECT SUM(ci.quantite_vendue) FROM collection_items ci
                   JOIN collections c ON c.id = ci.collection_id
                  WHERE c.pos_id = $1 AND ci.ticket_type_id = $2), 0)::int AS sold`,
    [row.pos_id, row.ticket_type_id]
  );
  const { allocated, sold } = rows[0] as { allocated: number; sold: number };
  const after = allocated - Number(row.quantite) + (newQuantity ?? 0);
  if (after < sold) {
    throw new ChangeError(
      `Impossible : ${sold} ticket(s) de ce type ont déjà été vendus à ce point de vente. ` +
        `Il resterait ${after} ticket(s) alloué(s) pour ${sold} vendu(s).`
    );
  }
}

/** Contrôles avant d'appliquer (ou d'enregistrer la demande) */
async function validate(type: EntityType, row: Row, action: ChangeAction, changes: Row): Promise<void> {
  if (type === 'allocation') {
    if (row.type !== 'allocation') {
      throw new ChangeError('Un échange de tickets ne se modifie pas : faites un nouvel échange pour le corriger.');
    }
    await checkAllocationStock(row, action === 'delete' ? null : Number(changes.quantite ?? row.quantite));
  }
  if (action === 'update' && Object.keys(changes).length === 0) throw new ChangeError('Aucune modification.');
}

/** Applique la modification ou la suppression et garde la trace dans le journal */
async function apply(type: EntityType, row: Row, action: ChangeAction, changes: Row, actorId: string): Promise<void> {
  const table = TABLE[type];
  const id = row.id as string;
  if (action === 'delete') {
    // Lignes d'une collecte : supprimées avec elle (ON DELETE CASCADE)
    await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  } else {
    const fields = Object.keys(changes);
    const sets = fields.map((f, i) => `"${f}" = $${i + 2}`).join(', ');
    await query(`UPDATE ${table} SET ${sets}, updated_at = NOW() WHERE id = $1`, [id, ...fields.map((f) => changes[f])]);
  }
  await query(
    `INSERT INTO audit_logs (table_name, operation, ancien_etat, nouvel_etat, effectue_par) VALUES ($1, $2, $3, $4, $5)`,
    [table, action === 'delete' ? 'DELETE' : 'UPDATE', JSON.stringify(row), action === 'delete' ? null : JSON.stringify(changes), actorId]
  ).catch((err) => console.error('audit_logs error:', err));
}

/** Le collecteur ne corrige que ses propres saisies, sur ses points de vente */
async function collectorOwns(type: EntityType, row: Row, ctx: SessionContext): Promise<boolean> {
  if (type === 'collection') return row.collecteur_id === ctx.userId;
  if (row.alloue_par !== ctx.userId) return false;
  const visible = await getVisiblePosIds(ctx.userId, ctx.organizationId!);
  return visible.includes(row.pos_id as string);
}

/**
 * Route PATCH (update) / DELETE (delete) d'une collecte ou d'une allocation.
 * Corps : { changes?: {...}, reason?: string }
 */
export async function handleRecordChange(request: Request, type: EntityType, id: string, action: ChangeAction) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.organizationId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (ctx.organizationBlocked) return NextResponse.json({ error: 'Votre espace est bloqué : modification impossible.' }, { status: 403 });
  const organizationId = ctx.organizationId;
  const body = (await request.json().catch(() => ({}))) as { changes?: unknown; reason?: string };
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) || null : null;

  try {
    const entity = await loadEntity(type, id, organizationId);
    if (!entity) throw new ChangeError('Élément introuvable.', 404);
    const { changes, previous } = action === 'update' ? diff(entity.row, sanitize(type, body.changes)) : { changes: {}, previous: {} };
    await validate(type, entity.row, action, changes);

    if (ctx.role === 'administrateur') {
      await apply(type, entity.row, action, changes, ctx.userId);
      return NextResponse.json({ applied: true, message: action === 'delete' ? 'Supprimé.' : 'Modification enregistrée.' });
    }

    if (ctx.role !== 'collecteur' || !(await collectorOwns(type, entity.row, ctx))) {
      throw new ChangeError('Vous ne pouvez corriger que vos propres saisies.', 403);
    }
    if (!reason) throw new ChangeError('Expliquez brièvement la correction pour votre administrateur.');

    const { rows } = await query(
      `INSERT INTO change_requests (organization_id, entity_type, entity_id, action, changes, previous, label, reason, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        organizationId,
        type,
        id,
        action,
        action === 'update' ? JSON.stringify(changes) : null,
        JSON.stringify(action === 'update' ? previous : entity.row),
        entity.label,
        reason,
        ctx.userId,
      ]
    );
    notifyInBackground(async () => {
      const admins = await getOrganizationAdminIds(organizationId);
      await notifyUsers(admins, {
        type: 'team.change_requested',
        title: action === 'delete' ? 'Demande de suppression à valider' : 'Demande de correction à valider',
        body: `${entity.label}${reason ? ` — ${reason}` : ''}`,
        link: '/change-requests',
      });
    });
    return NextResponse.json({ requested: true, id: rows[0].id, message: 'Demande envoyée à votre administrateur pour validation.' });
  } catch (err) {
    if (err instanceof ChangeError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (String(err).includes('uniq_change_requests_pending')) {
      return NextResponse.json({ error: 'Une demande est déjà en attente pour cet élément.' }, { status: 409 });
    }
    console.error('Record change error:', err);
    return NextResponse.json({ error: 'Erreur lors de la modification.' }, { status: 500 });
  }
}

/**
 * Décision de l'administrateur sur une demande : « approve » revérifie puis applique,
 * « reject » refuse avec un motif. Le collecteur est prévenu dans les deux cas.
 */
export async function decideChangeRequest(ctx: SessionContext, requestId: string, decision: 'approve' | 'reject', note: string | null) {
  const { rows } = await query(`SELECT * FROM change_requests WHERE id = $1 AND organization_id = $2`, [requestId, ctx.organizationId]);
  const req = rows[0];
  if (!req) throw new ChangeError('Demande introuvable.', 404);
  if (req.status !== 'pending') throw new ChangeError('Cette demande a déjà été traitée.', 409);

  let finalStatus: 'approved' | 'rejected' = decision === 'approve' ? 'approved' : 'rejected';
  let finalNote = note;
  if (decision === 'approve') {
    const entity = await loadEntity(req.entity_type, req.entity_id, ctx.organizationId!);
    if (!entity) {
      finalStatus = 'rejected';
      finalNote = 'Élément déjà supprimé : demande sans objet.';
    } else {
      const changes = (req.changes || {}) as Row;
      await validate(req.entity_type, entity.row, req.action, req.action === 'update' ? diff(entity.row, changes).changes : {});
      await apply(req.entity_type, entity.row, req.action, req.action === 'update' ? diff(entity.row, changes).changes : {}, ctx.userId);
    }
  } else if (!note) {
    throw new ChangeError('Indiquez le motif du refus.');
  }

  await query(
    `UPDATE change_requests SET status = $2, reviewed_by = $3, reviewed_at = NOW(), review_note = $4 WHERE id = $1`,
    [requestId, finalStatus, ctx.userId, finalNote]
  );
  if (req.requested_by) {
    notifyInBackground(() =>
      notifyUsers([req.requested_by], {
        type: finalStatus === 'approved' ? 'team.change_approved' : 'team.change_rejected',
        title: finalStatus === 'approved' ? 'Correction validée' : 'Correction refusée',
        body: `${req.label}${finalNote ? ` — ${finalNote}` : ''}`,
        link: '/change-requests',
      })
    );
  }
  return { status: finalStatus, note: finalNote, label: req.label as string };
}

export { ChangeError };

// ── Historique (traçabilité) ───────────────────────────────────────────────

export interface HistoryEvent {
  at: string;
  kind: 'created' | 'requested' | 'approved' | 'rejected' | 'cancelled' | 'updated' | 'deleted';
  by: string | null;
  /** Champs modifiés : avant → après */
  fields?: { field: string; label: string; before: unknown; after: unknown }[];
  action?: ChangeAction;
  note?: string | null;
}

/**
 * Historique complet d'une collecte ou d'une allocation : création, demandes de correction
 * (et leur décision) et chaque modification appliquée, avec l'auteur, la date et l'heure.
 * Accès : administrateur de l'espace, ou collecteur sur ses propres saisies.
 */
export async function getRecordHistory(ctx: SessionContext, type: EntityType, id: string): Promise<HistoryEvent[]> {
  const entity = await loadEntity(type, id, ctx.organizationId!);
  if (!entity) throw new ChangeError('Élément introuvable.', 404);
  if (ctx.role !== 'administrateur' && !(await collectorOwns(type, entity.row, ctx))) {
    throw new ChangeError('Historique réservé à l’administrateur et à l’auteur de la saisie.', 403);
  }
  const row = entity.row;
  const authorId = (type === 'collection' ? row.collecteur_id : row.alloue_par) as string | null;

  const [author, audits, requests] = await Promise.all([
    authorId ? query(`SELECT nom FROM profiles WHERE id = $1`, [authorId]) : Promise.resolve({ rows: [] as Row[] }),
    query(
      `SELECT a.operation, a.ancien_etat, a.nouvel_etat, a.created_at, p.nom
         FROM audit_logs a LEFT JOIN profiles p ON p.id = a.effectue_par
        WHERE a.table_name = $1 AND a.ancien_etat->>'id' = $2
        ORDER BY a.created_at`,
      [TABLE[type], id]
    ),
    query(
      `SELECT r.*, req.nom AS requested_by_name, rev.nom AS reviewed_by_name
         FROM change_requests r
         LEFT JOIN profiles req ON req.id = r.requested_by
         LEFT JOIN profiles rev ON rev.id = r.reviewed_by
        WHERE r.entity_type = $1 AND r.entity_id = $2 AND r.organization_id = $3
        ORDER BY r.requested_at`,
      [type, id, ctx.organizationId]
    ),
  ]);

  const toFields = (changes: Row | null, before: Row | null) =>
    Object.entries(changes || {}).map(([field, after]) => ({
      field,
      label: FIELD_LABELS[field] ?? field,
      before: before?.[field] ?? null,
      after,
    }));

  // Dates au format ISO (le pilote renvoie des objets Date)
  const iso = (d: unknown) => (d instanceof Date ? d : new Date(String(d))).toISOString();
  const events: HistoryEvent[] = [{ at: iso(row.created_at), kind: 'created', by: (author.rows[0]?.nom as string) ?? null }];
  for (const a of audits.rows) {
    events.push({
      at: iso(a.created_at),
      kind: a.operation === 'DELETE' ? 'deleted' : 'updated',
      by: a.nom ?? null,
      fields: a.operation === 'DELETE' ? undefined : toFields(a.nouvel_etat as Row, a.ancien_etat as Row),
    });
  }
  for (const r of requests.rows) {
    events.push({
      at: iso(r.requested_at),
      kind: 'requested',
      by: r.requested_by_name ?? null,
      action: r.action,
      fields: r.action === 'update' ? toFields(r.changes as Row, r.previous as Row) : undefined,
      note: r.reason,
    });
    if (r.reviewed_at && r.status !== 'pending') {
      events.push({
        at: iso(r.reviewed_at),
        kind: r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'cancelled',
        by: r.status === 'cancelled' ? (r.requested_by_name ?? null) : (r.reviewed_by_name ?? null),
        action: r.action,
        note: r.review_note,
      });
    }
  }
  return events.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
}
