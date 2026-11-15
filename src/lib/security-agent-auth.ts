// ============================================================
// OPTIWIFI - Accès aux incidents de sécurité : super admin connecté, ou agent de sécurité
// (en-tête Authorization: Bearer SECURITY_AGENT_TOKEN, jeton dédié distinct du CRON_SECRET).
// ============================================================
import { timingSafeEqual } from 'crypto';
import { requirePlatformAdmin } from '@/lib/neon/server';
import { reportSecurityEvent } from '@/lib/security-events';

export type SecurityActor = { kind: 'agent' } | { kind: 'admin'; email: string };

export async function authorizeSecurityAccess(request: Request): Promise<SecurityActor | null> {
  const auth = request.headers.get('authorization') || '';
  const token = process.env.SECURITY_AGENT_TOKEN?.trim();
  if (auth.startsWith('Bearer ')) {
    const given = Buffer.from(auth.slice(7));
    const expected = Buffer.from(token || '');
    if (token && given.length === expected.length && timingSafeEqual(given, expected)) return { kind: 'agent' };
    // Jeton pas encore configuré sur ce déploiement : simple oubli de configuration, pas une attaque
    if (!token) return null;
    reportSecurityEvent({ type: 'webhook_bad_secret', request, detail: 'Jeton de l’agent de sécurité invalide' });
    return null;
  }
  const admin = await requirePlatformAdmin();
  if ('error' in admin) return null;
  return { kind: 'admin', email: admin.user.email };
}
