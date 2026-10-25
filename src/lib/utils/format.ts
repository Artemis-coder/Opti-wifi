export function formatCurrencyFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(amount).replace('XOF', 'FCFA');
}

/**
 * Formate une date et heure au format français complet (ex: 22 oct. 2026 à 17:30).
 * Si la chaîne ne comporte pas d'heure (ex: YYYY-MM-DD), formate uniquement le jour.
 */
export function formatDateFR(dateString?: string | null): string {
  if (!dateString) return '—';
  const hasTime = dateString.includes('T') || dateString.includes(':');
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  if (!hasTime) {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Formate uniquement le jour (ex: 22 oct. 2026) */
export function formatDateOnlyFR(dateString?: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Formate uniquement l'heure (ex: 17:30) */
export function formatTimeOnlyFR(dateString?: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

/**
 * Valeur attendue par <input type="date"> au format YYYY-MM-DD.
 * `toISOString()` renvoie la date UTC : au soir (heure locale) le jour
 * affiché peut être décalé d'un jour par rapport à la date réelle du
 * collecteur. On formatte donc les parties locales de la date.
 */
export function toDateInputValue(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
