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
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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
      setLoading(true);

      // 1. Fetch POS count
      let posQuery = supabase.from('points_of_sale').select('id', { count: 'exact' });
      if (currentSpaceId) {
        posQuery = posQuery.eq('space_id', currentSpaceId);
      }
      const { data: posData } = await posQuery;
      setPosActifsCount(posData?.length || 0);

      // 2. Fetch recent collections & items
      let colQuery = supabase
        .from('collections')
        .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
        .order('created_at', { ascending: false });
      if (currentSpaceId) {
        colQuery = colQuery.eq('space_id', currentSpaceId);
      }
      const { data: colData } = await colQuery;

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

      // 3. Fetch tickets sold count from collection_items
      let itemsQuery = supabase.from('collection_items').select('quantite_vendue');
      if (currentSpaceId) {
        itemsQuery = itemsQuery.eq('space_id', currentSpaceId);
      }
      const { data: itemsData } = await itemsQuery;
      if (itemsData && itemsData.length > 0) {
        const totalSold = itemsData.reduce((acc, curr) => acc + (curr.quantite_vendue || 0), 0);
        setTicketsSoldTotal(totalSold);
      } else {
        setTicketsSoldTotal(0);
      }

      // 4. Fetch total allocated tickets from ticket_allocations
      let allocQuery = supabase.from('ticket_allocations').select('quantite');
      if (currentSpaceId) {
        allocQuery = allocQuery.eq('space_id', currentSpaceId);
      }
      const { data: allocData } = await allocQuery;
      if (allocData && allocData.length > 0) {
        const totalAllocated = allocData.reduce((acc, curr) => acc + (curr.quantite || 0), 0);
        setTicketsAllouesTotal(totalAllocated);
      } else {
        setTicketsAllouesTotal(0);
      }

      setLoading(false);
    }

    loadDashboardData();
  }, [currentSpaceId, supabase]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0b1a3a] to-[#162e63] p-6 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenue dans votre espace, {user?.nom || 'Utilisateur'} 👋
          </h1>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <Card className="border-l-4 border-l-red-500">
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

      {/* Main Content Grid: Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Point de Vente</th>
                      <th className="px-4 py-3">Collecteur</th>
                      <th className="px-4 py-3">Montant Encaissé</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {collections.slice(0, 5).map((col) => (
                      <tr key={col.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{col.pos?.nom || 'POS'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{col.collecteur?.nom || 'Collecteur'}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatCurrencyFCFA(col.montant_collecte)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={col.statut === 'validee' ? 'success' : 'warning'}>
                            {col.statut === 'validee' ? 'Validée' : 'Brouillon'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDateFR(col.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Quick Links & Actions */}
        <div className="space-y-4">
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
      </div>
    </div>
  );
}
