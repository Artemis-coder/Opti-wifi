'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Headset, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils/cn';
import { STATUS_INFO, categoryLabel, timeAgo, type TicketListItem } from '@/components/support/labels';

/** Liste de tickets (cartes lisibles sur mobile comme sur ordinateur). */
export function TicketList({ tickets, hrefBase, showClient }: { tickets: TicketListItem[]; hrefBase: string; showClient?: boolean }) {
  return (
    <ul className="space-y-2.5">
      {tickets.map((t) => {
        const status = STATUS_INFO[t.status] || STATUS_INFO.new;
        // Côté support : le client attend une réponse ; côté client : le support a répondu
        const awaiting = showClient ? t.last_from_support === false && t.status !== 'closed' : t.last_from_support === true && t.status !== 'closed';
        return (
          <li key={t.id}>
            <Link
              href={`${hrefBase}/${t.id}`}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border bg-surface transition hover:border-border',
                awaiting ? 'border-accent/30' : 'border-border'
              )}
            >
              <span
                className={cn(
                  'w-10 h-10 shrink-0 rounded-lg flex items-center justify-center',
                  t.opened_by_support ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-accent-soft text-accent'
                )}
              >
                {t.opened_by_support ? <Headset className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground break-words">{t.subject}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {awaiting && (
                    <span className="text-xs font-semibold text-accent">
                      {showClient ? 'Réponse attendue' : 'Nouvelle réponse'}
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted truncate">
                  {t.ticket_number}
                  {showClient && t.organization_name ? ` · ${t.organization_name}` : ''} · {categoryLabel(t.category)} ·{' '}
                  {timeAgo(t.last_message_at)}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
