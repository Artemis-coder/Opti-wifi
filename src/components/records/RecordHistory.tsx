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
  created: { icon: PlusCircle, tone: 'bg-default text-muted' },
  requested: { icon: Send, tone: 'bg-warning-soft text-warning-soft-foreground' },
  approved: { icon: CheckCircle2, tone: 'bg-success-soft text-success-soft-foreground' },
  rejected: { icon: XCircle, tone: 'bg-danger-soft text-danger' },
  cancelled: { icon: XCircle, tone: 'bg-default text-muted' },
  updated: { icon: Pencil, tone: 'bg-accent-soft text-accent' },
  deleted: { icon: Trash2, tone: 'bg-danger-soft text-danger' },
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
    <Card className="space-y-4 hover:shadow-xs">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <History className="w-4 h-4 text-accent" /> Historique des modifications
      </h2>
      {!events ? (
        <p className="text-sm text-muted flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </p>
      ) : (
        <ol className="relative space-y-4 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-default">
          {events.map((e, i) => {
            const K = KIND[e.kind];
            return (
              <li key={`${e.at}-${i}`} className="relative flex gap-3">
                <span className={cn('relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0', K.tone)}>
                  <K.icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-foreground">{sentence(e, what)}</p>
                  <p className="text-xs text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {when(e.at)}
                  </p>
                  {e.fields && e.fields.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {e.fields.map((f) => (
                        <li key={f.field} className="text-xs text-muted">
                          <span className="font-semibold">{f.label}</span> :{' '}
                          <span className="line-through text-muted tabular-nums">{value(f.field, f.before)}</span> →{' '}
                          <span className="font-semibold text-foreground tabular-nums">{value(f.field, f.after)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {e.note && (
                    <p className="mt-1 text-xs text-muted italic">
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
