import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { comparePassword } from '@/lib/neon/auth';
import { getSessionContext } from '@/lib/tenant';
import { notifyInBackground, notifySuperAdmins } from '@/lib/notifications';
import { sendDeletionRequestedEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Demande de suppression du compte et des données de l'espace (administrateur de l'espace).
// La suppression elle-même est faite par le super admin, après validation.

async function adminContext() {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.organizationId) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  if (ctx.role !== 'administrateur') {
    return { error: NextResponse.json({ error: "Seul l'administrateur de l'espace peut demander sa suppression." }, { status: 403 }) };
  }
  return { ctx: ctx as typeof ctx & { organizationId: string } };
}

const FIELDS = `id, status, reason, requested_at, processed_at, decision_note, requester_name`;

/** Dernière demande de l'espace (en attente, refusée ou annulée) */
export async function GET() {
  const auth = await adminContext();
  if ('error' in auth) return auth.error;
  const { rows } = await query(
    `SELECT ${FIELDS} FROM account_deletion_requests WHERE organization_id = $1 ORDER BY requested_at DESC LIMIT 1`,
    [auth.ctx.organizationId]
  );
  return NextResponse.json({ data: rows[0] ?? null });
}

/** Nouvelle demande : confirmation par le nom de l'espace et le mot de passe */
export async function POST(request: Request) {
  const auth = await adminContext();
  if ('error' in auth) return auth.error;
  const { ctx } = auth;
  const body = (await request.json().catch(() => ({}))) as {
    confirm_name?: string;
    password?: string;
    reason?: string;
    export_acknowledged?: boolean;
  };

  const { rows: orgRows } = await query(`SELECT id, name FROM organizations WHERE id = $1`, [ctx.organizationId]);
  const org = orgRows[0];
  if (!org) return NextResponse.json({ error: 'Espace introuvable' }, { status: 404 });

  if ((body.confirm_name || '').trim().toLowerCase() !== String(org.name).trim().toLowerCase()) {
    return NextResponse.json({ error: "Le nom saisi ne correspond pas au nom de l'espace." }, { status: 400 });
  }
  if (!body.export_acknowledged) {
    return NextResponse.json({ error: 'Confirmez avoir téléchargé vos données (ou y renoncer).' }, { status: 400 });
  }
  const { rows: userRows } = await query(
    `SELECT u.email, u.password_hash, p.nom FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = $1`,
    [ctx.userId]
  );
  const user = userRows[0];
  if (!user || !body.password || !(await comparePassword(body.password, user.password_hash))) {
    return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) || null : null;
  try {
    const { rows } = await query(
      `INSERT INTO account_deletion_requests
         (organization_id, organization_name, requested_by, requester_name, requester_email, reason, export_acknowledged)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING ${FIELDS}`,
      [ctx.organizationId, org.name, ctx.userId, user.nom ?? null, user.email, reason]
    );

    notifyInBackground(async () => {
      await notifySuperAdmins({
        type: 'account.deletion_requested',
        title: `Demande de suppression : ${org.name}`,
        body: `${user.nom || user.email} demande la suppression de son espace et de toutes ses données.${reason ? ` Motif : ${reason}` : ''}`,
        link: '/platform/deletion-requests',
      });
      await sendDeletionRequestedEmail(user.email, org.name);
    });
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err) {
    if (String(err).includes('uniq_account_deletion_pending')) {
      return NextResponse.json({ error: 'Une demande est déjà en cours pour cet espace.' }, { status: 409 });
    }
    console.error('Deletion request error:', err);
    return NextResponse.json({ error: "Erreur lors de l'envoi de la demande" }, { status: 500 });
  }
}

/** Annulation de la demande en attente */
export async function DELETE() {
  const auth = await adminContext();
  if ('error' in auth) return auth.error;
  const { rows } = await query(
    `UPDATE account_deletion_requests SET status = 'cancelled', processed_at = NOW()
      WHERE organization_id = $1 AND status = 'pending' RETURNING ${FIELDS}`,
    [auth.ctx.organizationId]
  );
  if (!rows[0]) return NextResponse.json({ error: 'Aucune demande en cours' }, { status: 404 });
  return NextResponse.json({ data: rows[0] });
}
