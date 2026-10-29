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
                'flex items-center gap-3 p-4 rounded-2xl border bg-white dark:bg-slate-900 transition hover:border-slate-300 dark:hover:border-slate-700',
                awaiting ? 'border-brand-300 dark:border-brand-700' : 'border-slate-200 dark:border-slate-800'
              )}
            >
              <span
                className={cn(
                  'w-10 h-10 shrink-0 rounded-xl flex items-center justify-center',
                  t.opened_by_support ? 'bg-amber-500/10 text-amber-600' : 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                )}
              >
                {t.opened_by_support ? <Headset className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white break-words">{t.subject}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {awaiting && (
                    <span className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                      {showClient ? 'Réponse attendue' : 'Nouvelle réponse'}
                    </span>
                  )}
                </span>
                <span className="block text-xs text-slate-500 truncate">
                  {t.ticket_number}
                  {showClient && t.organization_name ? ` · ${t.organization_name}` : ''} · {categoryLabel(t.category)} ·{' '}
                  {timeAgo(t.last_message_at)}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
