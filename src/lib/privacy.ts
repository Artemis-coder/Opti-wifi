// ============================================================
// OPTIWIFI - Masquage des montants (protection contre les regards indiscrets)
// L'état est lu par formatCurrencyFCFA : tous les montants affichés passent par lui.
// Côté serveur, rien n'est jamais masqué (e-mails, factures générées, exports).
// ============================================================
let hidden = false;

/** Montants masqués à l'écran en ce moment (lu pendant l'affichage) */
export function amountsHidden(): boolean {
  return hidden;
}

/** Appliqué par AmountsPrivacyBoundary au moment de l'affichage */
export function applyAmountsHidden(value: boolean): void {
  hidden = value;
}

/** Texte affiché à la place d'un montant */
export const MASKED_AMOUNT = '••••••';
