// ============================================================
// OPTIWIFI - Authentification de l'agent de développement (routine Claude Code) :
// en-tête Authorization: Bearer DEV_AGENT_TOKEN, jeton dédié (distinct de SECURITY_AGENT_TOKEN).
// ============================================================
import { timingSafeEqual } from 'crypto';
import { reportSecurityEvent } from '@/lib/security-events';

export function isDevAgentRequest(request: Request): boolean {
  const token = process.env.DEV_AGENT_TOKEN?.trim();
  const auth = request.headers.get('authorization') || '';
  if (!token || !auth.startsWith('Bearer ')) return false;
  const given = Buffer.from(auth.slice(7));
  const expected = Buffer.from(token);
  if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  reportSecurityEvent({ type: 'webhook_bad_secret', request, detail: 'Jeton de l’agent de développement invalide' });
  return false;
}
