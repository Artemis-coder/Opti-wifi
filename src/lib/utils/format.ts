export function formatCurrencyFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(amount).replace('XOF', 'FCFA');
}

export function formatDateFR(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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
