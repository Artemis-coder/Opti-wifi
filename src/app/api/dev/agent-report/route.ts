import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { hydrateTelegramEnv } from '@/lib/integration-secrets';
import { isDevAgentRequest } from '@/lib/dev-agent-auth';
import { createAgentProposal, updateDevRequest } from '@/lib/dev-requests';
import { isGitHubConfigured, openPullRequest, REPO_URL } from '@/lib/github';
import { sendDevCard } from '@/lib/telegram-dev';
import { sendBotMessage, toTelegramHtml } from '@/lib/bot/assistant';
import { escapeTelegramHtml } from '@/lib/telegram';

const BRANCH_RE = /^claude\/[A-Za-z0-9._\/-]{1,100}$/;
const SHA_RE = /^[0-9a-f]{7,40}$/i;
const SOURCES: Record<string, string> = {
  deps: '📦 Audit des dépendances',
  'code-review': '🔍 Revue de sécurité du code',
  diagnostic: '🔧 Diagnostic technique',
};

let reportsTable: Promise<unknown> | null = null;

/** true si ce rapport n'a pas déjà été envoyé ces dernières 24 h (et l'enregistre). */
async function claimReport(source: string, title: string): Promise<boolean> {
  reportsTable ??= query(
    `CREATE TABLE IF NOT EXISTS agent_reports (source TEXT NOT NULL, title TEXT NOT NULL, sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (source, title))`,
  ).catch((err) => {
    reportsTable = null;
    throw err;
  });
  await reportsTable;
  const { rows } = await query(
    `INSERT INTO agent_reports (source, title) VALUES ($1, $2)
     ON CONFLICT (source, title) DO UPDATE SET sent_at = NOW() WHERE agent_reports.sent_at < NOW() - interval '24 hours'
     RETURNING 1`,
    [source, title.toLowerCase()],
  );
  return rows.length > 0;
}

// Compte rendu d'une routine planifiée (audit, revue, diagnostic). Avec branch + commit : le
// correctif devient une demande « à valider » (PR vers develop + boutons Intégrer / Corriger /
// Abandonner). Sans : simple rapport sur Telegram.
export async function POST(request: Request) {
  if (!isDevAgentRequest(request)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { source?: string; title?: string; text?: string; branch?: string; commit?: string };
  const source = typeof body.source === 'string' ? SOURCES[body.source] : undefined;
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 90) : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!source || !title || !text) return NextResponse.json({ error: 'source (deps, code-review, diagnostic), title et text requis' }, { status: 400 });

  await hydrateTelegramEnv();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId) return NextResponse.json({ error: 'Telegram non configuré' }, { status: 503 });

  const hasFix = body.branch !== undefined || body.commit !== undefined;
  if (!hasFix) {
    // Les routines n'ont pas de mémoire : un même rapport (source + titre) n'est envoyé qu'une fois par 24 h
    if (!(await claimReport(body.source as string, title))) return NextResponse.json({ ok: true, kind: 'duplicate' });
    await sendBotMessage(chatId, `${source} — <b>${escapeTelegramHtml(title)}</b>\n\n${toTelegramHtml(text.slice(0, 3500))}`);
    return NextResponse.json({ ok: true, kind: 'report' });
  }

  const branch = typeof body.branch === 'string' && BRANCH_RE.test(body.branch) ? body.branch : null;
  const commit = typeof body.commit === 'string' && SHA_RE.test(body.commit) ? body.commit : null;
  if (!branch || !commit) return NextResponse.json({ error: 'branch (claude/…) et commit (SHA) requis' }, { status: 400 });

  const r = await createAgentProposal({ title: `${source.split(' ')[0]} ${title}`, report: text, branch, commit });
  let prError: string | null = null;
  if (isGitHubConfigured()) {
    try {
      const pr = await openPullRequest(branch, 'develop', `${title} (proposé par la routine ${source.slice(2)})`, `${text}\n\n---\nCorrectif proposé par une routine Claude (demande #${r.id}). À valider par le propriétaire.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`);
      await updateDevRequest(r.id, { pr_number: pr.number });
      r.pr_number = pr.number;
    } catch (err) {
      prError = err instanceof Error ? err.message : 'erreur GitHub';
    }
  } else {
    prError = 'accès GitHub non configuré';
  }
  await sendDevCard(chatId, r, `${source} — <b>correctif proposé, votre validation est requise</b>`);
  if (prError) {
    await sendBotMessage(chatId, `⚠️ PR non ouverte automatiquement (${escapeTelegramHtml(prError)}). Ouvrez-la : ${REPO_URL}/compare/develop...${encodeURIComponent(branch)}?expand=1`);
  }
  return NextResponse.json({ ok: true, kind: 'proposal', request_id: r.id, pr_number: r.pr_number });
}
