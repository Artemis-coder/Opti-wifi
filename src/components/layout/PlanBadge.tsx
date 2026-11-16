'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { chipVariants } from '@heroui/styles';
import { cn } from '@/lib/utils/cn';

interface PlanInfo {
  name: string | null;
  trial: boolean;
}

/** Badge du forfait : Chip HeroUI pleine (variante primary), lisible en clair comme en sombre. */
export function planBadgeStyle(plan: PlanInfo): { label: string; color: 'accent' | 'success' | 'warning' } {
  const name = (plan.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (plan.trial) return { label: 'Essai', color: 'accent' };
  if (name.includes('decouverte')) return { label: 'Déco', color: 'success' };
  if (name.includes('standard')) return { label: 'Standard', color: 'accent' };
  if (name.includes('pro') || name.includes('decideur')) return { label: 'Pro', color: 'warning' };
  // Autre forfait : son premier mot
  const first = (plan.name || '').split(/\s+/)[0]?.slice(0, 10);
  return { label: first || 'Forfait', color: 'accent' };
}

/**
 * Forfait de l'organisation à côté du nom « OptiSpace » : ESSAI, DÉCO, STANDARD ou PRO.
 * Licence en cours la plus récente ; rien tant qu'elle n'est pas chargée ou sans licence.
 */
export function PlanBadge({ userId }: { userId: string | undefined }) {
  const [plan, setPlan] = useState<PlanInfo | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    createClient()
      .from('subscriptions')
      .select('status, trial_end, end_date, plan:subscription_plans(name)')
      .in('status', ['active', 'trialing'])
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: { status: string; trial_end: string | null; plan: { name: string } | null } | null }) => {
        if (cancelled || !data) return;
        setPlan({ name: data.plan?.name ?? null, trial: data.status === 'trialing' || !!data.trial_end });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!plan) return null;
  const { label, color } = planBadgeStyle(plan);
  return (
    <span title={plan.trial ? 'Essai gratuit' : `Forfait ${plan.name ?? ''}`} className={cn(chipVariants({ color, variant: 'primary', size: 'sm' }).base(), 'px-1.5 font-semibold')}>
      {label}
    </span>
  );
}
