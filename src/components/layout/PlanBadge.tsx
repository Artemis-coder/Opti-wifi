'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';

interface PlanInfo {
  name: string | null;
  trial: boolean;
}

/** Badge du forfait : libellé court et couleur propres à chaque formule. */
export function planBadgeStyle(plan: PlanInfo): { label: string; className: string } {
  const name = (plan.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (plan.trial) return { label: 'ESSAI', className: 'bg-sky-500/20 text-sky-300 border-sky-400/40' };
  if (name.includes('decouverte')) return { label: 'DÉCO', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' };
  if (name.includes('standard')) return { label: 'STANDARD', className: 'bg-indigo-500/25 text-indigo-200 border-indigo-400/40' };
  if (name.includes('pro') || name.includes('decideur')) {
    return { label: 'PRO', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  }
  // Autre forfait : son premier mot
  const first = (plan.name || '').split(/\s+/)[0]?.toUpperCase().slice(0, 10);
  return { label: first || 'FORFAIT', className: 'bg-slate-500/20 text-slate-300 border-slate-400/30' };
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
  const { label, className } = planBadgeStyle(plan);
  return (
    <span
      title={plan.trial ? 'Essai gratuit' : `Forfait ${plan.name ?? ''}`}
      className={cn('shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border tracking-wide', className)}
    >
      {label}
    </span>
  );
}
