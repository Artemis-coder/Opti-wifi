import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import type { InvoiceDetail } from '@/lib/invoices';

export interface InvoiceIssuer {
  name: string;
  email: string | null;
  phone: string | null;
}

const longDate = (d: string | null) =>
  d ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d)) : '—';

/**
 * Facture de licence, mise en page pour l'écran et l'impression (« Enregistrer en PDF »).
 * La classe .invoice-print isole la facture à l'impression (voir globals.css).
 */
export function InvoiceDocument({ invoice, issuer }: { invoice: InvoiceDetail; issuer: InvoiceIssuer }) {
  const to = invoice.billed_to || {};
  const months = invoice.duration_months ?? invoice.quantity ?? 1;
  const unit = invoice.unit_price ?? invoice.amount / Math.max(1, months);
  const paid = invoice.status === 'paid';

  return (
    <article className="invoice-print bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-10 space-y-8 print:shadow-none print:border-0 print:rounded-none print:p-0">
      {/* En-tête */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.jpg" alt="" className="w-12 h-12 rounded-xl object-cover" />
          <div>
            <p className="text-lg font-extrabold">{issuer.name}</p>
            {issuer.email && <p className="text-xs text-slate-500">{issuer.email}</p>}
            {issuer.phone && <p className="text-xs text-slate-500">{issuer.phone}</p>}
          </div>
        </div>
        <div className="sm:text-right space-y-1">
          <p className="text-2xl font-extrabold tracking-tight">FACTURE</p>
          <p className="font-mono text-sm font-semibold">{invoice.invoice_number}</p>
          <p className="text-xs text-slate-500">Émise le {longDate(invoice.issued_at)}</p>
          {paid && (
            <p className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Payée
            </p>
          )}
        </div>
      </header>

      {/* Client */}
      <section className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Facturé à</p>
          <p className="font-bold">{to.name || '—'}</p>
          {to.contact_name && <p className="text-sm text-slate-600">{to.contact_name}</p>}
          {to.address && <p className="text-sm text-slate-600 whitespace-pre-line">{to.address}</p>}
          {to.phone && <p className="text-sm text-slate-600">{to.phone}</p>}
          {to.email && <p className="text-sm text-slate-600 break-all">{to.email}</p>}
        </div>
        <div className="space-y-1 sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Période de licence</p>
          <p className="text-sm font-semibold">
            Du {longDate(invoice.period_start)}
            <br />
            au {longDate(invoice.period_end)}
          </p>
        </div>
      </section>

      {/* Ligne de facture */}
      <section>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left">
              <th className="py-2 font-semibold">Désignation</th>
              <th className="py-2 font-semibold text-right">Qté</th>
              <th className="py-2 font-semibold text-right hidden sm:table-cell print:table-cell">Prix unitaire</th>
              <th className="py-2 font-semibold text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 align-top">
              <td className="py-3 pr-3">
                <p className="font-semibold">Licence OptiWifi — forfait {invoice.plan_name || '—'}</p>
                <p className="text-xs text-slate-500">
                  {months} mois · {longDate(invoice.period_start)} → {longDate(invoice.period_end)}
                </p>
              </td>
              <td className="py-3 text-right tabular-nums whitespace-nowrap">{months} mois</td>
              <td className="py-3 text-right tabular-nums whitespace-nowrap hidden sm:table-cell print:table-cell">
                {formatCurrencyFCFA(unit)}
              </td>
              <td className="py-3 text-right tabular-nums font-semibold whitespace-nowrap">{formatCurrencyFCFA(invoice.amount)}</td>
            </tr>
          </tbody>
        </table>
        <div className="flex justify-end pt-4">
          <dl className="w-full sm:w-72 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Sous-total</dt>
              <dd className="tabular-nums">{formatCurrencyFCFA(invoice.amount)}</dd>
            </div>
            <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-base font-extrabold">
              <dt>Total {paid ? 'payé' : 'dû'}</dt>
              <dd className="tabular-nums">{formatCurrencyFCFA(invoice.amount)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Paiement */}
      {paid && (
        <section className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-1 print:bg-white">
          <p className="font-semibold">Paiement reçu le {longDate(invoice.paid_at)}</p>
          <p className="text-slate-600">
            {invoice.payment_method ? `Moyen : ${invoice.payment_method}` : 'Paiement vérifié par le support OptiWifi'}
            {invoice.payment_reference && (
              <>
                {' '}
                · Réf. <span className="font-mono">{invoice.payment_reference}</span>
              </>
            )}
          </p>
        </section>
      )}

      <footer className="pt-4 border-t border-slate-200 text-xs text-slate-500 text-center">
        Merci pour votre confiance. Pour toute question sur cette facture, contactez {issuer.email || issuer.phone || 'le support'}.
      </footer>
    </article>
  );
}
