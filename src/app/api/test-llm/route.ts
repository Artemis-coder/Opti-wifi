import { NextResponse } from 'next/server';
import { verifyToken, AUTH_COOKIE_NAME } from '@/lib/neon/auth';
import { getOpenRouterClient } from '@/lib/openrouter';

/**
 * Endpoint de test LLM (OpenRouter) — admin only, dev/preview uniquement.
 */
export async function GET(request: Request) {
  // Désactiver complètement en production
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Endpoint non disponible.' }, { status: 404 });
  }

  // Requiert authentification
  const cookieHeader = request.headers.get('cookie');
  const token = cookieHeader
    ?.split(';')
    .find(c => c.trim().startsWith(AUTH_COOKIE_NAME + '='))
    ?.split('=')[1];

  if (!token || !verifyToken(token)) {
    return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (payload?.role !== 'administrateur') {
    return NextResponse.json({ ok: false, error: 'Accès réservé aux administrateurs.' }, { status: 403 });
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
