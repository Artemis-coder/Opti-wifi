import { query } from '@/lib/neon/db';

export interface PaymentMethod {
  id: string;
  /** Opérateur (ex. Wave) */
  name: string;
  /** Numéro de paiement, que le client peut copier */
  account_number: string;
  /** Titulaire du compte */
  account_name: string | null;
  /** Numéro (WhatsApp) auquel envoyer le justificatif ; vide = account_number */
  receipt_number: string | null;
  /** Instructions de paiement */
  description: string | null;
  /** QR code de paiement d'OptiWifi */
  logo: string | null;
  /** Logo de l'opérateur (ex. pingouin Wave), affiché à côté de « Payez avec » */
  brand_logo: string | null;
  /** Couleur de l'affiche (#rrggbb) */
  brand_color: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/** Images : data URL (PNG, JPEG, WebP). QR code 1 000 000 caractères max (~730 Ko), logo 300 000. */
const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const MAX_LOGO_LENGTH = 1_000_000;
export const MAX_BRAND_LOGO_LENGTH = 300_000;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export type PaymentMethodInput = Pick<
  PaymentMethod,
  'name' | 'account_number' | 'account_name' | 'receipt_number' | 'description' | 'logo' | 'brand_logo' | 'brand_color' | 'is_active' | 'sort_order'
>;

/**
 * Valide les champs envoyés par le back-office. `partial` : seuls les champs présents sont vérifiés (PATCH).
 */
export function parsePaymentMethodInput(
  body: Record<string, unknown>,
  partial = false
): { ok: true; data: Partial<PaymentMethodInput> } | { ok: false; error: string } {
  const data: Partial<PaymentMethodInput> = {};
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  if (!partial || 'name' in body) {
    const name = str(body.name);
    if (!name || name.length > 100) return { ok: false, error: 'Nom requis (100 caractères max)' };
    data.name = name;
  }
  if (!partial || 'account_number' in body) {
    const num = str(body.account_number);
    if (!num || num.length > 50) return { ok: false, error: 'Numéro requis (50 caractères max)' };
    data.account_number = num;
  }
  if ('account_name' in body) {
    const v = str(body.account_name);
    if (v.length > 100) return { ok: false, error: 'Titulaire : 100 caractères max' };
    data.account_name = v || null;
  }
  if ('receipt_number' in body) {
    const v = str(body.receipt_number);
    if (v.length > 50) return { ok: false, error: 'Numéro du justificatif : 50 caractères max' };
    data.receipt_number = v || null;
  }
  if ('brand_color' in body) {
    const v = str(body.brand_color);
    if (v && !COLOR_RE.test(v)) return { ok: false, error: 'Couleur invalide (format #1dc3ff)' };
    data.brand_color = v ? v.toLowerCase() : null;
  }
  if ('brand_logo' in body) {
    const v = body.brand_logo;
    if (v === null || v === '') data.brand_logo = null;
    else if (typeof v !== 'string' || !IMAGE_RE.test(v)) return { ok: false, error: 'Logo invalide (PNG, JPEG ou WebP)' };
    else if (v.length > MAX_BRAND_LOGO_LENGTH) return { ok: false, error: 'Logo trop lourd' };
    else data.brand_logo = v;
  }
  if ('description' in body) {
    const v = str(body.description);
    if (v.length > 1000) return { ok: false, error: 'Description : 1000 caractères max' };
    data.description = v || null;
  }
  if ('logo' in body) {
    const logo = body.logo;
    if (logo === null || logo === '') data.logo = null;
    else if (typeof logo !== 'string' || !IMAGE_RE.test(logo)) return { ok: false, error: 'QR code invalide (PNG, JPEG ou WebP)' };
    else if (logo.length > MAX_LOGO_LENGTH) return { ok: false, error: 'QR code trop lourd' };
    else data.logo = logo;
  }
  if ('is_active' in body) {
    if (typeof body.is_active !== 'boolean') return { ok: false, error: 'Statut invalide' };
    data.is_active = body.is_active;
  }
  if ('sort_order' in body) {
    const n = Number(body.sort_order);
    if (!Number.isInteger(n) || n < 0 || n > 999) return { ok: false, error: 'Ordre invalide (0 à 999)' };
    data.sort_order = n;
  }
  return { ok: true, data };
}

export const PAYMENT_METHOD_COLUMNS =
  'id, name, account_number, account_name, receipt_number, description, logo, brand_logo, brand_color, is_active, sort_order, created_at, updated_at';

export async function listPaymentMethods(activeOnly: boolean): Promise<PaymentMethod[]> {
  const { rows } = await query(
    `SELECT ${PAYMENT_METHOD_COLUMNS} FROM payment_methods
      WHERE ($1::boolean = false OR is_active = true)
      ORDER BY sort_order ASC, created_at ASC`,
    [activeOnly]
  );
  return rows as PaymentMethod[];
}
