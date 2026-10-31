import React from 'react';
import { formatCurrencyFCFA } from '@/lib/utils/format';

export interface ReportTotals {
  count: number;
  expected: number;
  collected: number;
  gap: number;
  commission: number;
}

export interface ReportGroupRow extends ReportTotals {
  name: string;
  detail?: string;
}

export interface ReportCollectionRow {
  id: string;
  date: string;
  pos: string;
  collector: string;
  expected: number;
  collected: number;
  commission: number;
  gap: number;
  status: string;
}

export interface ReportDocumentProps {
  organizationName: string;
  periodLabel: string;
  /** Filtres appliqués (point de vente, collecteur, statut) en clair */
  filters: string[];
  totals: ReportTotals;
  ticketsSold: number;
  byPos: ReportGroupRow[];
  byCollector: ReportGroupRow[];
  byTicket: { name: string; quantity: number; revenue: number }[];
  collections: ReportCollectionRow[];
}

const money = (v: number) => formatCurrencyFCFA(v);
const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Rapport d'activité mis en page pour l'impression A4 (« Enregistrer en PDF »).
 * Invisible à l'écran ; la classe .report-print l'isole à l'impression (voir globals.css).
 * Couleurs fixes (pas de mode sombre) pour un document identique sur tous les appareils.
 */
