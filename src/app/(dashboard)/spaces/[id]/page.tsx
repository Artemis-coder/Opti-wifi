'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  MapPin,
  Store,
  Edit,
  Trash2,
  ArrowLeft,
  Package,
  ShoppingCart,
  BarChart3,
  Receipt,
  Loader2,
  Info,
  Clock,
  Ticket,
  Banknote,
  Inbox,
  ArrowDownRight,
  ArrowLeftRight,
  PlusCircle,
  Link2,
  Unlink,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { formatCurrencyFCFA, formatNumber, formatDateFR } from '@/lib/utils/format';
import {
  PointOfSale,
  TicketType,
  TicketAllocation,
  Collection,
  CollectionItem,
  WifiSpace,
} from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { PosSummary } from '@/components/ui/PosSummary';

export default function SpaceDashboardPage() {
  const params = useParams();
  const spaceId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [space, setSpace] = useState<WifiSpace | null>(null);
  const [linkedPos, setLinkedPos] = useState<PointOfSale[]>([]);
  const [unlinkedPos, setUnlinkedPos] = useState<PointOfSale[]>([]);
  const [spaces, setSpaces] = useState<WifiSpace[]>([]);
  const [recentCollections, setRecentCollections] = useState<Collection[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [allocations, setAllocations] = useState<TicketAllocation[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [managePosSpaceId, setManagePosSpaceId] = useState<string | null>(null);

  // KPIs
  const [ticketsSoldTotal, setTicketsSoldTotal] = useState(0);
  const [chiffreAffairesTotal, setChiffreAffairesTotal] = useState(0);
  const [montantCollecteTotal, setMontantCollecteTotal] = useState(0);
  const [ecartTotal, setEcartTotal] = useState(0);
  const [ticketsAllouesTotal, setTicketsAllouesTotal] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);

  const { user } = useAuthStore();
  const supabase = createClient();

  useEffect(() => {
    async function loadSpaceData() {
      if (!spaceId) return;
      setLoading(true);

      const [
        spaceRes,
        posRes,
        spacesRes,
        ticketRes,
        allocRes,
        colRes,
      ] = await Promise.all([
        supabase.from('wifi_spaces').select('*').eq('id', spaceId).single(),
        supabase.from('points_of_sale').select(
          '*, collecteur:profiles(*), space:wifi_spaces(*)'
        ),
        supabase.from('wifi_spaces').select('*').order('nom'),
        supabase.from('ticket_types').select('*'),
        supabase.from('ticket_allocations').select('*, ticket_type:ticket_types(*)'),
        supabase
          .from('collections')
          .select('*, items:collection_items(*), pos:points_of_sale(*), collecteur:profiles(*)')
          .order('created_at', { ascending: false }),
      ]);

      if (spaceRes.data) setSpace(spaceRes.data);
      if (spacesRes.data) setSpaces(spacesRes.data);
      if (posRes.data) {
        setLinkedPos(posRes.data.filter((p: PointOfSale) => p.space_id === spaceId));
        setUnlinkedPos(
          posRes.data.filter(
            (p: PointOfSale) => !p.space_id
          )
        );
      }
      if (ticketRes.data) setTicketTypes(ticketRes.data);
      if (allocRes.data) setAllocations(allocRes.data);
      if (colRes.data) setCollections(colRes.data);

      // Compute KPIs
      const actualLinkedPosIds = (posRes.data || [])
        .filter((p: PointOfSale) => p.space_id === spaceId)
        .map((p: PointOfSale) => p.id);

      const spaceAllocations = (allocRes.data || []).filter((a: TicketAllocation) =>
        actualLinkedPosIds.includes(a.pos_id)
      );
      const spaceCollections = (colRes.data || []).filter((c: Collection) =>
        actualLinkedPosIds.includes(c.pos_id)
      );

      const spaceItems: CollectionItem[] = [];
      spaceCollections.forEach((c) => {
        if (c.items) spaceItems.push(...c.items);
      });

      const soldTotal = spaceItems.reduce(
        (acc, curr) => acc + (curr.quantite_vendue || 0),
        0
      );
      setTicketsSoldTotal(soldTotal);

      let totalExpected = 0;
      let totalCollected = 0;
      let totalDiff = 0;
      spaceCollections.forEach((c) => {
        totalExpected += Number(c.montant_attendu || 0);
        totalCollected += Number(c.montant_collecte || 0);
        totalDiff += Number(c.difference || 0);
      });
      setChiffreAffairesTotal(totalExpected);
      setMontantCollecteTotal(totalCollected);
      setEcartTotal(totalDiff);

      const totalAllocated = spaceAllocations.reduce(
        (acc, curr) => acc + (curr.quantite || 0),
        0
      );
      setTicketsAllouesTotal(totalAllocated);

      const commissionTotal = spaceCollections.reduce(
        (acc, curr) => acc + Number(curr.commission || 0),
        0
      );
      setTotalCommission(commissionTotal);

      setRecentCollections(spaceCollections.slice(0, 5));

      setLoading(false);
    }

    loadSpaceData();
  }, [spaceId, supabase]);

  const handleSpaceUpdated = (updated: WifiSpace) => {
    setSpace(updated);
  };

  const handleDeleteSpace = async () => {
    if (!space) return;

    const message =
      linkedPos.length > 0
        ? `Supprimer cet espace détachera ${linkedPos.length} point(s) de vente. Continuer ?`
        : 'Supprimer cet espace ?';
    if (!window.confirm(message)) return;

    if (linkedPos.length > 0) {
      await supabase
        .from('points_of_sale')
        .update({ space_id: null })
        .eq('space_id', spaceId);
      setLinkedPos([]);
      setUnlinkedPos((prev) => [...prev, ...linkedPos]);
    }

    const { error } = await supabase
      .from('wifi_spaces')
      .delete()
      .eq('id', spaceId);
    if (!error) {
      toast.success('Espace supprimé avec succès');
      window.location.href = '/spaces';
    } else {
      toast.error('Erreur lors de la suppression de l\'espace');
    }
  };

  const handleLinkPos = async (posId: string) => {
    const { data: posData, error: fetchError } = await supabase
      .from('points_of_sale')
      .select('*')
      .eq('id', posId)
      .single();
    if (fetchError || !posData) {
      toast.error('Erreur lors de la récupération du POS');
      return;
    }

    const { error } = await supabase
      .from('points_of_sale')
      .update({ space_id: spaceId })
      .eq('id', posId);
    if (!error) {
      const updatedPos = { ...posData, space_id: spaceId } as PointOfSale;
      setLinkedPos((prev) => [...prev, updatedPos]);
      setUnlinkedPos((prev) => prev.filter((p) => p.id !== posId));
      toast.success('POS rattaché à l\'espace');
    } else {
      toast.error('Erreur lors du rattachement du POS');
    }
  };

  const handleUnlinkPos = async (posId: string) => {
    const { error } = await supabase
      .from('points_of_sale')
      .update({ space_id: null })
      .eq('id', posId);
    if (!error) {
      const pos = linkedPos.find((p) => p.id === posId);
      if (pos) {
        const updatedPos = { ...pos, space_id: undefined };
        setLinkedPos((prev) => prev.filter((p) => p.id !== posId));
        setUnlinkedPos((prev) => [...prev, updatedPos]);
      }
      toast.success('POS détaché de l\'espace');
    } else {
      toast.error('Erreur lors du détachement du POS');
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        Chargement du tableau de bord...
      </div>
    );
  }

  if (!space) {
    return (
      <Card className="p-12 text-center space-y-3">
        <Info className="w-10 h-10 text-slate-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Espace introuvable
        </h3>
        <p className="text-xs text-slate-500">
          L'espace demandé n'existe pas ou a été supprimé.
        </p>
        <Link href="/spaces">
          <Button variant="secondary" size="sm">
            Retour aux espaces
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0b1a3a] to-[#162e63] p-6 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-bold">{space.nom}</h1>
          </div>
          {space.description && (
            <p className="text-sm text-slate-300 mt-1">{space.description}</p>
          )}
          {(space.adresse || space.ville) && (
            <div className="flex items-center gap-1 text-sm text-slate-400 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{[space.adresse, space.ville].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          {user?.role === 'administrateur' && (
            <>
              <Button
                onClick={() => setIsEditModalOpen(true)}
                className="gap-2 font-semibold bg-amber-500 text-slate-900 hover:bg-amber-400"
              >
                <Edit className="w-4 h-4" /> Modifier
              </Button>
              <Button
                onClick={handleDeleteSpace}
                className="gap-2 font-semibold bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4" /> Supprimer
              </Button>
            </>
          )}
        </div>
      </div>

{/* Linked POS Summary */}
       <Card className="p-4">
         <div className="flex items-center justify-between">
           <PosSummary
             linkedPosCount={linkedPos.length}
             activePosCount={linkedPos.filter((p) => p.statut === 'actif').length}
           />
           {user?.role === 'administrateur' && (
             <Button
               variant="ghost"
               size="sm"
               onClick={() => setManagePosSpaceId(spaceId)}
               className="gap-1 text-xs font-semibold text-blue-600"
             >
               <Link2 className="w-3.5 h-3.5" />
               Gérer les POS
             </Button>
           )}
         </div>
       </Card>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Tickets Alloués */}
        <Card className="border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tickets Alloués
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatNumber(ticketsAllouesTotal)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Stock distribué aux POS de cet espace
            </p>
          </div>
        </Card>

        {/* Tickets Vendus */}
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tickets Vendus
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatNumber(ticketsSoldTotal)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Nombre total de pass écoulés
            </p>
          </div>
        </Card>

        {/* Chiffre d'Affaires */}
        <Card className="border-l-4 border-l-blue-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Chiffre d'Affaires
            </span>
            <div className="p-2 rounded-lg bg-blue-900/10 text-blue-900 dark:text-blue-400">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatCurrencyFCFA(chiffreAffairesTotal)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Montant théorique attendu
            </p>
          </div>
        </Card>

         {/* Montant Encaissé */}
          <Card className="border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Encaissé
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatCurrencyFCFA(montantCollecteTotal)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Total espèces perçues
              </p>
            </div>
          </Card>

          {/* Commission Versée */}
          <Card className="border-l-4 border-l-teal-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Commission Versée
              </span>
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatCurrencyFCFA(totalCommission)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Total commissions aux POS de l&apos;espace
              </p>
            </div>
          </Card>

          {/* Écart / Différence */}
          <Card className="border-l-4 border-l-red-500">
            <div className="flex items-center justify-between">
             <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
               Écart / Différence
             </span>
             <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
               <ArrowDownRight className="w-5 h-5" />
             </div>
           </div>
           <div className="mt-3">
             <p
               className={`text-2xl font-extrabold ${
                 ecartTotal < 0
                   ? 'text-red-600'
                   : 'text-emerald-600'
               }`}
             >
               {formatCurrencyFCFA(ecartTotal)}
             </p>
             <p className="text-xs text-slate-500 mt-1">
               Écart entre attendu et encaissé
             </p>
           </div>
         </Card>
       </div>

      {/* Main Content Grid: Raccourcis & Recent Encaissements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Raccourcis Métier */}
        <div className="lg:col-span-1 space-y-4 max-w-[405px]">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Raccourcis Métier (Espace)
          </h2>

          <Card className="grid grid-cols-1 gap-3">
            {user?.role === 'administrateur' && (
              <Link
                href="/allocations/new"
                className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 hover:scale-[1.01] transition"
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
              className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 hover:scale-[1.01] transition"
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
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:scale-[1.01] transition"
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
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:scale-[1.01] transition"
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

        {/* Right Column: Derniers Encaissements */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Derniers Encaissements (Espace)
            </h2>
            <Link
              href="/collections"
              className="text-xs font-semibold text-amber-600 hover:text-amber-700"
            >
              Voir tout →
            </Link>
          </div>

          {loading ? (
            <Card className="p-8 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
              <p className="text-xs font-medium mt-2">Chargement des encaissements...</p>
            </Card>
          ) : recentCollections.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun encaissement enregistré</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Aucune collecte n'a été effectuée pour les points de vente rattachés à cet espace.
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
                    {recentCollections.map((col) => (
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
      </div>

      {/* Manage POS Modal */}
      {managePosSpaceId === spaceId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Gérer les Points de Vente
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setManagePosSpaceId(null)}
                >
                  ✕
                </Button>
              </div>

              {/* Linked POS */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  POS liés à cet espace ({linkedPos.length})
                </h3>
                {linkedPos.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Aucun POS n'est rattaché à cet espace.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {linkedPos.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {p.nom}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {p.ville}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkPos(p.id)}
                          className="gap-1 text-xs text-red-600 hover:text-red-700"
                        >
                          <Unlink className="w-3.5 h-3.5" /> Détacher
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unlinked POS */}
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  POS disponibles ({unlinkedPos.length})
                </h3>
                {unlinkedPos.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Tous les POS sont déjà rattachés à un espace.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {unlinkedPos.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Store className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {p.nom}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {p.ville}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleLinkPos(p.id)}
                          className="gap-1 text-xs py-1 px-2 h-7"
                        >
                          <Link2 className="w-3 h-3" /> Rattacher
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setManagePosSpaceId(null)}
                >
                  Fermer
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Space Modal */}
      {isEditModalOpen && space && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Modifier l'espace
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const nomVal = form.nom.value.trim();
                  if (!nomVal) return;

                  const { error } = await supabase
                    .from('wifi_spaces')
                    .update({
                      nom: nomVal,
                      description:
                        form.description.value.trim() || undefined,
                      adresse:
                        form.adresse.value.trim() || undefined,
                      ville: form.ville.value.trim() || undefined,
                      statut: form.statut.value as
                        | 'actif'
                        | 'inactif'
                        | 'suspendu',
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', space.id);
                  if (error) {
                    toast.error('Erreur lors de la mise à jour');
                  } else {
                    toast.success('Espace mis à jour avec succès');
                    setIsEditModalOpen(false);
                    window.location.reload();
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Nom de l'espace *
                  </label>
                  <input
                    name="nom"
                    defaultValue={space.nom}
                    required
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Description
                  </label>
                  <input
                    name="description"
                    defaultValue={space.description || ''}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Adresse
                  </label>
                  <input
                    name="adresse"
                    defaultValue={space.adresse || ''}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Ville
                  </label>
                  <input
                    name="ville"
                    defaultValue={space.ville || ''}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Statut
                  </label>
                  <select
                    name="statut"
                    defaultValue={space.statut}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                    <option value="suspendu">Suspendu</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsEditModalOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" variant="secondary">
                    Mettre à jour
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
