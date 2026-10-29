'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Headset, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { STATUS_INFO, categoryLabel, priorityLabel, type TicketListItem, type TicketMessage } from '@/components/support/labels';

const fullDate = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

interface TicketThreadProps {
  /** /api/support/<id> (client) ou /api/platform/support/<id> (support) */
  endpoint: string;
  viewer: 'client' | 'support';
  backHref: string;
  backLabel: string;
  /** Commandes du support (statut, priorité) */
  renderControls?: (ticket: TicketListItem, reload: () => void) => React.ReactNode;
}

/** Fil d'un ticket : en-tête, messages (les siens à droite), zone de réponse. */
export function TicketThread({ endpoint, viewer, backHref, backLabel, renderControls }: TicketThreadProps) {
  const [data, setData] = useState<{ ticket: TicketListItem; messages: TicketMessage[] } | null | 'error'>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    () =>
      fetch(endpoint, { cache: 'no-store' })
        .then(async (res) => {
          const json = await res.json();
          setData(res.ok ? json.data : 'error');
        })
        .catch(() => setData('error')),
    [endpoint]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Arrivée sur le ticket ou nouveau message : on montre le dernier message
  const count = data && data !== 'error' ? data.messages.length : 0;
  useEffect(() => {
    if (count) endRef.current?.scrollIntoView({ block: 'end' });
  }, [count]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error);
      setReply('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  if (data === null) {
    return (
      <div className="py-20 flex justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (data === 'error') {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </Link>
        <p className="py-16 text-center text-sm text-slate-500">Ticket introuvable.</p>
      </div>
    );
  }

  const { ticket, messages } = data;
  const status = STATUS_INFO[ticket.status] || STATUS_INFO.new;
  const closedForClient = viewer === 'client' && ticket.status === 'closed';

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 -ml-1 px-1 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Link>

      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-slate-500">{ticket.ticket_number}</p>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white break-words">{ticket.subject}</h1>
          </div>
          <Badge variant={status.variant} className="shrink-0">
            {status.label}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {viewer === 'support' && ticket.organization_name && (
            <Link href={`/platform/clients/${ticket.organization_id}`} className="font-semibold text-brand-700 dark:text-brand-300 hover:underline">
              {ticket.organization_name}
            </Link>
          )}
          <span>{categoryLabel(ticket.category)}</span>
          {viewer === 'support' && <span>Priorité {priorityLabel(ticket.priority).toLowerCase()}</span>}
          <span>Ouvert le {fullDate(ticket.created_at)}</span>
        </div>
        {renderControls?.(ticket, load)}
      </Card>

      {/* Fil */}
      <div className="space-y-3" aria-live="polite">
        {messages.map((m) => {
          const mine = viewer === 'support' ? m.from_support : !m.from_support;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[88%] sm:max-w-[75%] rounded-2xl px-4 py-3 space-y-1.5 border',
                  mine
                    ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-200 dark:border-brand-800 rounded-br-md'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-bl-md'
                )}
              >
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {m.from_support && <Headset className="w-3.5 h-3.5 text-brand-600" />}
                  {m.from_support ? (viewer === 'client' ? 'Support OptiWifi' : `Support · ${m.author_name || 'OptiWifi'}`) : m.author_name || 'Client'}
                </p>
                <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-line break-words">{m.body}</p>
                <p className="text-[11px] text-slate-400">{fullDate(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Réponse */}
      {closedForClient ? (
        <p className="text-sm text-slate-500 text-center py-2">Ce ticket est fermé. Ouvrez un nouveau ticket si besoin.</p>
      ) : (
        <form onSubmit={send} className="sticky bottom-0 sm:static bg-slate-50/95 dark:bg-slate-950/95 sm:bg-transparent backdrop-blur-sm -mx-1 px-1 py-2 space-y-2">
          <label htmlFor="ticket-reply" className="sr-only">
            Votre réponse
          </label>
          <textarea
            id="ticket-reply"
            rows={3}
            maxLength={5000}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={viewer === 'support' ? 'Répondre au client…' : 'Écrire au support…'}
            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <div className="flex justify-end">
            <Button type="submit" icon={Send} isLoading={sending} disabled={!reply.trim()} className="w-full sm:w-auto font-semibold">
              Envoyer
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
