// Rappels avant expiration de licence (utilisés par /api/cron/licence-reminders).

/** Paliers de rappel avant expiration, en jours */
export const EXPIRY_REMINDER_DAYS = [10, 5, 2] as const;

/**
 * Palier à envoyer pour une licence qui expire dans `daysLeft` jours (arrondi au jour supérieur) :
 * le plus petit palier encore atteint. Une licence activée à 4 jours de sa fin reçoit
 * directement le rappel J-5, pas ceux de J-10 et J-5 à la fois.
 */
export function reminderStage(daysLeft: number): number | null {
  if (daysLeft < 0) return null;
  const stages = [...EXPIRY_REMINDER_DAYS].sort((a, b) => a - b);
  return stages.find((d) => daysLeft <= d) ?? null;
}

export function expiringMessage(stage: number, daysLeft: number, plan: string, endLabel: string, isTrial: boolean) {
  const when = daysLeft <= 0 ? "aujourd'hui" : daysLeft === 1 ? 'demain' : `dans ${daysLeft} jours`;
  const action = isTrial ? 'Choisissez un forfait' : 'Renouvelez votre abonnement';
  if (stage <= 2) {
    return {
      title: `Votre licence expire ${when}`,
      body: `Dernier rappel : votre forfait ${plan} se termine le ${endLabel}. ${action} maintenant pour ne pas perdre l'accès à vos données.`,
    };
  }
  if (stage <= 5) {
    return {
      title: `Votre licence expire ${when}`,
      body: `Votre forfait ${plan} se termine le ${endLabel}. ${action} pour éviter toute interruption.`,
    };
  }
  return {
    title: `Votre licence expire ${when}`,
    body: `Votre forfait ${plan} se termine le ${endLabel}. Pensez à ${isTrial ? 'choisir un forfait' : 'renouveler votre abonnement'} dès maintenant.`,
  };
}
