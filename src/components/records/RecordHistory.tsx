'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, History, Loader2, Pencil, PlusCircle, Send, Trash2, XCircle, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface HistoryEvent {
  at: string;
  kind: 'created' | 'requested' | 'approved' | 'rejected' | 'cancelled' | 'updated' | 'deleted';
  by: string | null;
  fields?: { field: string; label: string; before: unknown; after: unknown }[];
  action?: 'update' | 'delete';
  note?: string | null;
}

const KIND: Record<HistoryEvent['kind'], { icon: LucideIcon; tone: string }> = {
  created: { icon: PlusCircle, tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  requested: { icon: Send, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  approved: { icon: CheckCircle2, tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  rejected: { icon: XCircle, tone: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  cancelled: { icon: XCircle, tone: 'bg-slate-100 text-slate-500 dark:bg-slate-800' },
  updated: { icon: Pencil, tone: 'bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300' },
  deleted: { icon: Trash2, tone: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
};

const when = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

function value(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (field === 'montant_collecte' || field === 'commission') return formatCurrencyFCFA(Number(v));
  if (field.startsWith('date_')) return new Date(String(v)).toLocaleDateString('fr-FR');
  return String(v);
}

function sentence(e: HistoryEvent, what: string): string {
  const by = e.by ?? 'Quelqu’un';
  switch (e.kind) {
    case 'created':
      return `${what} par ${by}`;
    case 'requested':
      return e.action === 'delete' ? `${by} a demandé la suppression` : `${by} a demandé une correction`;
    case 'approved':
      return e.action === 'delete' ? `Suppression validée par ${by}` : `Correction validée par ${by}`;
    case 'rejected':
      return `Demande refusée par ${by}`;
    case 'cancelled':
      return `Demande annulée par ${by}`;
    case 'updated':
      return `Modifiée par ${by}`;
    case 'deleted':
      return `Supprimée par ${by}`;
  }
}

/**
 * Historique d'une collecte ou d'une allocation : qui a fait quoi, quand (date et heure), et
 * pour chaque correction la valeur avant → après.
 */
export function RecordHistory({ type, id, refreshKey }: { type: 'collection' | 'allocation'; id: string; refreshKey: number }) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/records/history?type=${type}&id=${id}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        if (!cancelled) {
          setEvents(json.data || []);
          setError(false);
        }
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [type, id, refreshKey]);

  if (error && !events) return null; // historique réservé (autre collecteur) ou hors ligne
  const what = type === 'collection' ? 'Collecte enregistrée' : 'Allocation enregistrée';

  return (
    <Card className="p-4 sm:p-6 space-y-4 hover:shadow-xs">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <History className="w-4 h-4 text-brand-600" /> Historique des modifications
      </h2>
      {!events ? (
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </p>
      ) : (
        <ol className="relative space-y-4 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
          {events.map((e, i) => {
            const K = KIND[e.kind];
            return (
              <li key={`${e.at}-${i}`} className="relative flex gap-3">
                <span className={cn('relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0', K.tone)}>
                  <K.icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{sentence(e, what)}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {when(e.at)}
                  </p>
                  {e.fields && e.fields.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {e.fields.map((f) => (
                        <li key={f.field} className="text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-semibold">{f.label}</span> :{' '}
                          <span className="line-through text-slate-400 tabular-nums">{value(f.field, f.before)}</span> →{' '}
                          <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{value(f.field, f.after)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {e.note && (
                    <p className="mt-1 text-xs text-slate-500 italic">
                      {e.kind === 'requested' ? 'Motif' : 'Note'} : « {e.note} »
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
