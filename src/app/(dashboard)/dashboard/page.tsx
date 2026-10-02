'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Ticket, 
  Banknote, 
  ArrowDownRight, 
  Store, 
  Receipt, 
  PlusCircle, 
  ArrowLeftRight,
  Loader2,
  Inbox,
  Package,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CollectionDetailSheet } from '@/components/collections/CollectionDetailSheet';
import { formatCurrencyFCFA, formatNumber, formatDateFR } from '@/lib/utils/format';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { createClient } from '@/lib/supabase/client';
import { Collection } from '@/types/database';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { currentSpaceId } = useSpaceStore();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);

  // Computed KPIs from real Supabase DB
  const [ticketsSoldTotal, setTicketsSoldTotal] = useState(0);
  const [chiffreAffairesTotal, setChiffreAffairesTotal] = useState(0);
  const [montantCollecteTotal, setMontantCollecteTotal] = useState(0);
  const [ecartTotal, setEcartTotal] = useState(0);
  const [posActifsCount, setPosActifsCount] = useState(0);
  const [ticketsAllouesTotal, setTicketsAllouesTotal] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    async function loadDashboardData() {
      if (!user?.organization_id) return;
      setLoading(true);

      let posQuery = supabase.from('points_of_sale').select('id', { count: 'exact' }).eq('organization_id', user.organization_id);
      if (currentSpaceId) {
        posQuery = posQuery.eq('space_id', currentSpaceId);
      }

      let colQuery = supabase
        .from('collections')
        .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
        .eq('organization_id', user.organization_id)
        .order('created_at', { ascending: false });
      if (currentSpaceId) {
        colQuery = colQuery.eq('space_id', currentSpaceId);
      }

      let itemsQuery = supabase.from('collection_items').select('quantite_vendue').eq('organization_id', user.organization_id);
      if (currentSpaceId) {
        itemsQuery = itemsQuery.eq('space_id', currentSpaceId);
      }

      let allocQuery = supabase.from('ticket_allocations').select('quantite').eq('organization_id', user.organization_id);
      if (currentSpaceId) {
        allocQuery = allocQuery.eq('space_id', currentSpaceId);
      }

      const [posRes, colRes, itemsRes, allocRes] = await Promise.all([
        posQuery,
        colQuery,
        itemsQuery,
        allocQuery,
      ]);

      const posData = posRes.data;
      const colData = colRes.data;
      const itemsData = itemsRes.data;
      const allocData = allocRes.data;

      setPosActifsCount(posData?.length || 0);

      if (colData && colData.length > 0) {
        setCollections(colData);

        let totalExpected = 0;
        let totalCollected = 0;
        let totalDiff = 0;

        colData.forEach((c) => {
          totalExpected += Number(c.montant_attendu || 0);
          totalCollected += Number(c.montant_collecte || 0);
          totalDiff += Number(c.difference || 0);
        });

        setChiffreAffairesTotal(totalExpected);
        setMontantCollecteTotal(totalCollected);
        setEcartTotal(totalDiff);
      } else {
        setCollections([]);
        setChiffreAffairesTotal(0);
        setMontantCollecteTotal(0);
        setEcartTotal(0);
      }

      if (itemsData && itemsData.length > 0) {
        const totalSold = itemsData.reduce((acc, curr) => acc + (curr.quantite_vendue || 0), 0);
        setTicketsSoldTotal(totalSold);
      } else {
        setTicketsSoldTotal(0);
      }

      if (allocData && allocData.length > 0) {
        const totalAllocated = allocData.reduce((acc, curr) => acc + (curr.quantite || 0), 0);
        setTicketsAllouesTotal(totalAllocated);
      } else {
        setTicketsAllouesTotal(0);
      }

      setLoading(false);
    }

    loadDashboardData();
  }, [currentSpaceId, user?.organization_id, supabase]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-brand-900 to-brand-700 p-6 rounded-2xl text-white shadow-lg border border-brand-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenue dans votre espace, {user?.nom || 'Utilisateur'} 👋
          </h1>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* KPI 1: Tickets Vendus */}
        <StatTile
          label="Tickets Vendus"
          value={formatNumber(ticketsSoldTotal)}
          hint="Nombre total de pass écoulés"
          icon={Ticket}
          tone="brand"
        />

        {/* KPI 1b: Tickets Alloués */}
        <StatTile
          label="Tickets Alloués"
          value={formatNumber(ticketsAllouesTotal)}
          hint="Stock total distribué aux POS"
          icon={Package}
          tone="purple"
        />

        {/* KPI 2: Chiffre d'Affaires */}
        <StatTile
          label="Chiffre d'Affaires"
          value={formatCurrencyFCFA(chiffreAffairesTotal)}
          hint="Montant théorique attendu"
          icon={Banknote}
          tone="blueDark"
        />

        {/* KPI 3: Montant Encaissé */}
        <StatTile
          label="Total Encaissé"
          value={formatCurrencyFCFA(montantCollecteTotal)}
          hint="Total espèces perçues"
          icon={Receipt}
          tone="emerald"
        />

        {/* KPI 4: Écart Global */}
        <StatTile
          label="Écart / Différence"
          value={formatCurrencyFCFA(ecartTotal)}
          valueClassName={ecartTotal < 0 ? 'text-red-600' : 'text-emerald-600'}
          hint={`${posActifsCount} points enregistrés`}
          icon={ArrowDownRight}
          tone="red"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Main Content Grid: Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Raccourcis Métier */}
        <div className="lg:col-span-1 space-y-4 max-w-[405px]">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Raccourcis Métier</h2>
          
          <Card className="grid grid-cols-1 auto-rows-fr gap-3">
            {user?.role === 'administrateur' && (
              <Link
                href="/allocations/new"
                className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 hover:scale-[1.01] transition h-full"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-600 text-white">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Allouer des Tickets</p>
                    <p className="text-xs text-slate-500">Distribuer du stock aux POS</p>
                  </div>
                </div>
                <span className="text-purple-600 font-bold">→</span>
              </Link>
            )}

            <Link
              href="/collections/new"
              className="flex items-center justify-between p-3 rounded-xl bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900/50 hover:scale-[1.01] transition h-full"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-500 text-slate-950">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Nouvelle Collecte</p>
                  <p className="text-xs text-slate-500">Saisir un encaissement de caisse</p>
                </div>
              </div>
              <span className="text-brand-600 font-bold">→</span>
            </Link>

            <Link
              href="/pos"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:scale-[1.01] transition h-full"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-900 text-white">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Points de Vente</p>
                  <p className="text-xs text-slate-500">Gérer le réseau de distribution</p>
                </div>
              </div>
              <span className="text-slate-400 font-bold">→</span>
            </Link>

            <Link
              href="/tickets"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:scale-[1.01] transition h-full"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-600 text-white">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Types de Tickets</p>
                  <p className="text-xs text-slate-500">Consulter et modifier les tarifs</p>
                </div>
              </div>
              <span className="text-slate-400 font-bold">→</span>
            </Link>
          </Card>
        </div>

        {/* Left Column: Recent Collections */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Derniers Encaissements</h2>
            <Link href="/collections" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Voir tout →
            </Link>
          </div>

          {loading ? (
            <Card className="p-8 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto" />
              <p className="text-xs font-medium mt-2">Chargement des encaissements...</p>
            </Card>
          ) : collections.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun encaissement enregistré</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Vous n&apos;avez pas encore effectué d&apos;encaissement de caisse. Commencez par créer un point de vente ou enregistrer votre première collecte.
              </p>
              <Link href="/collections/new" className="inline-block pt-2">
                <Button variant="secondary" size="sm" className="font-bold gap-2">
                  <PlusCircle className="w-4 h-4" /> Effectuer une collecte
                </Button>
              </Link>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              {/* Mobile card list */}
              <ul className="sm:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {collections.slice(0, 5).map((col) => (
                  <li key={col.id} className="p-3.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCollection(col)}
                      aria-label={`Voir le détail de l'encaissement du ${col.pos?.nom || 'POS'}`}
                      className="md-ripple w-full space-y-1.5 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white min-w-0 truncate">
                          {col.pos?.nom || 'POS'}
                        </p>
                        <Badge variant={col.statut === 'validee' ? 'success' : 'warning'}>
                          {col.statut === 'validee' ? 'Validée' : 'Brouillon'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {col.collecteur?.nom || 'Collecteur'}
                      </p>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-base font-bold text-slate-900 dark:text-white">
                          {formatCurrencyFCFA(col.montant_collecte)}
                        </span>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {formatDateFR(col.created_at)}
                        </span>
                      </div>
                      <p className="flex items-center gap-1 text-[11px] font-semibold text-brand-600">
                        Voir le détail et la conciliation
                        <ChevronRight className="w-3.5 h-3.5" />
                      </p>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Point de Vente</th>
                      <th className="px-4 py-3">Collecteur</th>
                      <th className="px-4 py-3">Montant Encaissé</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">
                        <span className="sr-only">Détail</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {collections.slice(0, 5).map((col) => (
                      <tr
                        key={col.id}
                        onClick={() => setSelectedCollection(col)}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{col.pos?.nom || 'POS'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{col.collecteur?.nom || 'Collecteur'}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatCurrencyFCFA(col.montant_collecte)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={col.statut === 'validee' ? 'success' : 'warning'}>
                            {col.statut === 'validee' ? 'Validée' : 'Brouillon'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDateFR(col.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCollection(col);
                            }}
                            aria-label={`Voir le détail de l'encaissement du ${col.pos?.nom || 'POS'}`}
                            className="md-ripple tap-target inline-flex items-center justify-center rounded-full text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      <CollectionDetailSheet
        collection={selectedCollection}
        onClose={() => setSelectedCollection(null)}
      />
    </div>
  );
}
