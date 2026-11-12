'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, CalendarCheck, Eye, Loader2, MapPin, Percent, Receipt, Store, Ticket } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { cn } from '@/lib/utils/cn';
import { formatAmountShort, formatDateOnlyFR, formatNumber } from '@/lib/utils/format';
import { useAuthStore } from '@/lib/stores/authStore';
import type { PosAccountDashboard as Data } from '@/lib/pos-account-dashboard';

const money = formatAmountShort;

const MOVEMENT: Record<Data['recent'][number]['kind'], { label: string; icon: React.ElementType; tone: string; href: string }> = {
  allocation: { label: 'Tickets reçus', icon: Ticket, tone: 'text-amber-600 bg-amber-500/10', href: '/allocations' },
  exchange_receive: { label: 'Échange : réception', icon: ArrowDownLeft, tone: 'text-indigo-600 bg-indigo-500/10', href: '/allocations' },
  exchange_return: { label: 'Échange : retour', icon: ArrowUpRight, tone: 'text-slate-600 bg-slate-500/10', href: '/allocations' },
  collection: { label: 'Collecte', icon: Receipt, tone: 'text-emerald-600 bg-emerald-500/10', href: '/collections' },
};

/** Accueil d'un compte point de vente : résumé du mois et derniers mouvements (consultation seule). */
export function PosAccountDashboard() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pos-account/dashboard', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: null }))
      .then((json) => !cancelled && setData(json.data ?? null))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());
  const m = data?.month;
  const gapAlert = !!m && m.gap < 0;

  if (loading) {
    return (
      <div className="py-24 flex justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!data?.pos) {
    return (
      <Card className="p-10 max-w-xl mx-auto text-center space-y-2">
        <Store className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
        <p className="font-semibold text-slate-800 dark:text-slate-100">Aucun point de vente rattaché à ce compte</p>
        <p className="text-sm text-slate-500">Contactez l&apos;administrateur de votre organisation.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bonjour{user?.nom ? `, ${user.nom}` : ''}</p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-brand-600" /> {data.pos.name}
          </h1>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3 h-3" />
            {[data.pos.address, data.pos.city, data.pos.space].filter(Boolean).join(' · ') || 'Adresse non renseignée'}
          </p>
          {data.pos.collector && <p className="text-xs text-slate-500 mt-0.5">Collecteur : {data.pos.collector}</p>}
        </div>
        <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Eye className="w-3.5 h-3.5" /> Consultation seule
        </span>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 first-letter:uppercase">{month}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label="Tickets reçus"
          value={formatNumber(m?.tickets_received ?? 0)}
          icon={Ticket}
          accent="amber"
          hint="Allocations du mois (échanges compris)"
          href="/allocations"
        />
        <StatTile
          label="Total collecté"
          value={money(m?.collected ?? 0)}
          icon={Banknote}
          accent="emerald"
          hint={m?.collections ? `${m.collections} collecte${m.collections > 1 ? 's' : ''}` : 'Aucune collecte ce mois-ci'}
          href="/collections"
        />
        <StatTile
          label="Écart"
          value={`${(m?.gap ?? 0) > 0 ? '+' : ''}${money(m?.gap ?? 0)}`}
          icon={CalendarCheck}
          accent="red"
          alert={gapAlert}
          hint={`Attendu : ${money(m?.expected ?? 0)}`}
        />
        <StatTile label="Ma commission" value={money(m?.commission ?? 0)} icon={Percent} accent="indigo" hint="Total du mois" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 sm:p-5 space-y-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Dernière collecte</h2>
          {data.last_collection ? (
            <Link href={`/collections/${data.last_collection.id}`} className="block group">
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white group-hover:underline">
                {money(data.last_collection.collected)}
              </p>
              <p className="text-xs text-slate-500">le {formatDateOnlyFR(data.last_collection.date)}</p>
              <p
                className={cn(
                  'text-xs font-semibold mt-1',
                  data.last_collection.gap < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400',
                )}
              >
                Écart : {data.last_collection.gap > 0 ? '+' : ''}
                {money(data.last_collection.gap)}
              </p>
            </Link>
          ) : (
            <p className="text-sm text-slate-500">Aucune collecte pour l&apos;instant.</p>
          )}
        </Card>

        <Card className="p-4 sm:p-5 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Derniers mouvements</h2>
            <ArrowLeftRight className="w-4 h-4 text-slate-400" />
          </div>
          {data.recent.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Aucun mouvement pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recent.map((r) => {
                const meta = MOVEMENT[r.kind] ?? MOVEMENT.allocation;
                const Icon = meta.icon;
                const isCollection = r.kind === 'collection';
                return (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link
                      href={`${meta.href}/${r.id}`}
                      className="flex items-center gap-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-1"
                    >
                      <span className={cn('w-9 h-9 shrink-0 rounded-xl flex items-center justify-center', meta.tone)}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {meta.label}
                          {r.label ? ` · ${r.label}` : ''}
                        </span>
                        <span className="block text-xs text-slate-500">{formatDateOnlyFR(r.date)}</span>
                      </span>
                      <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {isCollection
                          ? money(r.value)
                          : `${r.kind === 'exchange_return' ? '−' : '+'}${formatNumber(r.value)} tickets`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
