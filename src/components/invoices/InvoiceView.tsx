'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { InvoiceDocument, type InvoiceIssuer } from '@/components/invoices/InvoiceDocument';
import type { InvoiceDetail } from '@/lib/invoices';

/** Page facture : chargement, retour, téléchargement en PDF (impression du navigateur). */
export function InvoiceView({ id, backHref, backLabel }: { id: string; backHref: string; backLabel: string }) {
  const [state, setState] = useState<{ invoice: InvoiceDetail; issuer: InvoiceIssuer } | null | 'error'>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/invoices/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!cancelled) setState(res.ok ? json.data : 'error');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Nom du fichier proposé à l'enregistrement en PDF
  useEffect(() => {
    if (!state || state === 'error') return;
    const previous = document.title;
    document.title = `Facture ${state.invoice.invoice_number}`;
    return () => {
      document.title = previous;
    };
  }, [state]);

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 -ml-1 px-1 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </Link>
        {state && state !== 'error' && (
          <Button icon={Download} onClick={() => window.print()} className="w-full sm:w-auto font-semibold">
            Télécharger en PDF
          </Button>
        )}
      </div>

      {state === null ? (
        <div className="py-20 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : state === 'error' ? (
        <p className="py-16 text-center text-sm text-slate-500">Facture introuvable.</p>
      ) : (
        <InvoiceDocument invoice={state.invoice} issuer={state.issuer} />
      )}
    </div>
  );
}
