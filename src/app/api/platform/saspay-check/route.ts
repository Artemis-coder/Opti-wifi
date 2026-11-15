import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { checkSaspayConnection, getSaspayConfig, SaspayError } from '@/lib/saspay/client';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

// « Tester la connexion SasPay » (back-office) : vérifie la clé là où elle est configurée
// (variables Vercel de l'environnement courant), par un appel en lecture seule.
export async function POST() {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const wait = rateLimit(`saspay-check:${auth.platformUser.id}`, 10, 60_000);
  if (wait) return tooManyRequests(wait);

  const config = getSaspayConfig();
  if (!config.enabled) {
    return NextResponse.json({ data: { ok: false, environment: config.environment, message: config.problem } });
  }
  try {
    const { networks } = await checkSaspayConnection();
    return NextResponse.json({
      data: {
        ok: true,
        environment: config.environment,
        webhook_secret: config.hasWebhookSecret,
        message: `Clé acceptée par SasPay : ${networks.length} réseau(x) d'encaissement ouvert(s).`,
        networks,
      },
    });
  } catch (err) {
    const status = err instanceof SaspayError ? err.status : 0;
    const message =
      status === 401
        ? 'Clé refusée par SasPay (invalide, expirée ou révoquée).'
        : status === 403
          ? 'Clé sans les droits nécessaires (scope PAYIN requis) ou compte suspendu.'
          : status === 429
            ? 'Trop de requêtes : réessayez dans une minute.'
            : status === 0
              ? 'SasPay injoignable pour le moment.'
              : `Réponse SasPay inattendue (HTTP ${status}).`;
    return NextResponse.json({ data: { ok: false, environment: config.environment, message } });
  }
}
