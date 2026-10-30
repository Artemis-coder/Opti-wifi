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

// ── Fin de période d'essai ───────────────────────────────────────────────────

/** Paliers de rappel avant la fin d'un essai, en jours (seuls ceux plus courts que l'essai sont envoyés) */
export const TRIAL_REMINDER_DAYS = [3, 1] as const;

/** Palier à envoyer pour un essai de `trialDays` jours qui se termine dans `daysLeft` jours. */
export function trialReminderStage(daysLeft: number, trialDays: number): number | null {
  if (daysLeft < 0) return null;
  const stages = TRIAL_REMINDER_DAYS.filter((d) => d < trialDays).sort((a, b) => a - b);
  return stages.find((d) => daysLeft <= d) ?? null;
}

/** Forfait proposé à la fin de l'essai (forfait de base) */
export interface OfferedPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billing_period: string;
}

const PERIOD: Record<string, string> = { monthly: 'mois', quarterly: 'trimestre', semiannual: 'semestre', annual: 'an' };

function offer(plan: OfferedPlan | null): string {
  if (!plan) return 'Choisissez un forfait';
  const price = `${new Intl.NumberFormat('fr-FR').format(plan.price)} ${plan.currency === 'XOF' ? 'FCFA' : plan.currency}`;
  return `Passez au forfait ${plan.name} (${price} / ${PERIOD[plan.billing_period] || plan.billing_period})`;
}

/** Lien vers la page Abonnement, demande du forfait proposé ouverte */
export function offerLink(plan: OfferedPlan | null): string {
  return plan ? `/subscription?plan=${plan.id}` : '/subscription';
}

export function trialEndingMessage(daysLeft: number, endLabel: string, plan: OfferedPlan | null) {
  const when = daysLeft <= 0 ? "aujourd'hui" : daysLeft === 1 ? 'demain' : `dans ${daysLeft} jours`;
  return {
    title: `Votre essai gratuit se termine ${when}`,
    body: `Votre période d'essai prend fin le ${endLabel}. ${offer(plan)} pour continuer sans interruption.`,
  };
}

export function trialEndedMessage(endLabel: string, plan: OfferedPlan | null) {
  return {
    title: 'Votre essai gratuit est terminé',
    body: `Votre période d'essai a pris fin le ${endLabel} : l'accès à vos données est suspendu. ${offer(plan)} pour le rétablir.`,
  };
}
