// ============================================================
// OPTIWIFI - Durée des types de tickets : saisie et affichage en jours.
// En base, la durée reste en heures (ticket_types.duree_heures). Une durée qui n'est pas
// un nombre entier de jours (ex. pass 2 h, 6 h, 12 h) reste exprimée en heures.
// ============================================================

export type DurationUnit = 'jours' | 'heures';

/** « 1 jour », « 30 jours », ou « 12 h » pour une durée de moins d'un jour non entière */
export function formatTicketDuration(hours: number | null | undefined): string {
  const h = Number(hours || 0);
  if (h > 0 && h % 24 === 0) {
    const d = h / 24;
    return `${d} jour${d > 1 ? 's' : ''}`;
  }
  return `${h} h`;
}

/** Valeur du formulaire pour une durée en heures : en jours si possible, sinon en heures */
export function durationToForm(hours: number | null | undefined): { value: string; unit: DurationUnit } {
  const h = Number(hours || 0);
  if (h > 0 && h % 24 === 0) return { value: String(h / 24), unit: 'jours' };
  return { value: h > 0 ? String(h) : '1', unit: h > 0 ? 'heures' : 'jours' };
}

/** Durée saisie → heures enregistrées (null si invalide) */
export function durationToHours(value: string, unit: DurationUnit): number | null {
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const hours = unit === 'jours' ? n * 24 : n;
  return Number.isInteger(hours) ? hours : Math.round(hours);
}
