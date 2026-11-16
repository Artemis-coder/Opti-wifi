'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Info, Store, UserCheck, Users } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export interface LimitPlan {
  id: string;
  name: string;
  price: number;
  billing_period: string;
  max_users: number | null;
  max_collectors: number | null;
  max_points_of_sale: number | null;
  /** Accès point de vente : 0 = non inclus, null ou négatif = illimité */
  max_pos_accounts?: number | null;
}

export interface PlanLimits {
  plan: { id: string; name: string } | null;
  users: { current: number; limit: number | null };
  collectors: { current: number; limit: number | null };
  /** Accès point de vente : limite 0 = non inclus dans le forfait */
  pos_accounts?: { current: number; limit: number | null };
  plans: LimitPlan[];
}

export type LimitKind = 'users' | 'collectors';

const PERIOD: Record<string, string> = { monthly: 'mois', quarterly: 'trimestre', semiannual: 'semestre', annual: 'an' };

/** Valeur lisible d'une limite : null / négative = illimitée */
function limitLabel(v: number | null, one: string, many: string, none: string): string {
  if (v === null || v < 0) return `${many} illimités`;
  if (v === 0) return none;
  return `${v} ${v > 1 ? many : one}`;
}

/** Vrai si le forfait permet un membre de plus que l'utilisation actuelle */
function allowsMore(plan: LimitPlan, kind: LimitKind, limits: PlanLimits): boolean {
  const v = kind === 'users' ? plan.max_users : plan.max_collectors;
  const current = kind === 'users' ? limits.users.current : limits.collectors.current;
  // Un collecteur est aussi un utilisateur : les deux limites doivent le permettre
  const usersOk = plan.max_users === null || plan.max_users < 0 || plan.max_users > limits.users.current;
  const ok = v === null || v < 0 || v > current;
  return kind === 'collectors' ? ok && usersOk : ok;
}

/**
 * Note d'information quand le forfait ne permet pas d'ajouter un membre (ou un collecteur),
 * avec les forfaits disponibles pour en changer.
 */
export function PlanLimitDialog({
  open,
  kind,
  limits,
  onClose,
}: {
  open: boolean;
  kind: LimitKind;
  limits: PlanLimits | null;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!limits) return null;
  const planName = limits.plan?.name || 'actuel';
  const usage = kind === 'users' ? limits.users : limits.collectors;
  const what =
    kind === 'users'
      ? limitLabel(usage.limit, 'utilisateur', 'utilisateurs', 'aucun utilisateur')
      : limitLabel(usage.limit, 'collecteur', 'collecteurs', 'aucun collecteur');

  return (
    <Modal isOpen={open} onClose={onClose} title="Limite de votre forfait" className="md:max-w-3xl">
      <div className="space-y-5 text-left">
        <div className="flex gap-3 rounded-xl bg-warning-soft p-4">
          <span className="w-9 h-9 shrink-0 rounded-lg bg-warning-soft text-warning-soft-foreground flex items-center justify-center">
            <Info className="w-5 h-5" />
          </span>
          <div className="text-sm text-foreground space-y-1">
            <p className="font-semibold text-foreground">
              {kind === 'users'
                ? "Vous ne pouvez pas ajouter d'autre utilisateur"
                : 'Vous ne pouvez pas ajouter de collecteur'}
            </p>
            <p>
              Votre forfait <strong>{planName}</strong> comprend {what}
              {usage.limit !== null && usage.limit > 0 && <> (déjà {usage.current} dans votre équipe)</>}. Pour{' '}
              {kind === 'users' ? 'ajouter un membre' : 'ajouter un collecteur'}, passez à un forfait qui le permet.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {limits.plans.map((p) => {
            const current = p.id === limits.plan?.id;
            const fits = allowsMore(p, kind, limits);
            return (
              <div
                key={p.id}
                className={cn(
                  'rounded-xl border p-4 flex flex-col gap-3',
                  current
                    ? 'bg-surface-secondary'
                    : fits
                      ? 'border-success/30'
                      : 'border-border opacity-70'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrencyFCFA(Number(p.price))}
                      <span className="text-xs font-medium text-muted"> / {PERIOD[p.billing_period] || p.billing_period}</span>
                    </p>
                  </div>
                  {current ? (
                    <Badge variant="neutral" className="text-xs">Votre forfait</Badge>
                  ) : (
                    fits && <Badge variant="success" className="text-xs">Possible</Badge>
                  )}
                </div>
                <ul className="space-y-1 text-xs text-muted">
                  <li className={cn('flex items-center gap-1.5', kind === 'users' && 'font-semibold text-foreground')}>
                    <Users className="w-3.5 h-3.5 text-muted" />
                    {limitLabel(p.max_users, 'utilisateur', 'utilisateurs', 'aucun utilisateur')}
                  </li>
                  <li className={cn('flex items-center gap-1.5', kind === 'collectors' && 'font-semibold text-foreground')}>
                    <UserCheck className="w-3.5 h-3.5 text-muted" />
                    {limitLabel(p.max_collectors, 'collecteur', 'collecteurs', 'sans collecteur')}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-muted" />
                    {limitLabel(p.max_points_of_sale, 'point de vente', 'points de vente', 'aucun point de vente')}
                  </li>
                </ul>
                <div className="mt-auto">
                  {current ? (
                    <p className="h-9 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted">
                      <CheckCircle2 className="w-4 h-4" /> Forfait actuel
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      variant={fits ? 'primary' : 'outline'}
                      className="w-full"
                      disabled={!fits}
                      onClick={() => router.push(`/subscription?plan=${p.id}`)}
              >
                      {fits ? 'Passer à ce forfait' : 'Ne suffit pas'}
                      {fits && <ArrowRight className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!limits.plans.some((p) => p.id !== limits.plan?.id && allowsMore(p, kind, limits)) && (
          <p className="text-xs text-muted">
            Aucun forfait ne permet davantage pour le moment :{' '}
            <Link href="/support" className="font-semibold text-warning-soft-foreground hover:underline">
              contactez le support
            </Link>{' '}
            pour une offre adaptée.
          </p>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
