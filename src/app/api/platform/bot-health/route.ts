import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { registerTelegramWebhook, runBotHealth } from '@/lib/bot-health';

export const maxDuration = 30;

// Santé du bot (super admin) : diagnostic exécuté sur le serveur, statuts uniquement.
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const origin = new URL(request.url).origin;
    return NextResponse.json({ data: await runBotHealth(origin), environment: process.env.VERCEL_ENV || 'development', origin });
  } catch (err) {
    console.error('Bot health error:', err);
    return NextResponse.json({ error: 'Erreur pendant le diagnostic' }, { status: 500 });
  }
}

// Réenregistre le webhook Telegram sur ce site, avec le secret du déploiement.
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const result = await registerTelegramWebhook(new URL(request.url).origin);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error('Webhook register error:', err);
    return NextResponse.json({ ok: false, message: "Erreur pendant l'enregistrement du webhook" }, { status: 500 });
  }
}
