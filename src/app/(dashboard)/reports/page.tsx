'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Percent,
  Receipt,
  Store,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatTile } from '@/components/ui/StatTile';
import { DateField } from '@/components/ui/DateField';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { ReportDocument } from '@/components/reports/ReportDocument';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { formatCurrencyFCFA, formatDateOnlyFR } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { trackClient } from '@/lib/analytics/client';
import { EVENTS } from '@/lib/analytics/events';
import type { Collection, CollectionItem, PointOfSale } from '@/types/database';

// ── Périodes ────────────────────────────────────────────────────────────────

type Period = 'month' | 'last_month' | '7d' | 'today' | 'all' | 'custom';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Ce mois-ci' },
  { value: 'last_month', label: 'Mois dernier' },
  { value: '7d', label: '7 jours' },
  { value: 'today', label: "Aujourd'hui" },
  { value: 'all', label: 'Tout' },
  { value: 'custom', label: 'Personnalisée' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Bornes [début, fin] incluses, au format AAAA-MM-JJ ; null = sans borne */
function periodBounds(period: Period, customStart: string, customEnd: string): { start: string | null; end: string | null } {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: iso(now), end: iso(now) };
    case '7d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { start: iso(s), end: iso(now) };
    }
    case 'month':
      return { start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end: iso(now) };
    case 'last_month':
      return {
        start: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        end: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case 'custom':
      return { start: customStart || null, end: customEnd || null };
    default:
      return { start: null, end: null };
  }
}

// ── Statuts ─────────────────────────────────────────────────────────────────

type StatusFilter = 'active' | 'validee' | 'brouillon' | 'annulee';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Validées et brouillons' },
  { value: 'validee', label: 'Validées' },
  { value: 'brouillon', label: 'Brouillons' },
  { value: 'annulee', label: 'Annulées' },
];

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  validee: { label: 'Validée', variant: 'success' },
  brouillon: { label: 'Brouillon', variant: 'warning' },
  annulee: { label: 'Annulée', variant: 'neutral' },
};

// ── Export CSV compatible Excel ─────────────────────────────────────────────

type Cell = string | number | null | undefined;

/** CSV lisible par Excel en français : BOM UTF-8 (accents), séparateur « ; », champs entre guillemets */
function downloadCsv(filename: string, headers: string[], rows: Cell[][]) {
  const escape = (v: Cell) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const content = '\uFEFF' + [headers, ...rows].map((r) => r.map(escape).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const amount = (v: unknown) => Math.round(Number(v || 0));
const dateOf = (c: Collection) => (c.date_collecte || c.created_at || '').slice(0, 10);

type Tab = 'collections' | 'pos' | 'collectors' | 'tickets';

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: 'collections', label: 'Encaissements', icon: Receipt },
  { value: 'pos', label: 'Par point de vente', icon: Store },
  { value: 'collectors', label: 'Par collecteur', icon: Users },
  { value: 'tickets', label: 'Par type de ticket', icon: Ticket },
];

interface ItemRow extends CollectionItem {
  ticket_type?: CollectionItem['ticket_type'];
}

interface Totals {
  count: number;
  expected: number;
  collected: number;
  gap: number;
  commission: number;
}

const emptyTotals = (): Totals => ({ count: 0, expected: 0, collected: 0, gap: 0, commission: 0 });

function addTo(t: Totals, c: Collection) {
  t.count += 1;
  t.expected += amount(c.montant_attendu);
  t.collected += amount(c.montant_collecte);
  t.gap += amount(c.difference);
  t.commission += amount(c.commission);
}

