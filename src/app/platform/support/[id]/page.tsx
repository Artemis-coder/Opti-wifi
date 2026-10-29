'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { TicketThread } from '@/components/support/TicketThread';
import { PRIORITY_OPTIONS, STATUS_OPTIONS, type TicketListItem } from '@/components/support/labels';

function TicketControls({ ticket, reload, endpoint }: { ticket: TicketListItem; reload: () => void; endpoint: string }) {
  const [saving, setSaving] = useState(false);
  const update = async (changes: { status?: string; priority?: string }) => {
    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error);
      toast.success('Ticket mis à jour');
      reload();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Échec de la mise à jour');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 ${saving ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <CustomSelect
        label="Statut"
        size="sm"
        value={ticket.status}
        onChange={(v) => update({ status: v })}
        options={STATUS_OPTIONS}
        searchable={false}
      />
      <CustomSelect
        label="Priorité"
        size="sm"
        value={ticket.priority}
        onChange={(v) => update({ priority: v })}
        options={PRIORITY_OPTIONS}
        searchable={false}
      />
    </div>
  );
}

export default function PlatformTicketPage() {
  const { id } = useParams<{ id: string }>();
  const endpoint = `/api/platform/support/${id}`;
  return (
    <TicketThread
      endpoint={endpoint}
      viewer="support"
      backHref="/platform/support"
      backLabel="Tous les tickets"
      renderControls={(ticket, reload) => <TicketControls ticket={ticket} reload={reload} endpoint={endpoint} />}
    />
  );
}
