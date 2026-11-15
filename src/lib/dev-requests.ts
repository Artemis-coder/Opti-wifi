// ============================================================
// OPTIWIFI - Demandes de développement confiées à Claude Code depuis Telegram (menu « 🤖 IA »).
// Le contenu reste privé dans la base (le dépôt GitHub est public) : la routine cloud le lit par
// l'API /api/dev/requests, protégée par DEV_AGENT_TOKEN.
// ============================================================
import { query } from '@/lib/neon/db';

export type DevRequestStatus =
  | 'planning' // Claude prépare le plan
  | 'plan_ready' // plan envoyé, en attente du propriétaire
  | 'developing' // plan validé (ou correction demandée) : Claude développe
  | 'review' // développement terminé, PR vers develop ouverte, en attente du propriétaire
  | 'integrated' // PR fusionnée dans develop (préproduction)
  | 'in_production' // develop mis en production
  | 'abandoned'
  | 'failed';

export const DEV_STATUS_LABEL: Record<DevRequestStatus, string> = {
  planning: '🧠 Plan en préparation',
  plan_ready: '📋 Plan à valider',
  developing: '🛠️ Développement en cours',
  review: '✅ À valider',
  integrated: '🧪 En préproduction',
  in_production: '🚀 En production',
  abandoned: '❌ Abandonnée',
  failed: '⚠️ Bloquée',
};

export const OPEN_STATUSES: DevRequestStatus[] = ['planning', 'plan_ready', 'developing', 'review'];
export const WAITING_OWNER: DevRequestStatus[] = ['plan_ready', 'review'];

export interface DevRequest {
  id: number;
  title: string;
  request: string;
  status: DevRequestStatus;
  plan: string | null;
  summary: string | null;
  feedback: string | null;
  branch: string | null;
  commit_sha: string | null;
  pr_number: number | null;
  session_url: string | null;
  created_at: string;
  updated_at: string;
}

let ready: Promise<void> | null = null;

/** Table créée à la demande, comme les tables du bot (voir aussi supabase/migrations/20261115_dev_requests.sql). */
export function ensureDevTables(): Promise<void> {
  ready ??= query(`
    CREATE TABLE IF NOT EXISTS dev_requests (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      request TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planning',
      plan TEXT,
      summary TEXT,
      feedback TEXT,
      branch TEXT,
      commit_sha TEXT,
      pr_number INT,
      session_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).then(() => undefined).catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

const clip = (v: string | null | undefined, max: number) => (v == null ? null : String(v).slice(0, max));

export async function createDevRequest(request: string): Promise<DevRequest> {
  await ensureDevTables();
  const text = request.trim().slice(0, 8000);
  const title = text.split('\n')[0].slice(0, 90);
  const { rows } = await query(`INSERT INTO dev_requests (title, request) VALUES ($1, $2) RETURNING *`, [title, text]);
  return rows[0] as DevRequest;
}

/** Correctif proposé de lui-même par une routine (audit, revue, diagnostic) : demande directement « à valider ». */
export async function createAgentProposal(args: { title: string; report: string; branch: string; commit: string }): Promise<DevRequest> {
  await ensureDevTables();
  const { rows } = await query(
    `INSERT INTO dev_requests (title, request, status, plan, summary, branch, commit_sha)
     VALUES ($1, $2, 'review', $3, $3, $4, $5) RETURNING *`,
    [args.title.slice(0, 90), `Proposé par une routine Claude : ${args.title}`.slice(0, 8000), args.report.slice(0, 12000), args.branch, args.commit],
  );
  return rows[0] as DevRequest;
}

export async function getDevRequest(id: number): Promise<DevRequest | null> {
  if (!Number.isInteger(id) || id < 1) return null;
  await ensureDevTables();
  const { rows } = await query(`SELECT * FROM dev_requests WHERE id = $1`, [id]);
  return (rows[0] as DevRequest) ?? null;
}

export async function listDevRequests(statuses: DevRequestStatus[] | null, limit = 10): Promise<DevRequest[]> {
  await ensureDevTables();
  const { rows } = statuses
    ? await query(`SELECT * FROM dev_requests WHERE status = ANY($1::text[]) ORDER BY updated_at DESC LIMIT $2`, [statuses, limit])
    : await query(`SELECT * FROM dev_requests ORDER BY updated_at DESC LIMIT $1`, [limit]);
  return rows as DevRequest[];
}

export async function updateDevRequest(
  id: number,
  patch: Partial<Pick<DevRequest, 'status' | 'plan' | 'summary' | 'feedback' | 'branch' | 'commit_sha' | 'pr_number' | 'session_url'>>,
): Promise<DevRequest | null> {
  await ensureDevTables();
  const { rows } = await query(
    `UPDATE dev_requests SET
        status      = COALESCE($2, status),
        plan        = COALESCE($3, plan),
        summary     = COALESCE($4, summary),
        feedback    = COALESCE($5, feedback),
        branch      = COALESCE($6, branch),
        commit_sha  = COALESCE($7, commit_sha),
        pr_number   = COALESCE($8, pr_number),
        session_url = COALESCE($9, session_url),
        updated_at  = NOW()
      WHERE id = $1 RETURNING *`,
    [
      id,
      patch.status ?? null,
      clip(patch.plan, 12000),
      clip(patch.summary, 12000),
      clip(patch.feedback, 4000),
      clip(patch.branch, 120),
      clip(patch.commit_sha, 40),
      patch.pr_number ?? null,
      clip(patch.session_url, 300),
    ],
  );
  return (rows[0] as DevRequest) ?? null;
}

/** Ajoute une remarque du propriétaire (correction demandée), en gardant les précédentes. */
export async function appendFeedback(id: number, feedback: string): Promise<DevRequest | null> {
  const current = await getDevRequest(id);
  if (!current) return null;
  const stamp = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'short', timeStyle: 'short' });
  const merged = `${current.feedback ? `${current.feedback}\n\n` : ''}[${stamp}] ${feedback.trim()}`.slice(-4000);
  return updateDevRequest(id, { feedback: merged });
}
