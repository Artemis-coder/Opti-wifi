import { query } from '@/lib/neon/db';

export { internalPosAccountEmail, isInternalPosAccountEmail } from '@/lib/pos-account-email';

/**
 * Connexion d'un compte « point de vente » par son numéro de téléphone.
 * Le numéro est comparé chiffres seuls, avec ou sans indicatif pays :
 * « 07 07 07 07 07 », « +225 0707070707 » et « 2250707070707 » désignent le même compte.
 */

/** Nombre minimal de chiffres pour qu'un numéro serve d'identifiant. */
export const MIN_PHONE_DIGITS = 8;

/** Chiffres seuls d'un numéro (espaces, +, tirets retirés). */
export function phoneDigits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

/** Un identifiant de connexion sans « @ » est traité comme un numéro de téléphone. */
export function looksLikePhone(identifier: string): boolean {
  return !identifier.includes('@') && phoneDigits(identifier).length >= MIN_PHONE_DIGITS;
}

/**
 * Comptes point de vente (non supprimés) dont le numéro correspond : identique, ou identique
 * à l'indicatif pays près (l'un se termine par l'autre).
 */
export async function findPosAccountsByPhone(
  phone: string,
  excludeProfileId: string | null = null,
): Promise<{ id: string; email: string; organization_id: string | null }[]> {
  const digits = phoneDigits(phone);
  if (digits.length < MIN_PHONE_DIGITS) return [];
  const res = await query(
    `SELECT p.id, u.email, p.organization_id
       FROM profiles p
       JOIN users u ON u.id = p.id
      WHERE p.role = 'point_de_vente' AND p.deleted_at IS NULL
        AND ($2::uuid IS NULL OR p.id <> $2::uuid)
        AND length(regexp_replace(p.telephone, '\\D', '', 'g')) >= ${MIN_PHONE_DIGITS}
        AND (
          regexp_replace(p.telephone, '\\D', '', 'g') = $1
          OR $1 LIKE '%' || regexp_replace(p.telephone, '\\D', '', 'g')
          OR regexp_replace(p.telephone, '\\D', '', 'g') LIKE '%' || $1
        )`,
    [digits, excludeProfileId],
  );
  return res.rows.map((r) => ({ id: r.id as string, email: r.email as string, organization_id: (r.organization_id as string) ?? null }));
}

/**
 * E-mail du compte point de vente correspondant à ce numéro, pour la connexion.
 * null si aucun compte, ou si le numéro est ambigu (plusieurs comptes).
 */
export async function resolvePosAccountLogin(phone: string): Promise<string | null> {
  const matches = await findPosAccountsByPhone(phone);
  return matches.length === 1 ? matches[0].email : null;
}
