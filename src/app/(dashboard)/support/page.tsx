'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LifeBuoy, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { AddButton } from '@/components/ui/AddButton';
import { TicketList } from '@/components/support/TicketList';
import { NewTicketForm } from '@/components/support/NewTicketForm';
import type { TicketListItem } from '@/components/support/labels';

export default function ClientSupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketListItem[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/support', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => !cancelled && setTickets(json.data || []))
      .catch(() => !cancelled && setTickets([]));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <LifeBuoy className="size-6 text-muted" /> Support
          </h1>
          <p className="text-xs text-muted">Une question, un problème ? Ouvrez un ticket : l&apos;équipe OptiWifi vous répond ici.</p>
        </div>
        <AddButton what="un ticket de support" allowReadOnly onClick={() => setOpen(true)} />
      </div>

      {tickets === null ? (
        <div className="py-10 flex justify-center text-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <Card className="text-center space-y-3 py-8">
          <LifeBuoy className="w-12 h-12 text-muted mx-auto" />
          <h3 className="text-base font-semibold text-foreground">Aucun ticket</h3>
          <p className="text-xs text-muted">Vous n&apos;avez pas encore contacté le support. Touchez « Ajouter » pour ouvrir un ticket.</p>
        </Card>
      ) : (
        <TicketList tickets={tickets} hrefBase="/support" />
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Nouveau ticket">
        {open && <NewTicketForm endpoint="/api/support" onCreated={(id) => router.push(`/support/${id}`)} onCancel={() => setOpen(false)} />}
      </Modal>
    </div>
  );
}
