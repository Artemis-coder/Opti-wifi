import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/neon/server';
import { getOpenRouterClient } from '@/lib/openrouter';

/**
 * Endpoint de test LLM (OpenRouter) — admin only, dev/preview uniquement.
 */
export async function GET() {
  // Désactiver complètement en production
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Endpoint non disponible.' }, { status: 404 });
  }

  // Réservé au super admin (consomme des crédits d'IA)
  const admin = await requirePlatformAdmin();
  if ('error' in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  try {
    const client = getOpenRouterClient();
    const response = await client.chatCompletion({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: 'Say hello in French' }],
      max_tokens: 50,
    });
    return NextResponse.json({ ok: true, response: response.choices[0].message.content });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Échec du test LLM.' }, { status: 500 });
  }
}
