// ============================================================
// OPTIWIFI - Vérification des webhooks SasPay.
// Signature : HMAC-SHA256 hex de `${X-Webhook-Timestamp}.${corps brut}` avec le secret du webhook.
// Deux contrôles : fraîcheur (300 s) et signature, comparée en temps constant.
// ============================================================
import { createHmac, timingSafeEqual } from 'crypto';

export const WEBHOOK_TOLERANCE_SECONDS = 300;

export type SignatureCheck = { ok: true } | { ok: false; reason: 'missing' | 'stale' | 'mismatch' | 'no_secret' };

export function verifySaspaySignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): SignatureCheck {
  if (!secret) return { ok: false, reason: 'no_secret' };
  if (!signature || !timestamp || !/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: 'missing' };
  if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: 'stale' };

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(signature.trim().toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: 'mismatch' };
}
