'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Database,
  Search,
  Loader2,
  MapPin,
  Store,
  Ticket,
  Wallet,
  ArrowLeftRight,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { cn } from '@/lib/utils/cn';
import { formatCurrencyFCFA, formatDateOnlyFR, formatNumber } from '@/lib/utils/format';
import type { ExplorerEntity } from '@/types/platform';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

interface Column {
  label: string;
  render: (row: Row) => React.ReactNode;
  align?: 'right';
}

const PAGE_SIZE = 25;

const statusBadge = (value: string | boolean | null | undefined) => {
  if (value === true) return <Badge variant="success" className="text-xs">Actif</Badge>;
  if (value === false) return <Badge variant="neutral" className="text-xs">Inactif</Badge>;
  const v = String(value || '—');
  const variant =
    v === 'actif' || v === 'validee' ? 'success'
    : v === 'suspendu' || v === 'annulee' ? 'danger'
    : v === 'brouillon' ? 'warning'
    : 'neutral';
  return <Badge variant={variant} className="text-xs capitalize">{v}</Badge>;
};

const orgCell = (row: Row) =>
  row.org_id ? (
    <Link href={`/platform/clients/${row.org_id}`} className="hover:text-amber-500">
      {row.org_name}
    </Link>
  ) : (
    '—'
  );

const ALLOCATION_TYPES: Record<string, string> = {
  allocation: 'Allocation',
  exchange_return: 'Échange (retour)',
  exchange_receive: 'Échange (réception)',
};

const ENTITIES: { key: ExplorerEntity; label: string; icon: React.ElementType; columns: Column[] }[] = [
  {
    key: 'spaces',
    label: 'Espaces WiFi',
    icon: MapPin,
    columns: [
      { label: 'Espace', render: (r) => <span className="font-semibold text-slate-900 dark:text-white">{r.nom}</span> },
      { label: 'Organisation', render: orgCell },
      { label: 'Ville', render: (r) => r.ville || '—' },
      { label: 'POS', render: (r) => formatNumber(Number(r.pos_count || 0)), align: 'right' },
      { label: 'Statut', render: (r) => statusBadge(r.statut) },
      { label: 'Création', render: (r) => formatDateOnlyFR(r.created_at) },
    ],
  },
  {
    key: 'pos',
    label: 'Points de vente',
    icon: Store,
    columns: [
      { label: 'POS', render: (r) => <span className="font-semibold text-slate-900 dark:text-white">{r.nom}</span> },
      { label: 'Organisation', render: orgCell },
      { label: 'Espace', render: (r) => r.space_name || '—' },
      { label: 'Collecteur', render: (r) => r.collecteur_name || '—' },
      { label: 'Ville', render: (r) => r.ville || '—' },
      { label: 'Statut', render: (r) => statusBadge(r.statut) },
    ],
  },
  {
    key: 'ticket_types',
    label: 'Types de tickets',
    icon: Ticket,
    columns: [
      { label: 'Ticket', render: (r) => <span className="font-semibold text-slate-900 dark:text-white">{r.nom}</span> },
      { label: 'Organisation', render: orgCell },
      { label: 'Espace', render: (r) => r.space_name || '—' },
      { label: 'Durée', render: (r) => `${r.duree_heures} h`, align: 'right' },
      { label: 'Prix', render: (r) => formatCurrencyFCFA(Number(r.prix || 0)), align: 'right' },
      { label: 'Statut', render: (r) => statusBadge(r.actif) },
    ],
  },
  {
    key: 'collections',
    label: 'Encaissements',
    icon: Wallet,
    columns: [
      { label: 'Date', render: (r) => formatDateOnlyFR(r.date) },
      { label: 'Organisation', render: orgCell },
      { label: 'POS', render: (r) => r.pos_name || '—' },
      { label: 'Collecteur', render: (r) => r.collecteur_name || '—' },
      { label: 'Attendu', render: (r) => formatCurrencyFCFA(Number(r.montant_attendu || 0)), align: 'right' },
      { label: 'Encaissé', render: (r) => formatCurrencyFCFA(Number(r.montant_collecte || 0)), align: 'right' },
      {
        label: 'Écart',
        align: 'right',
        render: (r) => {
          const d = Number(r.difference || 0);
          return (
            <span className={cn(d < 0 ? 'text-red-600' : d > 0 ? 'text-emerald-600' : 'text-slate-500')}>
              {formatCurrencyFCFA(d)}
            </span>
          );
        },
      },
      { label: 'Statut', render: (r) => statusBadge(r.statut) },
    ],
  },
  {
    key: 'allocations',
    label: 'Allocations',
    icon: ArrowLeftRight,
    columns: [
      { label: 'Date', render: (r) => formatDateOnlyFR(r.date) },
      { label: 'Organisation', render: orgCell },
      { label: 'POS', render: (r) => r.pos_name || '—' },
      { label: 'Ticket', render: (r) => r.ticket_type_name || '—' },
      { label: 'Type', render: (r) => ALLOCATION_TYPES[r.type] || r.type },
      { label: 'Quantité', render: (r) => formatNumber(Number(r.quantite || 0)), align: 'right' },
      {
        label: 'Valeur',
        align: 'right',
        render: (r) => formatCurrencyFCFA(Number(r.quantite || 0) * Number(r.ticket_price || 0)),
      },
    ],
  },
  {
    key: 'users',
    label: 'Utilisateurs',
    icon: Users,
    columns: [
      {
        label: 'Utilisateur',
        render: (r) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{r.nom}</p>
            <p className="text-xs text-slate-500">{r.email}</p>
          </div>
        ),
      },
      { label: 'Organisation', render: orgCell },
      {
        label: 'Rôle',
        render: (r) => (
          <Badge variant={r.role === 'administrateur' ? 'warning' : 'info'} className="text-xs">
            {r.role === 'administrateur' ? 'Admin' : r.role}
          </Badge>
        ),
      },
      { label: 'Téléphone', render: (r) => r.telephone || '—' },
      { label: 'Création', render: (r) => formatDateOnlyFR(r.created_at) },
    ],
  },
];

function ExplorerContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const entityParam = searchParams.get('entity') as ExplorerEntity | null;
  const entity = ENTITIES.find((e) => e.key === entityParam) ?? ENTITIES[0];
  const org = searchParams.get('org') || '';
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (debouncedSearch !== (searchParams.get('q') || '')) {
      updateParams({ q: debouncedSearch || null, page: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const q = searchParams.get('q') || '';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ entity: entity.key, page: String(page), pageSize: String(PAGE_SIZE) });
        if (org) params.set('org', org);
        if (q) params.set('q', q);
        const res = await fetch(`/api/platform/explorer?${params.toString()}`);
        const result = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(result.error || 'Erreur de chargement');
          setRows([]);
          setTotal(0);
        } else {
          setRows(result.data || []);
          setTotal(result.total || 0);
          setOrganizations(result.organizations || []);
        }
      } catch {
        if (!cancelled) setError('Erreur réseau');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [entity.key, org, q, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedOrg = organizations.find((o) => o.id === org);
  const orgOptions = [
    { value: '', label: 'Tous les clients' },
    ...organizations.map((o) => ({ value: o.id, label: o.name })),
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-amber-500" />
            Explorateur de données
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Lecture seule · données opérationnelles de {selectedOrg ? selectedOrg.name : 'tous les clients'}
          </p>
        </div>
        {selectedOrg && (
          <Link href={`/platform/clients/${selectedOrg.id}`}>
            <Button variant="outline" size="sm" className="text-xs">
              <Building2 className="w-3.5 h-3.5 mr-1" /> Fiche client
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {ENTITIES.map((e) => {
          const Icon = e.icon;
          const active = e.key === entity.key;
          return (
            <Button
              key={e.key}
              variant={active ? 'primary' : 'outline'}
              size="sm"
              className="text-xs font-medium"
              onClick={() => updateParams({ entity: e.key, page: null })}
            >
              <Icon className="w-3.5 h-3.5 mr-1.5" />
              {e.label}
            </Button>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="flex flex-col md:flex-row gap-3">
        <div className="md:w-72">
          <CustomSelect
            value={org}
            onChange={(v) => updateParams({ org: v || null, page: null })}
            options={orgOptions}
            searchable
            searchPlaceholder="Rechercher un client..."
            size="sm"
            leadingIcon={<Building2 className="w-4 h-4" />}
          />
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </Card>

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Chargement...</span>
        </div>
      ) : error ? (
        <Card className="p-8 text-center text-sm text-red-600">{error}</Card>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <entity.icon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune donnée trouvée</h3>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  {entity.columns.map((c) => (
                    <th key={c.label} className={cn('px-4 py-3', c.align === 'right' && 'text-right')}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium text-slate-600 dark:text-slate-400">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    {entity.columns.map((c) => (
                      <td key={c.label} className={cn('px-4 py-3', c.align === 'right' && 'text-right')}>
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            <span>
              {formatNumber(total)} résultat(s) · page {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function PlatformExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        </div>
      }
    >
      <ExplorerContent />
    </Suspense>
  );
}
