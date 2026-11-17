'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LifeBuoy, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { AddButton } from '@/components/ui/AddButton';
import type { SelectOption } from '@/components/ui/CustomSelect';
import { TicketList } from '@/components/support/TicketList';
import { NewTicketForm } from '@/components/support/NewTicketForm';
import { STATUS_INFO, type TicketListItem } from '@/components/support/labels';
import { cn } from '@/lib/utils/cn';

const STATUS_FILTERS = ['new', 'in_progress', 'resolved', 'closed'] as const;
const STATUS_PLURALS: Record<string, string> = { new: 'Nouveaux', in_progress: 'En cours', resolved: 'Résolus', closed: 'Fermés' };

export default function PlatformSupportPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('');
  const [result, setResult] = useState<{ key: string; tickets: TicketListItem[]; counts: Record<string, number> } | null>(null);
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<SelectOption[]>([]);
  const loading = result?.key !== status;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/platform/support${status ? `?status=${status}` : ''}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: [], counts: {} }))
      .then((json) => !cancelled && setResult({ key: status, tickets: json.data || [], counts: json.counts || {} }))
      .catch(() => !cancelled && setResult({ key: status, tickets: [], counts: {} }));
    return () => {
      cancelled = true;
    };
  }, [status]);

  const openForm = () => {
    setOpen(true);
    if (clients.length) return;
    fetch('/api/platform/clients?limit=500')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) =>
        setClients(
          ((json.data || []) as { id: string; name: string; contact_name?: string | null; status: string }[])
            .filter((c) => c.status !== 'archived')
            .map((c) => ({ value: c.id, label: c.name, sublabel: c.contact_name || undefined }))
        )
      )
      .catch(() => {});
  };

  const counts = result?.counts || {};
  const total = STATUS_FILTERS.reduce((a, s) => a + (counts[s] || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Support</h1>
          <p className="text-xs text-muted">Tickets ouverts par les clients, et par le support pour un client.</p>
        </div>
        <AddButton what="un ticket pour un client" onClick={openForm} />
      </div>

      {/* Compteurs = filtres */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATUS_FILTERS.map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(active ? '' : s)}
              aria-pressed={active}
              className={cn(
                'text-left rounded-xl border p-4 transition',
                active
                  ? 'ring-2 ring-accent/20 bg-accent-soft'
                  : 'border-border bg-surface hover:border-border'
              )}
            >
              <p className="text-xs font-semibold text-muted">{STATUS_PLURALS[s]}</p>
              <p className="text-2xl font-semibold text-foreground tabular-nums">{counts[s] ?? 0}</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>{status ? `Filtre : ${STATUS_INFO[status].label.toLowerCase()}` : `${total} ticket${total > 1 ? 's' : ''} au total`}</span>
        {status && (
          <button type="button" onClick={() => setStatus('')} className="font-semibold text-accent hover:underline">
            Tout afficher
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-10 flex justify-center text-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : result && result.tickets.length === 0 ? (
        <Card className="text-center space-y-3 py-8">
          <LifeBuoy className="w-12 h-12 text-muted mx-auto" />
          <h3 className="text-base font-semibold text-foreground">Aucun ticket</h3>
          <p className="text-xs text-muted">Les demandes des clients apparaîtront ici.</p>
        </Card>
      ) : (
        <TicketList tickets={result?.tickets || []} hrefBase="/platform/support" showClient />
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Ouvrir un ticket pour un client">
        {open && (
          <NewTicketForm
            endpoint="/api/platform/support"
            clients={clients}
            onCreated={(id) => router.push(`/platform/support/${id}`)}
            onCancel={() => setOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}
