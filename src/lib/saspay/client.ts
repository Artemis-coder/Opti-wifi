// ============================================================
// OPTIWIFI - Client de l'API SasPay (paiement en ligne des licences).
// Doc : https://docs.saspay.me — la spécification OpenAPI fait foi.
// - Appels uniquement côté serveur : la clé n'est jamais envoyée au navigateur ni journalisée.
// - Garde-fou : clé live (sk_live_) seulement en production Vercel, clé de test jamais en production.
// ============================================================

const DEFAULT_BASE_URL = 'https://api.saspay.me/api/v1';
const TIMEOUT_MS = 15_000;

export type SaspayEnvironment = 'SANDBOX' | 'LIVE';

export interface SaspayConfig {
  /** Paiement en ligne proposé aux clients (activé et correctement configuré). */
  enabled: boolean;
  environment: SaspayEnvironment | null;
  /** Raison pour laquelle le paiement en ligne est indisponible (diagnostic admin). */
  problem: string | null;
  hasWebhookSecret: boolean;
}

function apiKey(): string {
  return process.env.SASPAY_API_KEY?.trim() || '';
}

export function getSaspayConfig(): SaspayConfig {
  const key = apiKey();
  const environment: SaspayEnvironment | null = key.startsWith('sk_live_')
    ? 'LIVE'
    : key.startsWith('sk_test_')
      ? 'SANDBOX'
      : null;
  const isVercelProduction = process.env.VERCEL_ENV === 'production';

  let problem: string | null = null;
  if (process.env.SASPAY_ENABLED !== 'true') problem = 'Paiement en ligne désactivé (SASPAY_ENABLED)';
  else if (!key) problem = 'Clé API SasPay absente (SASPAY_API_KEY)';
  else if (!environment) problem = 'Clé API SasPay au format inattendu (sk_test_… ou sk_live_… attendu)';
  else if (environment === 'LIVE' && !isVercelProduction) problem = 'Clé live refusée hors production';
  else if (environment === 'SANDBOX' && isVercelProduction) problem = 'Clé de test refusée en production';

  return {
    enabled: problem === null,
    environment,
    problem,
    hasWebhookSecret: Boolean(process.env.SASPAY_WEBHOOK_SECRET?.trim()),
  };
}

/** Erreur renvoyée par SasPay (ou réseau). `status` 0 = pas de réponse (timeout, coupure). */
export class SaspayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null = null
  ) {
    super(message);
    this.name = 'SaspayError';
  }
}

async function saspayRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  opts: { idempotencyKey?: string } = {}
): Promise<T> {
  const config = getSaspayConfig();
  if (!config.enabled) throw new SaspayError(config.problem || 'SasPay indisponible', 503, 'not_configured');

  const base = (process.env.SASPAY_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (err) {
    // Timeout ou coupure : l'opération a pu aboutir côté SasPay, ne rien conclure
    throw new SaspayError(`SasPay injoignable : ${err instanceof Error ? err.message : 'erreur réseau'}`, 0, 'network');
  }

  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: T; error?: { message?: string; code?: string } | Record<string, string[]> }
    | null;

  if (!res.ok || !json || json.success === false) {
    const err = json?.error;
    const code = err && typeof (err as { code?: unknown }).code === 'string' ? (err as { code: string }).code : null;
    const message =
      err && typeof (err as { message?: unknown }).message === 'string'
        ? (err as { message: string }).message
        : err
          ? `Requête refusée : ${Object.keys(err).join(', ')}`
          : `Réponse SasPay inattendue (HTTP ${res.status})`;
    throw new SaspayError(message, res.status, code);
  }
  return json.data as T;
}

// ── Types (champs utilisés seulement) ─────────────────────────────────────────

export interface CheckoutSession {
  id: string;
  slug: string;
  checkout_url: string;
  amount: string;
  currency: string;
  status: string;
  transaction: string | null;
  expires_at: string | null;
}

export interface CheckoutSessionStatus {
  id: string;
  status: string; // PENDING | PAID | CANCELLED | EXPIRED
  transaction_id: string | null;
  transaction_status: string | null; // PENDING | SUCCESS | FAILED
  transaction_reference: string | null;
}

export interface VerifiedTransaction {
  id: string;
  reference: string;
  status: string; // PENDING | SUCCESS | FAILED
  flow_direction: string; // INBOUND | OUTBOUND
  requested_amount: string;
  debited_amount: string | null;
  net_amount: string | null;
  currency: string;
  network_code?: string | null;
  external_reference?: string | null;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export function createCheckoutSession(input: {
  amount: string;
  currency: string;
  description: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string | null;
  country?: string | null;
  returnUrl: string;
  metadata: Record<string, string>;
}): Promise<CheckoutSession> {
  return saspayRequest<CheckoutSession>('POST', '/checkout-sessions/', {
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    customer_email: input.customerEmail,
    customer_name: input.customerName,
    ...(input.customerPhone ? { customer_phone: input.customerPhone } : {}),
    ...(input.country ? { country: input.country } : {}),
    return_url: input.returnUrl,
    metadata: input.metadata,
  });
}

export function getCheckoutSessionStatus(sessionId: string): Promise<CheckoutSessionStatus> {
  return saspayRequest<CheckoutSessionStatus>('GET', `/checkout-sessions/${encodeURIComponent(sessionId)}/status/`);
}

export function cancelCheckoutSession(sessionId: string): Promise<unknown> {
  return saspayRequest('POST', `/checkout-sessions/${encodeURIComponent(sessionId)}/cancel/`, {});
}

/** Revérifie l'état réel auprès de l'opérateur si la transaction est encore en attente. */
export function verifyPayment(transactionId: string): Promise<VerifiedTransaction> {
  return saspayRequest<VerifiedTransaction>('GET', `/payments/${encodeURIComponent(transactionId)}/verify/`);
}

/** Détail d'une transaction (fournit le code réseau, ex. mtn_bj). */
export function getTransaction(transactionId: string): Promise<VerifiedTransaction> {
  return saspayRequest<VerifiedTransaction>('GET', `/transactions/${encodeURIComponent(transactionId)}/`);
}

// ── Vérification de configuration ────────────────────────────────────────────

export interface MyRate {
  country_code: string;
  network_code: string;
  network_name: string;
  currency: string;
  payin?: { available: boolean; otp_required?: boolean } | null;
}

/**
 * Teste la clé en conditions réelles : GET /pricing/my-rates/ (authentifié, lecture seule, sans
 * effet). Renvoie les réseaux d'encaissement ouverts au compte.
 */
export async function checkSaspayConnection(): Promise<{ networks: { country: string; code: string; name: string; otp: boolean }[] }> {
  const data = await saspayRequest<MyRate[] | { results?: MyRate[] }>('GET', '/pricing/my-rates/');
  const rates = Array.isArray(data) ? data : data?.results || [];
  return {
    networks: rates
      .filter((r) => r.payin?.available)
      .map((r) => ({ country: r.country_code, code: r.network_code, name: r.network_name, otp: Boolean(r.payin?.otp_required) })),
  };
}