export function ReportDocument(props: ReportDocumentProps) {
  const { organizationName, periodLabel, filters, totals, ticketsSold, byPos, byCollector, byTicket, collections } = props;
  const share = (v: number) => (totals.expected ? `${Math.round((v / totals.expected) * 100)} %` : '—');

  return (
    <article className="report-print hidden print:block bg-white text-slate-900 text-[10.5px] leading-snug">
      {/* En-tête */}
      <header className="flex items-start justify-between gap-6 pb-4 border-b-2 border-slate-900">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.jpg" alt="" className="w-11 h-11 rounded-lg object-cover" />
          <div>
            <p className="text-[15px] font-extrabold">{organizationName || 'Mon organisation'}</p>
            <p className="text-slate-500">Rapport généré avec OptiSpace</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-extrabold tracking-tight">RAPPORT D&apos;ACTIVITÉ</p>
          <p className="font-semibold">{periodLabel}</p>
          <p className="text-slate-500">Édité le {longDate.format(new Date())}</p>
        </div>
      </header>

      {filters.length > 0 && (
        <p className="mt-3 text-slate-600">
          <span className="font-semibold text-slate-900">Filtres : </span>
          {filters.join(' · ')}
        </p>
      )}

      {/* Chiffres clés */}
      <section className="mt-4 grid grid-cols-3 gap-2 break-inside-avoid">
        {[
          { label: 'Encaissements', value: String(totals.count) },
          { label: "Chiffre d'affaires", value: money(totals.expected), hint: 'Montant attendu' },
          { label: 'Encaissé', value: money(totals.collected) },
          { label: 'Écart', value: money(totals.gap), alert: totals.gap < 0, hint: totals.gap < 0 ? 'Manque à encaisser' : 'Aucun manque' },
          { label: 'Commission', value: money(totals.commission) },
          { label: 'Tickets vendus', value: ticketsSold.toLocaleString('fr-FR') },
        ].map((k) => (
          <div
            key={k.label}
            className={`rounded-lg border px-3 py-2 ${k.alert ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{k.label}</p>
            <p className={`text-[14px] font-extrabold tabular-nums ${k.alert ? 'text-red-700' : ''}`}>{k.value}</p>
            {k.hint && <p className="text-[9px] text-slate-500">{k.hint}</p>}
          </div>
        ))}
      </section>

      {/* Synthèses */}
      <GroupTable title="Synthèse par point de vente" first="Point de vente" rows={byPos} totals={totals} share={share} />
      <GroupTable title="Synthèse par collecteur" first="Collecteur" rows={byCollector} totals={totals} share={share} />

      {byTicket.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[12px] font-bold mb-1.5">Ventes par type de ticket</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left text-[9px] uppercase tracking-wider text-slate-600">
                <th className="px-2 py-1.5">Type de ticket</th>
                <th className="px-2 py-1.5 text-right">Quantité vendue</th>
                <th className="px-2 py-1.5 text-right">Chiffre d&apos;affaires</th>
              </tr>
            </thead>
            <tbody>
              {byTicket.map((r) => (
                <tr key={r.name} className="border-b border-slate-200 break-inside-avoid">
                  <td className="px-2 py-1.5 font-semibold">{r.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.quantity.toLocaleString('fr-FR')}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{money(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-slate-900">
                <td className="px-2 py-1.5">Total</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{ticketsSold.toLocaleString('fr-FR')}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{money(byTicket.reduce((a, r) => a + r.revenue, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      {/* Détail */}
      {collections.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[12px] font-bold mb-1.5">Détail des encaissements ({collections.length})</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left text-[9px] uppercase tracking-wider text-slate-600">
                <th className="px-2 py-1.5">Date</th>
                <th className="px-2 py-1.5">Point de vente</th>
                <th className="px-2 py-1.5">Collecteur</th>
                <th className="px-2 py-1.5 text-right">Attendu</th>
                <th className="px-2 py-1.5 text-right">Encaissé</th>
                <th className="px-2 py-1.5 text-right">Commission</th>
                <th className="px-2 py-1.5 text-right">Écart</th>
                <th className="px-2 py-1.5">Statut</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id} className="border-b border-slate-200 break-inside-avoid">
                  <td className="px-2 py-1 whitespace-nowrap">{c.date}</td>
                  <td className="px-2 py-1 font-semibold">{c.pos}</td>
                  <td className="px-2 py-1">{c.collector}</td>
                  <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{money(c.expected)}</td>
                  <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap font-semibold">{money(c.collected)}</td>
                  <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{money(c.commission)}</td>
                  <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${c.gap < 0 ? 'text-red-700 font-semibold' : ''}`}>
                    {money(c.gap)}
                  </td>
                  <td className="px-2 py-1">{c.status}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-slate-900">
                <td className="px-2 py-1.5" colSpan={3}>
                  Total
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{money(totals.expected)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{money(totals.collected)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{money(totals.commission)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${totals.gap < 0 ? 'text-red-700' : ''}`}>
                  {money(totals.gap)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      <footer className="mt-6 pt-2 border-t border-slate-200 text-[9px] text-slate-500 flex justify-between">
        <span>{organizationName} · Rapport d&apos;activité · {periodLabel}</span>
        <span>OptiSpace — www.optiwifi.site</span>
      </footer>
    </article>
  );
}

function GroupTable({
  title,
  first,
  rows,
  totals,
  share,
}: {
  title: string;
  first: string;
  rows: ReportGroupRow[];
  totals: ReportTotals;
  share: (v: number) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-5">
      <h2 className="text-[12px] font-bold mb-1.5">{title}</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-left text-[9px] uppercase tracking-wider text-slate-600">
            <th className="px-2 py-1.5">{first}</th>
            <th className="px-2 py-1.5 text-right">Encaiss.</th>
            <th className="px-2 py-1.5 text-right">Attendu</th>
            <th className="px-2 py-1.5 text-right">Encaissé</th>
            <th className="px-2 py-1.5 text-right">Commission</th>
            <th className="px-2 py-1.5 text-right">Écart</th>
            <th className="px-2 py-1.5 text-right">Part du CA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name + r.count} className="border-b border-slate-200 break-inside-avoid">
              <td className="px-2 py-1.5">
                <span className="font-semibold">{r.name}</span>
                {r.detail && <span className="text-slate-500"> · {r.detail}</span>}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.count}</td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{money(r.expected)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap font-semibold">{money(r.collected)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{money(r.commission)}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${r.gap < 0 ? 'text-red-700 font-semibold' : ''}`}>
                {money(r.gap)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{share(r.expected)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold border-t-2 border-slate-900">
            <td className="px-2 py-1.5">Total</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{totals.count}</td>
            <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{money(totals.expected)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{money(totals.collected)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{money(totals.commission)}</td>
            <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${totals.gap < 0 ? 'text-red-700' : ''}`}>
              {money(totals.gap)}
            </td>
            <td className="px-2 py-1.5 text-right">100 %</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
