export const AUTH_COOKIE_NAME = 'neon-auth-token';

const JWT_SECRET = process.env.JWT_SECRET || 'optiwifi-neon-secret-key-change-me';

export interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  organization_id?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  exp?: number;
}

/**
 * Verify a JWT using WebCrypto API (Edge Runtime and Node.js compatible).
 * Zero external dependencies.
 */
export async function verifyNeonToken(token: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = enc.encode(`${headerB64}.${payloadB64}`);
    const base64 = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const rawSig = Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify('HMAC', key, rawSig, data);
    if (!isValid) return null;

    const payloadJson: JwtPayload = JSON.parse(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    );

    if (payloadJson.exp && payloadJson.exp * 1000 < Date.now()) {
      return null;
    }

    return payloadJson;
  } catch {
    return null;
  }
}
