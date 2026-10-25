import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import { getOrCreateSession } from '@/lib/conversation-memory';
import { isAssistantAvailable, isClaudeConfigured, runAssistant } from '@/lib/bot/assistant';

export const maxDuration = 120;

// Pose une question à l'assistant du bot (Claude, ou modèle open source en relais) (mêmes outils, lecture seule conseillée) et renvoie
// sa réponse, sans passer par Telegram. La conversation de test est effacée ensuite.
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!isAssistantAvailable()) {
    return NextResponse.json({ ok: false, error: "Aucune clé d'IA (ANTHROPIC, GROQ, TOGETHER, OPENROUTER) n'est configurée sur ce déploiement." });
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
    const result = await runAssistant(chatId, question, { deliver: false });
    return NextResponse.json({
      ok: result.ok,
      model: result.model,
      claude_configured: isClaudeConfigured(),
      question,
      answer: result.text,
      duration_ms: Date.now() - started,
    });
  } catch (err) {
    console.error('Assistant test error:', err);
    return NextResponse.json({ ok: false, error: "Erreur lors du test de l'assistant" }, { status: 500 });
  } finally {
    await query('DELETE FROM conversation_messages WHERE chat_id = $1', [chatId]).catch(() => {});
    await query('DELETE FROM conversation_sessions WHERE chat_id = $1', [chatId]).catch(() => {});
  }
}
