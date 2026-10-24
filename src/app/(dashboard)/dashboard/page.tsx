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
  User,
  Calendar,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatNumber, formatDateFR } from '@/lib/utils/format';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { createClient } from '@/lib/supabase/client';
import { Collection, CollectionItem, TicketAllocation } from '@/types/database';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { currentSpaceId } = useSpaceStore();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);

  // Computed KPIs from real Supabase DB
  const [ticketsSoldTotal, setTicketsSoldTotal] = useState(0);
  const [chiffreAffairesTotal, setChiffreAffairesTotal] = useState(0);
  const [montantCollecteTotal, setMontantCollecteTotal] = useState(0);
  const [ecartTotal, setEcartTotal] = useState(0);
  const [posActifsCount, setPosActifsCount] = useState(0);
  const [ticketsAllouesTotal, setTicketsAllouesTotal] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      setLoading(true);

      try {
        let posQuery = supabase.from('points_of_sale').select('id', { count: 'exact' });
        if (currentSpaceId) {
          posQuery = posQuery.eq('space_id', currentSpaceId);
        }

        let colQuery = supabase
          .from('collections')
          .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
          .order('created_at', { ascending: false });
        if (currentSpaceId) {
          colQuery = colQuery.eq('space_id', currentSpaceId);
        }

        let itemsQuery = supabase.from('collection_items').select('quantite_vendue');
        if (currentSpaceId) {
          itemsQuery = itemsQuery.eq('space_id', currentSpaceId);
        }

        let allocQuery = supabase.from('ticket_allocations').select('quantite');
        if (currentSpaceId) {
          allocQuery = allocQuery.eq('space_id', currentSpaceId);
        }

        const [posRes, colRes, itemsRes, allocRes] = await Promise.all([
          posQuery,
          colQuery,
          itemsQuery,
          allocQuery,
        ]);

        if (!isMounted) return;

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

          colData.forEach((c: Collection) => {
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
          const totalSold = itemsData.reduce((acc: number, curr: CollectionItem) => acc + (curr.quantite_vendue || 0), 0);
          setTicketsSoldTotal(totalSold);
        } else {
          setTicketsSoldTotal(0);
        }

        if (allocData && allocData.length > 0) {
          const totalAllocated = allocData.reduce((acc: number, curr: TicketAllocation) => acc + (curr.quantite || 0), 0);
          setTicketsAllouesTotal(totalAllocated);
        } else {
          setTicketsAllouesTotal(0);
        }
      } catch (err) {
        console.error('Erreur de chargement du tableau de bord:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [currentSpaceId]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-brand-900 to-brand-700 p-6 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenue dans votre espace, {user?.nom || 'Utilisateur'} 👋
          </h1>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* KPI 1: Tickets Vendus */}
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tickets Vendus</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatNumber(ticketsSoldTotal)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Nombre total de pass écoulés</p>
          </div>
        </Card>

        {/* KPI 1b: Tickets Alloués */}
        <Card className="border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tickets Alloués</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatNumber(ticketsAllouesTotal)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Stock total distribué aux POS</p>
          </div>
        </Card>

        {/* KPI 2: Chiffre d'Affaires */}
        <Card className="border-l-4 border-l-blue-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chiffre d&apos;Affaires</span>
            <div className="p-2 rounded-lg bg-blue-900/10 text-blue-900 dark:text-blue-400">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatCurrencyFCFA(chiffreAffairesTotal)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Montant théorique attendu</p>
          </div>
        </Card>

        {/* KPI 3: Montant Encaissé */}
        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Encaissé</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatCurrencyFCFA(montantCollecteTotal)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Total espèces perçues</p>
          </div>
        </Card>

        {/* KPI 4: Écart Global */}
        <Card className="border-l-4 border-l-red-500 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Écart / Différence</span>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className={`text-2xl font-extrabold ${ecartTotal < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {formatCurrencyFCFA(ecartTotal)}
            </p>
            <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
              <span>POS Enregistrés</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{posActifsCount} points</span>
            </div>
          </div>
        </Card>
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
              className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 hover:scale-[1.01] transition h-full"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500 text-slate-950">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Nouvelle Collecte</p>
                  <p className="text-xs text-slate-500">Saisir un encaissement de caisse</p>
                </div>
              </div>
              <span className="text-amber-600 font-bold">→</span>
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
            <Link href="/collections" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
              Voir tout →
            </Link>
          </div>

          {loading ? (
            <Card className="p-8 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
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
            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800">
              {/* Desktop Table View (hidden on mobile, visible from md upwards) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Point de Vente</th>
                      <th className="px-4 py-3">Collecteur</th>
                      <th className="px-4 py-3 text-right">Montant Encaissé</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {collections.slice(0, 5).map((col: Collection) => (
                      <tr 
                        key={col.id} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer"
                        onClick={() => window.location.href = `/collections/${col.id}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {col.pos?.nom || 'POS'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {col.collecteur?.nom || 'Collecteur'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                          {formatCurrencyFCFA(col.montant_collecte)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant={col.statut === 'validee' ? 'success' : col.statut === 'annulee' ? 'danger' : 'warning'}
                          >
                            {col.statut === 'validee' ? 'Validée' : col.statut === 'annulee' ? 'Annulée' : 'Brouillon'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {col.date_collecte ? formatDateFR(col.date_collecte) : formatDateFR(col.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout (visible on mobile, hidden from md upwards) */}
              <div className="md:hidden p-3 space-y-2.5">
                {collections.slice(0, 5).map((col: Collection) => (
                  <Link
                    href={`/collections/${col.id}`}
                    key={`dashboard-col-${col.id}`}
                    className="block p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2.5 shadow-xs hover:border-brand-300 transition-colors"
                  >
                    {/* Header: POS + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/20">
                          <Store className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {col.pos?.nom || 'POS'}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{col.collecteur?.nom || 'Collecteur'}</span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={col.statut === 'validee' ? 'success' : col.statut === 'annulee' ? 'danger' : 'warning'}
                        className="text-[10px] px-2 py-0.5 shrink-0"
                      >
                        {col.statut === 'validee' ? 'Validée' : col.statut === 'annulee' ? 'Annulée' : 'Brouillon'}
                      </Badge>
                    </div>

                    {/* Financial Inset & Date */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>{col.date_collecte ? formatDateFR(col.date_collecte) : formatDateFR(col.created_at)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                          Encaissé
                        </span>
                        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatCurrencyFCFA(col.montant_collecte)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
