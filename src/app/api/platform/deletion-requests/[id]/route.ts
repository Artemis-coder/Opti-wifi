import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import { deleteOrganizationData } from '@/lib/account-deletion';
import { notifyInBackground, notifyOrganizationAdmins } from '@/lib/notifications';
import { sendDeletionCompletedEmail, sendDeletionRejectedEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Décision du super admin : « approve » efface définitivement l'espace et ses données,
// « reject » refuse la demande (avec un motif). La demande est conservée comme trace.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; note?: string; confirm_name?: string };
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) || null : null;

  const { rows } = await query(`SELECT * FROM account_deletion_requests WHERE id = $1`, [id]);
  const req = rows[0];
  if (!req) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
  if (req.status !== 'pending') return NextResponse.json({ error: 'Cette demande a déjà été traitée.' }, { status: 409 });

  if (body.action === 'reject') {
    if (!note) return NextResponse.json({ error: 'Indiquez le motif du refus.' }, { status: 400 });
    await query(
      `UPDATE account_deletion_requests SET status = 'rejected', processed_at = NOW(), processed_by = $2, decision_note = $3 WHERE id = $1`,
      [id, auth.platformUser.id, note]
    );
    await query(
      `INSERT INTO platform_audit_logs (platform_user_id, organization_id, action, entity_type, entity_id, old_data, new_data)
       VALUES ($1, $2, 'account_deletion.rejected', 'account_deletion_request', $3, NULL, $4)`,
      [auth.platformUser.id, req.organization_id, id, JSON.stringify({ organization_name: req.organization_name, note })]
    );
    notifyInBackground(async () => {
      if (req.organization_id) {
        await notifyOrganizationAdmins(req.organization_id, {
          type: 'account.deletion_rejected',
          title: 'Demande de suppression non traitée',
          body: `Motif : ${note}`,
          link: '/settings',
        });
      }
      if (req.requester_email) await sendDeletionRejectedEmail(req.requester_email, req.organization_name, note);
    });
    return NextResponse.json({ success: true, message: `Demande de « ${req.organization_name} » refusée.` });
  }

  if (body.action !== 'approve') return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  if (!req.organization_id) return NextResponse.json({ error: 'Espace déjà supprimé' }, { status: 409 });
  // Double confirmation : le super admin retape le nom de l'espace
  if ((body.confirm_name || '').trim().toLowerCase() !== String(req.organization_name).trim().toLowerCase()) {
    return NextResponse.json({ error: "Le nom saisi ne correspond pas au nom de l'espace." }, { status: 400 });
  }

  try {
    const summary = await deleteOrganizationData(req.organization_id);
    // Trace de l'effacement (l'espace n'existe plus : son nom est gardé dans la trace)
    await query(
      `INSERT INTO platform_audit_logs (platform_user_id, organization_id, action, entity_type, entity_id, old_data, new_data)
       VALUES ($1, NULL, 'account_deletion.completed', 'account_deletion_request', $2, $3, $4)`,
      [
        auth.platformUser.id,
        id,
        JSON.stringify({ organization_name: req.organization_name, requester: req.requester_email, requested_at: req.requested_at }),
        JSON.stringify({ deleted: summary }),
      ]
    );
    await query(
      `UPDATE account_deletion_requests
          SET status = 'completed', processed_at = NOW(), processed_by = $2, decision_note = $3, deleted_summary = $4::jsonb
        WHERE id = $1`,
      [id, auth.platformUser.id, note, JSON.stringify(summary)]
    );
    if (req.requester_email) notifyInBackground(() => sendDeletionCompletedEmail(req.requester_email, req.organization_name).then(() => {}));
    return NextResponse.json({ success: true, summary, message: `« ${req.organization_name} » et toutes ses données ont été supprimés.` });
  } catch (err) {
    console.error('Account deletion error:', err);
    return NextResponse.json({ error: "L'effacement a échoué : rien n'a été supprimé." }, { status: 500 });
  }
}
