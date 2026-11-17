/**
 * API de la Mini App « IA — Claude Code » : demandes de développement confiées à Claude.
 * Mêmes actions que les boutons du chat (lib/telegram-dev) ; le détail de chaque étape
 * continue d'arriver dans la conversation Telegram.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { authorizeMiniApp } from '@/lib/telegram-webapp';
import { ensureDevTables, getDevRequest, listDevRequests, OPEN_STATUSES, WAITING_OWNER } from '@/lib/dev-requests';
import { REPO_URL } from '@/lib/github';
import type { DevRequest } from '@/lib/dev-requests';
import { devConfiguration, handleDevCallback, productionPreview, submitDevFeedback, submitDevRequest } from '@/lib/telegram-dev';

export const dynamic = 'force-dynamic';

const ACTIONS = ['approve', 'retry', 'abandon', 'merge'] as const;

/** Lien de la PR calculé côté serveur (dépôt du projet). */
const withPr = (r: DevRequest) => ({ ...r, pr_url: r.pr_number ? `${REPO_URL}/pull/${r.pr_number}` : null });

function chatId(): string {
  return process.env.TELEGRAM_CHAT_ID?.trim() || '';
}

export async function GET(request: Request) {
  const denied = await authorizeMiniApp(request);
  if (denied) return denied;
  const url = new URL(request.url);
  try {
    await ensureDevTables();
    switch (url.searchParams.get('view') || 'overview') {
      case 'overview': {
        const [byStatus, weekly, waiting, open] = await Promise.all([
          query(`SELECT status, COUNT(*)::int AS n FROM dev_requests GROUP BY status`),
          query(
            `SELECT to_char(w, 'YYYY-MM-DD') AS week,
                    (SELECT COUNT(*) FROM dev_requests r
                      WHERE r.created_at >= w AND r.created_at < w + interval '7 days')::int AS created,
                    (SELECT COUNT(*) FROM dev_requests r
                      WHERE r.status IN ('integrated', 'in_production')
                        AND r.updated_at >= w AND r.updated_at < w + interval '7 days')::int AS delivered
               FROM generate_series(date_trunc('week', NOW()) - interval '7 weeks', date_trunc('week', NOW()), interval '1 week') w
              ORDER BY w`
          ),
          listDevRequests(WAITING_OWNER, 10),
          listDevRequests(OPEN_STATUSES, 20),
        ]);
        return NextResponse.json({ byStatus: byStatus.rows, weekly: weekly.rows, waiting: waiting.map(withPr), open: open.map(withPr), config: devConfiguration() });
      }
      case 'list':
        return NextResponse.json({ requests: (await listDevRequests(url.searchParams.get('scope') === 'open' ? OPEN_STATUSES : null, 40)).map(withPr) });
      case 'request': {
        const r = await getDevRequest(Number(url.searchParams.get('id')));
        return r ? NextResponse.json({ request: withPr(r) }) : NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
      }
      case 'production':
        return NextResponse.json(await productionPreview());
      default:
        return NextResponse.json({ error: 'Vue inconnue.' }, { status: 400 });
    }
  } catch (err) {
    console.error('Mini App IA read error:', err);
    return NextResponse.json({ error: 'Lecture des demandes impossible.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await authorizeMiniApp(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { action?: string; id?: number; text?: string } | null;
  const action = body?.action || '';
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 4000) : '';
  const id = Number(body?.id);
  const chat = chatId();

  try {
    await ensureDevTables();
    if (action === 'new') {
      if (text.length < 10) return NextResponse.json({ error: 'Décrivez la demande en quelques phrases.' }, { status: 422 });
      const r = await submitDevRequest(chat, text);
      return NextResponse.json({ message: `Demande #${r.id} enregistrée : Claude prépare un plan.`, id: r.id });
    }
    if (action === 'feedback') {
      if (!Number.isInteger(id) || text.length < 3) return NextResponse.json({ error: 'Remarque vide.' }, { status: 422 });
      const result = await submitDevFeedback(chat, id, text);
      return result.ok ? NextResponse.json({ message: result.message }) : NextResponse.json({ error: result.error }, { status: 409 });
    }
    if (action === 'production') {
      // Même circuit que « ✅ Confirmer la mise en production » du chat (PR develop → main fusionnée)
      await handleDevCallback('prodok', '0', chat);
      return NextResponse.json({ message: 'Mise en production lancée : le suivi arrive dans la conversation.' });
    }
    if ((ACTIONS as readonly string[]).includes(action) && Number.isInteger(id)) {
      await handleDevCallback(action, String(id), chat);
      return NextResponse.json({ message: 'Fait : le détail arrive dans la conversation.' });
    }
    return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
  } catch (err) {
    console.error('Mini App IA action error:', err);
    return NextResponse.json({ error: "Erreur technique pendant l'action." }, { status: 500 });
  }
}
