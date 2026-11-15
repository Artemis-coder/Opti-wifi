import { NextResponse } from 'next/server';
import { hydrateTelegramEnv } from '@/lib/integration-secrets';
import { isDevAgentRequest } from '@/lib/dev-agent-auth';
import { getDevRequest, updateDevRequest } from '@/lib/dev-requests';
import { isGitHubConfigured, openPullRequest, REPO_URL } from '@/lib/github';
import { sendDevCard } from '@/lib/telegram-dev';
import { sendBotMessage } from '@/lib/bot/assistant';
import { escapeTelegramHtml } from '@/lib/telegram';

type Params = { params: Promise<{ id: string }> };

const BRANCH_RE = /^claude\/[A-Za-z0-9._\/-]{1,100}$/;
const SHA_RE = /^[0-9a-f]{7,40}$/i;

// Compte rendu de la routine Claude Code pour une demande : plan, développement terminé,
// question ou blocage. L'application met à jour la demande et prévient le propriétaire sur Telegram.
export async function POST(request: Request, { params }: Params) {
  if (!isDevAgentRequest(request)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const { id: idParam } = await params;
  const id = Number(idParam);
  const r = await getDevRequest(id);
  if (!r) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    kind?: string;
    text?: string;
    branch?: string;
    commit?: string;
    title?: string;
  };
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'Champ text requis' }, { status: 400 });

  await hydrateTelegramEnv();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  switch (body.kind) {
    case 'plan':
    case 'question': {
      if (!['planning', 'failed', 'plan_ready'].includes(r.status)) return NextResponse.json({ error: `Statut ${r.status} : plan inattendu` }, { status: 409 });
      const updated = await updateDevRequest(id, { status: 'plan_ready', plan: body.kind === 'question' ? `❓ ${text}` : text });
      if (chatId && updated) await sendDevCard(chatId, updated, body.kind === 'question' ? '❓ <b>Claude a besoin d’une précision</b>' : '📋 <b>Plan prêt — votre validation est requise</b>');
      return NextResponse.json({ ok: true, status: 'plan_ready' });
    }

    case 'done': {
      if (r.status !== 'developing') return NextResponse.json({ error: `Statut ${r.status} : développement inattendu` }, { status: 409 });
      const branch = typeof body.branch === 'string' && BRANCH_RE.test(body.branch) ? body.branch : null;
      const commit = typeof body.commit === 'string' && SHA_RE.test(body.commit) ? body.commit : null;
      if (!branch || !commit) return NextResponse.json({ error: 'branch (claude/…) et commit (SHA) requis' }, { status: 400 });

      let prNumber: number | null = r.pr_number;
      let prError: string | null = null;
      if (isGitHubConfigured()) {
        try {
          const title = (typeof body.title === 'string' && body.title.trim()) || `Demande #${id} : ${r.title}`;
          const pr = await openPullRequest(branch, 'develop', title, `${text}\n\n---\nDemande #${id} confiée à Claude Code depuis Telegram. À valider par le propriétaire.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`);
          prNumber = pr.number;
        } catch (err) {
          prError = err instanceof Error ? err.message : 'erreur GitHub';
        }
      } else {
        prError = 'accès GitHub non configuré';
      }
      const updated = await updateDevRequest(id, { status: 'review', summary: text, branch, commit_sha: commit, pr_number: prNumber ?? undefined });
      if (chatId && updated) {
        await sendDevCard(chatId, updated, '🛠️ <b>Développement terminé — votre validation est requise</b>');
        if (prError) {
          await sendBotMessage(
            chatId,
            `⚠️ PR non ouverte automatiquement (${escapeTelegramHtml(prError)}). Ouvrez-la : ${REPO_URL}/compare/develop...${encodeURIComponent(branch)}?expand=1`,
          );
        }
      }
      return NextResponse.json({ ok: true, status: 'review', pr_number: prNumber });
    }

    case 'failed': {
      const updated = await updateDevRequest(id, { status: 'failed', summary: text });
      if (chatId && updated) await sendDevCard(chatId, updated, '⚠️ <b>Claude est bloqué sur cette demande</b>');
      return NextResponse.json({ ok: true, status: 'failed' });
    }

    default:
      return NextResponse.json({ error: 'kind doit valoir plan, question, done ou failed' }, { status: 400 });
  }
}
