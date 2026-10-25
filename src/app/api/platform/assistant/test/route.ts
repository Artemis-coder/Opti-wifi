import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import { getOrCreateSession } from '@/lib/conversation-memory';
import { CLAUDE_MODEL, isClaudeConfigured, runClaudeAssistant } from '@/lib/bot/assistant';

export const maxDuration = 120;

// Pose une question à l'assistant Claude du bot (mêmes outils, lecture seule conseillée) et renvoie
// sa réponse, sans passer par Telegram. La conversation de test est effacée ensuite.
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!isClaudeConfigured()) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY n'est pas configurée sur ce déploiement." });
  }

  const body = await request.json().catch(() => ({}));
  const question =
    typeof body.question === 'string' && body.question.trim()
      ? body.question.trim().slice(0, 500)
      : "Donne-moi la vue d'ensemble de la plateforme en quelques lignes.";
  const chatId = `platform-test-${auth.platformUser.id}`;
  const started = Date.now();

  try {
    await getOrCreateSession(chatId);
    const answer = await runClaudeAssistant(chatId, question, { deliver: false });
    const failed = answer.startsWith('❌') || answer.startsWith('⏳');
    return NextResponse.json({ ok: !failed, model: CLAUDE_MODEL, question, answer, duration_ms: Date.now() - started });
  } catch (err) {
    console.error('Assistant test error:', err);
    return NextResponse.json({ ok: false, error: "Erreur lors du test de l'assistant" }, { status: 500 });
  } finally {
    await query('DELETE FROM conversation_messages WHERE chat_id = $1', [chatId]).catch(() => {});
    await query('DELETE FROM conversation_sessions WHERE chat_id = $1', [chatId]).catch(() => {});
  }
}
