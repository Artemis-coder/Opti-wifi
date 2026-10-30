// ============================================================
// OPTIWIFI - Pays et indicatifs téléphoniques (utilisable côté client et serveur)
// Sert au champ « Téléphone » de l'inscription (drapeau + indicatif) et au pays des
// organisations (KPI « Top 3 des pays »).
// ============================================================

export interface Country {
  /** Code ISO 3166-1 alpha-2 */
  code: string;
  /** Indicatif sans « + » */
  dial: string;
}

/** Pays proposés : Afrique de l'Ouest et centrale en tête, puis les autres. */
export const COUNTRIES: Country[] = [
  { code: 'CI', dial: '225' }, { code: 'SN', dial: '221' }, { code: 'ML', dial: '223' }, { code: 'BF', dial: '226' },
  { code: 'NE', dial: '227' }, { code: 'TG', dial: '228' }, { code: 'BJ', dial: '229' }, { code: 'GN', dial: '224' },
  { code: 'CM', dial: '237' }, { code: 'GA', dial: '241' }, { code: 'CG', dial: '242' }, { code: 'CD', dial: '243' },
  { code: 'TD', dial: '235' }, { code: 'CF', dial: '236' }, { code: 'GQ', dial: '240' }, { code: 'MR', dial: '222' },
  { code: 'GW', dial: '245' }, { code: 'GH', dial: '233' }, { code: 'NG', dial: '234' }, { code: 'LR', dial: '231' },
  { code: 'SL', dial: '232' }, { code: 'GM', dial: '220' }, { code: 'CV', dial: '238' }, { code: 'MA', dial: '212' },
  { code: 'DZ', dial: '213' }, { code: 'TN', dial: '216' }, { code: 'EG', dial: '20' }, { code: 'MG', dial: '261' },
  { code: 'MU', dial: '230' }, { code: 'KM', dial: '269' }, { code: 'DJ', dial: '253' }, { code: 'RW', dial: '250' },
  { code: 'BI', dial: '257' }, { code: 'KE', dial: '254' }, { code: 'ZA', dial: '27' }, { code: 'FR', dial: '33' },
  { code: 'BE', dial: '32' }, { code: 'CH', dial: '41' }, { code: 'LU', dial: '352' }, { code: 'GB', dial: '44' },
  { code: 'DE', dial: '49' }, { code: 'ES', dial: '34' }, { code: 'IT', dial: '39' }, { code: 'PT', dial: '351' },
  { code: 'CA', dial: '1' }, { code: 'US', dial: '1' }, { code: 'HT', dial: '509' }, { code: 'AE', dial: '971' },
  { code: 'CN', dial: '86' },
];

export const DEFAULT_COUNTRY = 'CI';

export function findCountry(code: string | null | undefined): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/** Nom du pays en français (« Côte d’Ivoire »). */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

/** Drapeau emoji d'un code pays. */
export function countryFlag(code: string): string {
  return String.fromCodePoint(...code.split('').map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

/** Pays déduit d'un numéro au format international (+225…, 00225…) : indicatif le plus long d'abord. */
export function countryFromPhone(phone: string | null | undefined): string | null {
  const digits = (phone || '').replace(/[\s.\-()]/g, '');
  const m = digits.match(/^(?:\+|00)(\d+)/);
  if (!m) return null;
  const match = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => m[1].startsWith(c.dial) && !(c.dial === '1' && c.code === 'CA'));
  return match?.code ?? null;
}

/** Numéro national valide : 6 à 14 chiffres (espaces, points et tirets acceptés). */
export function isValidNationalNumber(value: string): boolean {
  const digits = value.replace(/[\s.\-]/g, '');
  return /^\d{6,14}$/.test(digits);
}

/** Numéro complet enregistré : « +225 0700000000 ». */
export function formatInternationalPhone(country: Country, national: string): string {
  return `+${country.dial} ${national.replace(/[\s.\-]/g, '')}`;
}