export default function ReportsPage() {
  const supabase = createClient();
  const { currentSpaceId } = useSpaceStore();
  const { user } = useAuthStore();
  const [organizationName, setOrganizationName] = useState('');

  const [collections, setCollections] = useState<Collection[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [collectorFilter, setCollectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [tab, setTab] = useState<Tab>('collections');
  const [showAll, setShowAll] = useState(false);

  // Données de l'espace : chargées une fois, filtrées dans la page (filtres instantanés)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let posQuery = supabase.from('points_of_sale').select('*, collecteur:profiles(*)').order('nom');
      let colQuery = supabase
        .from('collections')
        .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
        .order('created_at', { ascending: false });
      let itemsQuery = supabase
        .from('collection_items')
        .select('id, collection_id, ticket_type_id, quantite_vendue, prix_unitaire, montant_total, ticket_type:ticket_types(nom)');
      if (currentSpaceId) {
        posQuery = posQuery.eq('space_id', currentSpaceId);
        colQuery = colQuery.eq('space_id', currentSpaceId);
        itemsQuery = itemsQuery.eq('space_id', currentSpaceId);
      }
      const orgId = (user as { organization_id?: string | null } | null)?.organization_id;
      const [posRes, colRes, itemsRes, orgRes] = await Promise.all([
        posQuery,
        colQuery,
        itemsQuery,
        orgId ? supabase.from('organizations').select('name').eq('id', orgId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      setOrganizationName((orgRes.data as { name?: string } | null)?.name || '');
      setPosList((posRes.data || []) as PointOfSale[]);
      setCollections((colRes.data || []) as Collection[]);
      setItems((itemsRes.data || []) as ItemRow[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentSpaceId, supabase, user]);

  const { start, end } = periodBounds(period, customStart, customEnd);

  // Encaissements retenus par les filtres
  const filtered = useMemo(
    () =>
      collections.filter((c) => {
        const d = dateOf(c);
        if (start && d < start) return false;
        if (end && d > end) return false;
        if (posFilter && c.pos_id !== posFilter) return false;
        if (collectorFilter && c.collecteur_id !== collectorFilter) return false;
        if (statusFilter === 'active') return c.statut !== 'annulee';
        return c.statut === statusFilter;
      }),
    [collections, start, end, posFilter, collectorFilter, statusFilter]
  );

  const totals = useMemo(() => {
    const t = emptyTotals();
    filtered.forEach((c) => addTo(t, c));
    return t;
  }, [filtered]);

  const filteredIds = useMemo(() => new Set(filtered.map((c) => c.id)), [filtered]);
  const filteredItems = useMemo(() => items.filter((i) => filteredIds.has(i.collection_id)), [items, filteredIds]);
  const ticketsSold = filteredItems.reduce((a, i) => a + Number(i.quantite_vendue || 0), 0);

  // Synthèses
  const byPos = useMemo(() => {
    const map = new Map<string, Totals & { name: string; city: string }>();
    filtered.forEach((c) => {
      const row = map.get(c.pos_id) || { ...emptyTotals(), name: c.pos?.nom || 'Point de vente', city: c.pos?.ville || '' };
      addTo(row, c);
      map.set(c.pos_id, row);
    });
    return [...map.values()].sort((a, b) => b.expected - a.expected);
  }, [filtered]);

  const byCollector = useMemo(() => {
    const map = new Map<string, Totals & { name: string }>();
    filtered.forEach((c) => {
      const row = map.get(c.collecteur_id) || { ...emptyTotals(), name: c.collecteur?.nom || 'Collecteur' };
      addTo(row, c);
      map.set(c.collecteur_id, row);
    });
    return [...map.values()].sort((a, b) => b.collected - a.collected);
  }, [filtered]);

  const byTicket = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number }>();
    filteredItems.forEach((i) => {
      const row = map.get(i.ticket_type_id) || { name: i.ticket_type?.nom || 'Ticket', quantity: 0, revenue: 0 };
      row.quantity += Number(i.quantite_vendue || 0);
      row.revenue += amount(i.montant_total ?? Number(i.quantite_vendue || 0) * Number(i.prix_unitaire || 0));
      map.set(i.ticket_type_id, row);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [filteredItems]);

  // Listes des filtres
  const posOptions = [{ value: '', label: 'Tous les points de vente' }, ...posList.map((p) => ({ value: p.id, label: p.nom }))];
  const collectorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    collections.forEach((c) => c.collecteur_id && seen.set(c.collecteur_id, c.collecteur?.nom || 'Collecteur'));
    return [
      { value: '', label: 'Tous les collecteurs' },
      ...[...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    ];
  }, [collections]);

  const periodLabel =
    start || end
      ? `${start ? formatDateOnlyFR(start) : 'début'} → ${end ? formatDateOnlyFR(end) : "aujourd'hui"}`
      : 'Toute la période';
  const fileSuffix = `${start || 'debut'}_${end || iso(new Date())}`;

  // ── Exports ────────────────────────────────────────────────────────────
  const exportCollections = () => {
    downloadCsv(
      `encaissements_${fileSuffix}.csv`,
      ['Date', 'Point de vente', 'Collecteur', 'Montant attendu', 'Montant encaissé', 'Commission', 'Écart', 'Statut'],
      filtered.map((c) => [
        formatDateOnlyFR(dateOf(c)),
        c.pos?.nom || '',
        c.collecteur?.nom || '',
        amount(c.montant_attendu),
        amount(c.montant_collecte),
        amount(c.commission),
        amount(c.difference),
        STATUS_BADGE[c.statut]?.label || c.statut,
      ])
    );
    trackClient(EVENTS.reportExported, { report: 'collections', format: 'csv' });
  };

  const exportByPos = () => {
    downloadCsv(
      `synthese_points_de_vente_${fileSuffix}.csv`,
      ['Point de vente', 'Ville', 'Encaissements', 'Montant attendu', 'Montant encaissé', 'Commission', 'Écart'],
      byPos.map((r) => [r.name, r.city, r.count, r.expected, r.collected, r.commission, r.gap])
    );
    trackClient(EVENTS.reportExported, { report: 'pos_summary', format: 'csv' });
  };

  const exportByCollector = () => {
    downloadCsv(
      `synthese_collecteurs_${fileSuffix}.csv`,
      ['Collecteur', 'Encaissements', 'Montant attendu', 'Montant encaissé', 'Commission', 'Écart'],
      byCollector.map((r) => [r.name, r.count, r.expected, r.collected, r.commission, r.gap])
    );
    trackClient(EVENTS.reportExported, { report: 'collector_summary', format: 'csv' });
  };

  const exportByTicket = () => {
    downloadCsv(
      `ventes_par_ticket_${fileSuffix}.csv`,
      ['Type de ticket', 'Quantité vendue', "Chiffre d'affaires"],
      byTicket.map((r) => [r.name, r.quantity, r.revenue])
    );
    trackClient(EVENTS.reportExported, { report: 'ticket_summary', format: 'csv' });
  };

  // PDF : le navigateur imprime le seul rapport (ReportDocument) ; « Enregistrer en PDF »
  // propose le nom du fichier via le titre de la page
  const exportPdf = () => {
    const previousTitle = document.title;
    document.title = `rapport_activite_${fileSuffix}`;
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    trackClient(EVENTS.reportExported, { report: 'activity', format: 'pdf' });
  };

  const exportPosList = () => {
    downloadCsv(
      `points_de_vente_${iso(new Date())}.csv`,
      ['Nom', 'Ville', 'Statut', 'Collecteur', 'Création'],
      posList.map((p) => [p.nom, p.ville, p.statut, p.collecteur?.nom || 'Non attribué', formatDateOnlyFR(p.created_at)])
    );
    trackClient(EVENTS.reportExported, { report: 'points_of_sale', format: 'csv' });
  };

  // Libellé du bouton d'export : [singulier, pluriel]
  const EXPORTS: Record<Tab, { run: () => void; count: number; noun: [string, string] }> = {
    collections: { run: exportCollections, count: filtered.length, noun: ['encaissement', 'encaissements'] },
    pos: { run: exportByPos, count: byPos.length, noun: ['point de vente', 'points de vente'] },
    collectors: { run: exportByCollector, count: byCollector.length, noun: ['collecteur', 'collecteurs'] },
    tickets: { run: exportByTicket, count: byTicket.length, noun: ['type de ticket', 'types de ticket'] },
  };
  const current = EXPORTS[tab];
  const visibleRows = showAll ? filtered : filtered.slice(0, 20);

  const money = (v: number) => formatCurrencyFCFA(v);
  // Montant d'un cadre : sur une ligne, sans coupure au milieu de « FCFA »
  const tileMoney = (v: number) => <span className="whitespace-nowrap text-lg sm:text-xl">{money(v)}</span>;
  const gapClass = (v: number) => (v < 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-400');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-amber-500" />
            Rapports & exports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Vos encaissements sur la période choisie, en synthèse ou en détail, exportables pour Excel.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button size="sm" icon={FileText} onClick={exportPdf} disabled={loading || filtered.length === 0}>
            Exporter en PDF
          </Button>
          <Button variant="outline" size="sm" icon={Store} onClick={exportPosList} disabled={posList.length === 0}>
            Liste des points de vente
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">Période</p>
          <span className="text-xs text-slate-500">· {periodLabel}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                'px-3.5 h-9 rounded-full text-sm font-semibold whitespace-nowrap border transition',
                period === p.value
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateField label="Du" value={customStart} onChange={setCustomStart} max={customEnd || undefined} clearable />
            <DateField label="Au" value={customEnd} onChange={setCustomEnd} min={customStart || undefined} clearable />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <CustomSelect label="Point de vente" value={posFilter} onChange={setPosFilter} options={posOptions} size="sm" />
          <CustomSelect label="Collecteur" value={collectorFilter} onChange={setCollectorFilter} options={collectorOptions} size="sm" />
          <CustomSelect
            label="Statut"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={STATUS_OPTIONS}
            size="sm"
            searchable={false}
          />
        </div>
      </Card>

      {/* Chiffres clés de la période */}
      <div className={cn('grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 transition-opacity', loading && 'opacity-50')}>
        <StatTile label="Encaissements" value={totals.count} icon={ClipboardList} accent="indigo" hint={periodLabel} />
        <StatTile label="Chiffre d'affaires" value={tileMoney(totals.expected)} icon={TrendingUp} accent="amber" hint="Montant attendu" />
        <StatTile label="Encaissé" value={tileMoney(totals.collected)} icon={Banknote} accent="emerald" />
        <StatTile
          label="Écart"
          value={tileMoney(totals.gap)}
          icon={AlertTriangle}
          accent="slate"
          alert={totals.gap < 0}
          hint={totals.gap < 0 ? 'Manque à encaisser' : 'Aucun manque'}
        />
        <StatTile label="Commission" value={tileMoney(totals.commission)} icon={Percent} accent="purple" />
        <StatTile label="Tickets vendus" value={ticketsSold.toLocaleString('fr-FR')} icon={Ticket} accent="blue" />
      </div>

      {/* Rapports */}
      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div role="tablist" aria-label="Rapport" className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold whitespace-nowrap transition',
                    tab === t.value
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <Button size="sm" icon={Download} onClick={current.run} disabled={current.count === 0} className="whitespace-nowrap">
            Exporter pour Excel ({current.count} {current.noun[current.count > 1 ? 1 : 0]})
          </Button>
        </div>

        {loading ? (
          <p className="p-10 text-center text-sm text-slate-500">Chargement…</p>
        ) : current.count === 0 ? (
          <div className="p-10 text-center space-y-1">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Aucune donnée pour ces filtres</p>
            <p className="text-xs text-slate-500">Changez de période ou de filtre.</p>
          </div>
        ) : (
          <ResponsiveTable>
            {tab === 'collections' && (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Point de vente</th>
                    <th className="px-4 py-3">Collecteur</th>
                    <th className="px-4 py-3 text-right">Attendu</th>
                    <th className="px-4 py-3 text-right">Encaissé</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                    <th className="px-4 py-3 text-right">Écart</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {visibleRows.map((c) => {
                    const s = STATUS_BADGE[c.statut] || { label: c.statut, variant: 'neutral' as const };
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDateOnlyFR(dateOf(c))}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{c.pos?.nom || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.collecteur?.nom || '—'}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{money(amount(c.montant_attendu))}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-slate-900 dark:text-white">
                          {money(amount(c.montant_collecte))}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{money(amount(c.commission))}</td>
                        <td className={cn('px-4 py-3 text-right whitespace-nowrap', gapClass(amount(c.difference)))}>
                          {money(amount(c.difference))}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={s.variant} className="text-[11px]">
                            {s.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-900 dark:text-white">
                  <tr>
                    <td className="px-4 py-3" colSpan={3}>
                      Total ({totals.count})
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{money(totals.expected)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{money(totals.collected)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{money(totals.commission)}</td>
                    <td className={cn('px-4 py-3 text-right whitespace-nowrap', totals.gap < 0 && 'text-red-600 dark:text-red-400')}>
                      {money(totals.gap)}
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            )}

            {(tab === 'pos' || tab === 'collectors') && (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">{tab === 'pos' ? 'Point de vente' : 'Collecteur'}</th>
                    <th className="px-4 py-3 text-right">Encaissements</th>
                    <th className="px-4 py-3 text-right">Attendu</th>
                    <th className="px-4 py-3 text-right">Encaissé</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                    <th className="px-4 py-3 text-right">Écart</th>
                    <th className="px-4 py-3">Part du CA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(tab === 'pos' ? byPos : byCollector).map((r) => {
                    const share = totals.expected ? Math.round((r.expected / totals.expected) * 100) : 0;
                    const city = 'city' in r ? String(r.city || '') : '';
                    return (
                      <tr key={r.name + r.count} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900 dark:text-white">{r.name}</span>
                          {city && <span className="block text-[11px] text-slate-500">{city}</span>}
                        </td>
                        <td className="px-4 py-3 text-right">{r.count}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{money(r.expected)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-slate-900 dark:text-white">
                          {money(r.collected)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{money(r.commission)}</td>
                        <td className={cn('px-4 py-3 text-right whitespace-nowrap', gapClass(r.gap))}>{money(r.gap)}</td>
                        <td className="px-4 py-3 min-w-32">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div className="h-full rounded-full bg-amber-500" style={{ width: `${share}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 tabular-nums w-9 text-right">{share} %</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {tab === 'tickets' && (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Type de ticket</th>
                    <th className="px-4 py-3 text-right">Quantité vendue</th>
                    <th className="px-4 py-3 text-right">Chiffre d&apos;affaires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {byTicket.map((r) => (
                    <tr key={r.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{r.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.quantity.toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-slate-900 dark:text-white">{money(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-900 dark:text-white">
                  <tr>
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">{ticketsSold.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{money(byTicket.reduce((a, r) => a + r.revenue, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </ResponsiveTable>
        )}

        {tab === 'collections' && filtered.length > 20 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              {showAll ? filtered.length : 20} sur {filtered.length} encaissements affichés · l&apos;export contient tout
            </span>
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Afficher moins' : 'Tout afficher'}
            </Button>
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        « Exporter en PDF » produit un rapport A4 complet (chiffres clés, synthèses et détail) : choisissez « Enregistrer
        en PDF » dans la fenêtre d&apos;impression. Les fichiers Excel s&apos;ouvrent aussi dans Google Sheets. Les
        encaissements annulés ne sont comptés que si vous choisissez le statut « Annulées ».
      </p>

      {/* Document imprimé par « Exporter en PDF » (invisible à l'écran) */}
      <ReportDocument
        organizationName={organizationName}
        periodLabel={periodLabel}
        filters={[
          posFilter && `Point de vente : ${posOptions.find((o) => o.value === posFilter)?.label}`,
          collectorFilter && `Collecteur : ${collectorOptions.find((o) => o.value === collectorFilter)?.label}`,
          `Statut : ${STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}`,
        ].filter((f): f is string => !!f)}
        totals={totals}
        ticketsSold={ticketsSold}
        byPos={byPos.map((r) => ({ ...r, detail: r.city || undefined }))}
        byCollector={byCollector}
        byTicket={byTicket}
        collections={filtered.map((c) => ({
          id: c.id,
          date: formatDateOnlyFR(dateOf(c)),
          pos: c.pos?.nom || '—',
          collector: c.collecteur?.nom || '—',
          expected: amount(c.montant_attendu),
          collected: amount(c.montant_collecte),
          commission: amount(c.commission),
          gap: amount(c.difference),
          status: STATUS_BADGE[c.statut]?.label || c.statut,
        }))}
      />
    </div>
  );
}
