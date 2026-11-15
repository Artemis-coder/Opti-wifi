// ============================================================
// OPTIWIFI - Mode de paiement proposé aux clients, choisi par le super admin.
// - « saspay » : un seul bouton « Passer au paiement » (page SasPay), si SasPay est configuré ;
// - « manual » : moyens de paiement manuels (QR code, numéro, justificatif, validation admin).
// Stocké dans platform_settings (une valeur par base : dev et production sont indépendants).
// Si SasPay est choisi mais indisponible (clé absente ou refusée), le manuel est proposé en secours.
// ============================================================
import { query } from '@/lib/neon/db';
import { getSaspayConfig } from '@/lib/saspay/client';

export type PaymentMode = 'saspay' | 'manual';
const KEY = 'payment_mode';

export async function getPaymentMode(): Promise<PaymentMode> {
  try {
    const { rows } = await query(`SELECT value FROM platform_settings WHERE key = $1`, [KEY]);
    return rows[0]?.value === 'manual' ? 'manual' : 'saspay';
  } catch (err) {
    console.error('payment_mode read error:', err);
    return 'saspay';
  }
}

export async function setPaymentMode(mode: PaymentMode): Promise<void> {
  await query(
    `INSERT INTO platform_settings (key, value, description, updated_at)
     VALUES ($1, to_jsonb($2::text), 'Mode de paiement des licences : saspay ou manual', NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [KEY, mode]
  );
}

/** Le paiement en ligne est-il réellement proposé (mode choisi ET SasPay configuré) ? */
export async function isOnlinePaymentOffered(): Promise<boolean> {
  return getSaspayConfig().enabled && (await getPaymentMode()) === 'saspay';
}
