'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  MapPin,
  Store,
  UserCheck,
  Edit,
  ArrowLeft,
  Package,
  ShoppingCart,
  BarChart3,
  Receipt,
  Loader2,
  Info,
  Clock,
  Ticket,
  Unlink,
  Link2,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { PointOfSale, Profile, TicketType, TicketAllocation, Collection, CollectionItem, WifiSpace } from '@/types/database';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';

interface SpaceAllocationSummary {
  ticketType: TicketType;
  alloue: number;
  vendu: number;
  restant: number;
  ca: number;
  ecarts: number;
}

interface SpaceCollectionSummary {
  totalExpected: number;
  totalCollected: number;
  totalDifference: number;
}

export default function SpaceDetailPage() {
  const params = useParams();
  const spaceId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [space, setSpace] = useState<WifiSpace | null>(null);
  const [linkedPos, setLinkedPos] = useState<PointOfSale[]>([]);
  const [unlinkedPos, setUnlinkedPos] = useState<PointOfSale[]>([]);
  const [allPos, setAllPos] = useState<PointOfSale[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [allocations, setAllocations] = useState<TicketAllocation[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [managePosSpaceId, setManagePosSpaceId] = useState<string | null>(null);

  const { user } = useAuthStore();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      if (!spaceId) return;
      setLoading(true);

      const [spaceRes, posRes, ticketRes, allocRes, colRes] = await Promise.all([
        supabase.from('wifi_spaces').select('*').eq('id', spaceId).single(),
        supabase.from('points_of_sale').select('*'),
        supabase.from('ticket_types').select('*'),
        supabase.from('ticket_allocations').select('*, ticket_type:ticket_types(*)'),
        supabase.from('collections').select('*, items:collection_items(*)'),
      ]);

      if (spaceRes.data) setSpace(spaceRes.data);
      if (posRes.data) setAllPos(posRes.data);
      if (ticketRes.data) setTicketTypes(ticketRes.data);
      if (allocRes.data) setAllocations(allocRes.data);
      if (colRes.data) setCollections(colRes.data);

      // Filter linked/unlinked POS
      if (posRes.data) {
        setLinkedPos(posRes.data.filter((p) => p.space_id === spaceId));
        setUnlinkedPos(posRes.data.filter((p) => p.space_id !== spaceId && p.space_id !== null));
      }

      setLoading(false);
    }

    loadData();
  }, [spaceId, supabase]);

  const handleSpaceUpdated = (updated: WifiSpace) => {
    setSpace(updated);
  };

  const handleDeleteSpace = async () => {
    if (!space) return;

    // First detach all linked POS
    if (linkedPos.length > 0) {
      await supabase
        .from('points_of_sale')
        .update({ space_id: null })
        .in('id', linkedPos.map((p) => p.id));
      setAllPos((prev) =>
        prev.map((p) =>
          linkedPos.some((lp) => lp.id === p.id)
            ? { ...p, space_id: undefined }
            : p
        )
      );
      setLinkedPos([]);
      setUnlinkedPos([...unlinkedPos, ...linkedPos]);
    }

    const { error } = await supabase.from('wifi_spaces').delete().eq('id', spaceId);
    if (!error) {
      // Redirect to spaces list
      // In a real app, we'd use router.push, but we'll rely on toast and manual navigation for now
      alert('Espace supprimé avec succès');
    } else {
      toast.error('Erreur lors de la suppression de l\'espace');
    }
  };

  const handleLinkPos = async (posId: string) => {
    const { error } = await supabase
      .from('points_of_sale')
      .update({ space_id: spaceId })
      .eq('id', posId);
    if (!error) {
      setAllPos((prev) =>
        prev.map((p) =>
          p.id === posId ? { ...p, space_id: spaceId } : p
        )
      );
      setLinkedPos((prev) => [...prev, allPos.find((p) => p.id === posId)!]);
      setUnlinkedPos((prev) => prev.filter((p) => p.id !== posId));
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
      setAllPos((prev) =>
        prev.map((p) =>
          p.id === posId ? { ...p, space_id: undefined } : p
        )
      );
      setLinkedPos((prev) => prev.filter((p) => p.id !== posId));
      setUnlinkedPos((prev) => [...prev, allPos.find((p) => p.id === posId)!]);
    } else {
      toast.error('Erreur lors du détachement du POS');
    }
  };

  // Compute aggregated KPIs for all linked POS
  const linkedPosIds = linkedPos.map((p) => p.id);

  // Filter data for linked POS only
  const spaceAllocations = allocations.filter((alloc) =>
    linkedPosIds.includes(alloc.pos_id)
  );

  const spaceCollections = collections.filter((col) =>
    linkedPosIds.includes(col.pos_id)
  );

  const spaceAllItems: CollectionItem[] = [];
  spaceCollections.forEach((c) => {
    if (c.items) spaceAllItems.push(...c.items);
  });

  const computeSpaceAllocationSummary = (): SpaceAllocationSummary[] => {
    if (!ticketTypes.length) return [];

    const summaryByTypeId = new Map<string, SpaceAllocationSummary>();

    ticketTypes.forEach((tt) => {
      summaryByTypeId.set(tt.id, {
        ticketType: tt,
        alloue: 0,
        vendu: 0,
        restant: 0,
        ca: 0,
        ecarts: 0,
      });
    });

    spaceAllocations.forEach((alloc) => {
      const tt = alloc.ticket_type;
      if (!tt) return;
      const s = summaryByTypeId.get(tt.id);
      if (s) {
        s.alloue += alloc.quantite;
      }
    });

    spaceAllItems.forEach((item) => {
      const tt = item.ticket_type;
      const typeId = item.ticket_type_id;
      const s = summaryByTypeId.get(typeId) || (tt ? summaryByTypeId.get(tt.id) : null);
      if (s) {
        s.vendu += item.quantite_vendue;
        s.ca += Number(item.montant_total || 0);
        const expected = item.quantite_vendue * (tt ? tt.prix : s.ticketType.prix);
        s.ecarts += Number(item.montant_total || 0) - expected;
      }
    });

    summaryByTypeId.forEach((s) => {
      s.restant = s.alloue - s.vendu;
    });

    return Array.from(summaryByTypeId.values()).filter(
      (s) => s.alloue > 0 || s.vendu > 0
    );
  };

  const allocationSummary = computeSpaceAllocationSummary();

  const totalAlloue = allocationSummary.reduce((sum, s) => sum + s.alloue, 0);
  const totalVendu = allocationSummary.reduce((sum, s) => sum + s.vendu, 0);
  const totalRestant = allocationSummary.reduce((sum, s) => sum + s.restant, 0);
  const totalCA = allocationSummary.reduce((sum, s) => sum + s.ca, 0);
  const totalEcarts = allocationSummary.reduce((sum, s) => sum + s.ecarts, 0);

  const totalExpected = spaceCollections.reduce(
    (sum, c) => sum + Number(c.montant_attendu || 0),
    0
  );
  const totalCollected = spaceCollections.reduce(
    (sum, c) => sum + Number(c.montant_collecte || 0),
    0
  );
  const totalDifference = totalCollected - totalExpected;

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        Chargement de l'espace...
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
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/spaces">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Retour
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-600" />
            {space.nom}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'administrateur' && (
            <>
              <Button
                onClick={() => setManagePosSpaceId(spaceId)}
                className="gap-2 font-semibold"
              >
                <Link2 className="w-4 h-4" />
                Rattacher des POS
              </Button>
              <Button onClick={() => setIsEditModalOpen(true)} className="gap-2 font-semibold">
                <Edit className="w-4 h-4" /> Modifier l'espace
              </Button>
              <Button
                onClick={handleDeleteSpace}
                className="gap-2 font-semibold text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" /> Supprimer
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Space Info Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-900/10 text-blue-900 dark:text-amber-400 border border-blue-900/20">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {space.nom}
              </h2>
              {space.description && (
                <p className="text-xs text-slate-500 mt-1">{space.description}</p>
              )}
              <div className="flex items-center gap-1 text-sm text-slate-500 mt-2">
                <MapPin className="w-4 h-4" />
                <span>
                  {[space.adresse, space.ville]
                    .filter(Boolean)
                    .join(', ') || 'Non spécifiée'}
                </span>
              </div>
            </div>
          </div>
          <Badge
            variant={
              space.statut === 'actif'
                ? 'success'
                : space.statut === 'suspendu'
                ? 'danger'
                : 'neutral'
            }
          >
            {space.statut}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-amber-500" />
            <span className="text-slate-500">Points de vente liés :</span>
            <strong className="text-xl font-extrabold text-slate-900 dark:text-white">
              {linkedPos.length}
            </strong>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">Créé le :</span>
            <span className="text-slate-800 dark:text-slate-200">
              {formatDateFR(space.created_at)}
            </span>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <Card className="border-l-4 border-l-amber-500">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tickets Alloués
          </span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Package className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {totalAlloue}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Stock total alloué à tous les POS de cet espace
          </p>
        </div>
      </Card>

      <Card className="border-l-4 border-l-blue-900">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tickets Vendus
          </span>
          <div className="p-2 rounded-lg bg-blue-900/10 text-blue-900 dark:text-blue-400">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {totalVendu}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Nombre total de pass écoulés dans l'espace
          </p>
        </div>
      </Card>

      <Card className="border-l-4 border-l-emerald-500">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tickets Restants
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Package className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {totalRestant}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Stock non encore vendu dans l'espace
          </p>
        </div>
      </Card>

      <Card className="border-l-4 border-l-amber-500">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Chiffre d&apos;Affaires
          </span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatCurrencyFCFA(totalCA)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            CA total depuis les collectes de l'espace
          </p>
        </div>
      </Card>

      {/* Linked POS List */}
      {linkedPos.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" />
              Points de vente liés à cet espace ({linkedPos.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Point de Vente</th>
                  <th className="px-4 py-3">Ville</th>
                  <th className="px-4 py-3 text-right">Statut</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {linkedPos.map((pos) => (
                  <tr key={pos.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5" />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {pos.nom}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{pos.ville}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          pos.statut === 'actif'
                            ? 'success'
                            : pos.statut === 'suspendu'
                            ? 'danger'
                            : 'neutral'
                        }
                      >
                        {pos.statut}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {user?.role === 'administrateur' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkPos(pos.id)}
                          className="gap-1 text-xs text-red-600 hover:text-red-700"
                        >
                          <Unlink className="w-3 h-3" /> Détacher
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold">
                  <td className="px-4 py-3 text-slate-900 dark:text-white">Total</td>
                  <td className="px-4 py-3">{linkedPos.length}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Unlinked POS List (for linking) */}
      {managePosSpaceId === spaceId && unlinkedPos.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-600" />
              Points de vente disponibles à rattacher ({unlinkedPos.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Point de Vente</th>
                  <th className="px-4 py-3">Ville</th>
                  <th className="px-4 py-3 text-right">Statut</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {unlinkedPos.map((pos) => (
                  <tr key={pos.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5" />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {pos.nom}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{pos.ville}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          pos.statut === 'actif'
                            ? 'success'
                            : pos.statut === 'suspendu'
                            ? 'danger'
                            : 'neutral'
                        }
                      >
                        {pos.statut}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleLinkPos(pos.id)}
                        className="gap-1 text-[11px] py-1 px-2 h-7"
                      >
                        Rattacher
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setManagePosSpaceId(null)}
              className="gap-2 font-semibold"
            >
              Fermer la liste
            </Button>
          </div>
        </Card>
      )}

      {/* Allocation Summary Table (for the space) */}
      {allocationSummary.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-500" />
              Suivi des Allocations de Tickets (Espace)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Type de Ticket</th>
                  <th className="px-4 py-3 text-right">Alloués</th>
                  <th className="px-4 py-3 text-right">Vendus</th>
                  <th className="px-4 py-3 text-right">Restants</th>
                  <th className="px-4 py-3 text-right">CA (FCFA)</th>
                  <th className="px-4 py-3 text-right">Écarts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {allocationSummary.map((s) => (
                  <tr key={s.ticketType.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          <Ticket className="w-4 h-4" />
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {s.ticketType.nom}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {formatCurrencyFCFA(s.ticketType.prix)} / unité
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                      {s.alloue}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                      {s.vendu}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`${s.restant > 0 ? 'text-emerald-600' : s.restant < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                        {s.restant > 0 ? s.restant : '0'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrencyFCFA(s.ca)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.ecarts === 0 ? (
                        <span className="text-emerald-600 flex items-center justify-end gap-1">
                          <Info className="w-3.5 h-3.5" /> Conforme
                        </span>
                      ) : (
                        <span className={s.ecarts < 0 ? 'text-red-600' : 'text-emerald-600'}>
                          {formatCurrencyFCFA(s.ecarts)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold">
                  <td className="px-4 py-3 text-slate-900 dark:text-white">Totaux</td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    {totalAlloue}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    {totalVendu}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    {totalRestant}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-600">
                    {formatCurrencyFCFA(totalCA)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {totalEcarts === 0 ? (
                      <span className="text-emerald-600">Conforme</span>
                    ) : (
                      <span className={totalEcarts < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {formatCurrencyFCFA(totalEcarts)}
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Collections Summary (for the space) */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            Historique des Collectes (Espace)
          </h2>
        </div>

        {collections.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Aucune collecte enregistrée
            </h3>
            <p className="text-xs text-slate-500">
              Aucune collecte de caisse n'a été effectuée pour les points de vente de cet espace.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Montant Attendu</th>
                  <th className="px-4 py-3">Montant Encaissé</th>
                  <th className="px-4 py-3">Écart</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {spaceCollections.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {formatDateFR(c.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatCurrencyFCFA(Number(c.montant_attendu))}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                      {formatCurrencyFCFA(Number(c.montant_collecte))}
                    </td>
                    <td className="px-4 py-3">
                      {Number(c.difference) === 0 ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">Conforme</span>
                      ) : (
                        <span className={Number(c.difference) < 0 ? 'text-red-600' : 'text-emerald-600'}>
                          {formatCurrencyFCFA(Number(c.difference))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.statut === 'validee' ? 'success' : c.statut === 'annulee' ? 'danger' : 'warning'}>
                        {c.statut === 'validee' ? 'Validée' : c.statut === 'annulee' ? 'Annulée' : 'Brouillon'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold">
                  <td className="px-4 py-3 text-slate-900 dark:text-white">Totaux</td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    {formatCurrencyFCFA(totalExpected)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    {formatCurrencyFCFA(totalCollected)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {totalDifference === 0 ? (
                      <span className="text-emerald-600">Conforme</span>
                    ) : (
                      <span className={totalDifference < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {formatCurrencyFCFA(Math.abs(totalDifference))} {totalDifference < 0 ? '(-)' : '(+)'}
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
                      description: form.description.value.trim() || undefined,
                      adresse: form.adresse.value.trim() || undefined,
                      ville: form.ville.value.trim() || undefined,
                      statut: form.statut.value as 'actif' | 'inactif' | 'suspendu',
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
                  <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>
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