'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FileText, Loader2, Receipt } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import type { InvoiceDetail } from '@/lib/invoices';

const shortDate = (d: string | null) =>
  d ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';

/** Historique des paiements et factures de licence du client (page Abonnement). */
export function InvoiceList() {
  const [invoices, setInvoices] = useState<InvoiceDetail[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/invoices')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => !cancelled && setInvoices(json.data || []))
      .catch(() => !cancelled && setInvoices([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const total = (invoices || []).filter((i) => i.status === 'paid').reduce((a, i) => a + i.amount, 0);

  return (
    <Card id="factures" className="p-4 sm:p-6 space-y-4 scroll-mt-20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-brand-500" /> Paiements et factures
          </h2>
          <p className="text-xs text-slate-500 mt-1">Une facture est émise à chaque licence activée après vérification de votre paiement.</p>
        </div>
        {invoices && invoices.length > 0 && (
          <div className="text-right shrink-0">
            <p className="text-[11px] text-slate-500">Total payé</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrencyFCFA(total)}</p>
          </div>
        )}
      </div>

      {invoices === null ? (
        <div className="py-8 flex justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500">Aucune facture pour le moment.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800 -mx-1">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/subscription/invoices/${inv.id}`}
                className="flex items-center gap-3 px-1 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
              >
                <span className="w-10 h-10 shrink-0 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">Forfait {inv.plan_name || '—'}</span>
                    <Badge variant={inv.status === 'paid' ? 'success' : 'warning'}>{inv.status === 'paid' ? 'Payée' : 'À payer'}</Badge>
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {inv.invoice_number} · {shortDate(inv.issued_at)}
                    {inv.payment_method ? ` · ${inv.payment_method}` : ''}
                  </span>
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                  {formatCurrencyFCFA(inv.amount)}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
