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
    // Document papier : toujours en thème clair, même si l’app est en mode sombre
    <article data-theme="light" className="light invoice-print bg-surface text-foreground rounded-2xl border border-border shadow-sm p-5 sm:p-10 space-y-4 print:shadow-none print:border-0 print:rounded-none print:p-0">
      {/* En-tête */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.jpg" alt="" className="w-12 h-12 rounded-xl object-cover" />
          <div>
            <p className="text-lg font-semibold">{issuer.name}</p>
            {issuer.email && <p className="text-xs text-muted">{issuer.email}</p>}
            {issuer.phone && <p className="text-xs text-muted">{issuer.phone}</p>}
          </div>
        </div>
        <div className="sm:text-right space-y-1">
          <p className="text-2xl font-semibold tracking-tight">FACTURE</p>
          <p className="font-mono text-sm font-semibold">{invoice.invoice_number}</p>
          <p className="text-xs text-muted">Émise le {longDate(invoice.issued_at)}</p>
          {paid && (
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-success-soft-foreground bg-success-soft rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Payée
            </p>
          )}
        </div>
      </header>

      {/* Client */}
      <section className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted">Facturé à</p>
          <p className="font-semibold">{to.name || '—'}</p>
          {to.contact_name && <p className="text-sm text-muted">{to.contact_name}</p>}
          {to.address && <p className="text-sm text-muted whitespace-pre-line">{to.address}</p>}
          {to.phone && <p className="text-sm text-muted">{to.phone}</p>}
          {to.email && <p className="text-sm text-muted break-all">{to.email}</p>}
        </div>
        <div className="space-y-1 sm:text-right">
          <p className="text-xs font-semibold text-muted">Période de licence</p>
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
            <tr className="border-b-2 border-border text-left">
              <th className="py-2 font-semibold">Désignation</th>
              <th className="py-2 font-semibold text-right">Qté</th>
              <th className="py-2 font-semibold text-right hidden sm:table-cell print:table-cell">Prix unitaire</th>
              <th className="py-2 font-semibold text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border align-top">
              <td className="py-3 pr-3">
                <p className="font-semibold">Licence OptiWifi — forfait {invoice.plan_name || '—'}</p>
                <p className="text-xs text-muted">
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
              <dt className="text-muted">Sous-total</dt>
              <dd className="tabular-nums">{formatCurrencyFCFA(invoice.amount)}</dd>
            </div>
            <div className="flex justify-between border-t-2 border-border pt-2 text-base font-semibold">
              <dt>Total {paid ? 'payé' : 'dû'}</dt>
              <dd className="tabular-nums">{formatCurrencyFCFA(invoice.amount)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Paiement */}
      {paid && (
        <section className="rounded-xl bg-surface-secondary p-4 text-sm space-y-1 print:bg-surface">
          <p className="font-semibold">Paiement reçu le {longDate(invoice.paid_at)}</p>
          <p className="text-muted">
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

      <footer className="pt-4 border-t border-border text-xs text-muted text-center">
        Merci pour votre confiance. Pour toute question sur cette facture, contactez {issuer.email || issuer.phone || 'le support'}.
      </footer>
    </article>
  );
}
