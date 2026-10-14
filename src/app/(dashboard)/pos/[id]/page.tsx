'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Store,
  MapPin,
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
  User,
  FileText,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EditPosModal } from '../edit-pos-modal';
import { ResetPosModal } from './reset-pos-modal';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { PointOfSale, Profile, TicketType, TicketAllocation, Collection, CollectionItem, WifiSpace } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';

interface AllocationSummary {
  ticketType: TicketType;
  alloue: number;
  vendu: number;
  restant: number;
  ca: number;
  ecarts: number;
}

export default function PosDetailPage() {
  const params = useParams();
  const posId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState<PointOfSale | null>(null);
  const [collectors, setCollectors] = useState<Profile[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [allocations, setAllocations] = useState<TicketAllocation[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [spaces, setSpaces] = useState<WifiSpace[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'administrateur';

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      if (!posId) return;
      setLoading(true);

      const { data: posData } = await supabase
        .from('points_of_sale')
        .select('*, collecteur:profiles(*), space:wifi_spaces(*)')
        .eq('id', posId)
        .single();

      setPos(posData || null);

      const { data: colData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'collecteur');
      setCollectors(colData || []);

      const { data: profilesData } = await supabase.from('profiles').select('*');
      if (profilesData) setProfiles(profilesData);

      const { data: ticketData } = await supabase.from('ticket_types').select('*');
      setTicketTypes(ticketData || []);

      const { data: allocData } = await supabase
        .from('ticket_allocations')
        .select('*, ticket_type:ticket_types(*)')
        .eq('pos_id', posId)
        .order('created_at', { ascending: false });
      setAllocations(allocData || []);

      const { data: colItemsData } = await supabase
        .from('collections')
        .select('*, items:collection_items(*)')
        .eq('pos_id', posId)
        .order('created_at', { ascending: false });
      setCollections(colItemsData || []);

      const { data: spacesData } = await supabase.from('wifi_spaces').select('*');
      if (spacesData) setSpaces(spacesData);

      setLoading(false);
    }

    loadData();
  }, [posId]);

  const handlePosUpdated = (updated: PointOfSale) => {
    setPos(updated);
  };

  const handleResetSuccess = () => {
    setAllocations([]);
    setCollections([]);
  };

  const computeAllocationSummary = (): AllocationSummary[] => {
    if (!ticketTypes.length) return [];

    const summaryByTypeId = new Map<string, AllocationSummary>();

    ticketTypes.forEach((tt: TicketType) => {
      summaryByTypeId.set(tt.id, {
        ticketType: tt,
        alloue: 0,
        vendu: 0,
        restant: 0,
        ca: 0,
        ecarts: 0,
      });
    });

    allocations.forEach((alloc: TicketAllocation) => {
      const tt = alloc.ticket_type;
      if (!tt) return;
      const s = summaryByTypeId.get(tt.id);
      if (s) {
        const qty = alloc.type === 'exchange_return' ? -alloc.quantite : alloc.quantite;
        s.alloue += qty;
      }
    });

    const allItems: CollectionItem[] = [];
    collections.forEach((c: Collection) => {
      if (c.items) {
        if (Array.isArray(c.items)) {
          allItems.push(...c.items);
        } else if (typeof c.items === 'object') {
          allItems.push(c.items as CollectionItem);
        }
      }
    });

    allItems.forEach((item: CollectionItem) => {
      if (!item) return;
      const tt = item.ticket_type;
      const typeId = item.ticket_type_id;
      const s = summaryByTypeId.get(typeId) || (tt ? summaryByTypeId.get(tt.id) : null);
      if (s) {
        const qtyVendu = Number(item.quantite_vendue || 0);
        const montantTotal = Number(item.montant_total || 0);
        const unitPrix = Number(tt ? tt.prix : s.ticketType.prix || 0);
        s.vendu += qtyVendu;
        s.ca += montantTotal;
        const expected = qtyVendu * unitPrix;
        s.ecarts += montantTotal - expected;
      }
    });

    summaryByTypeId.forEach((s: AllocationSummary) => {
      s.restant = s.alloue - s.vendu;
    });

    return Array.from(summaryByTypeId.values()).filter((s: AllocationSummary) => s.alloue > 0 || s.vendu > 0);
  };

  const allocationSummary = computeAllocationSummary();

  const totalAlloue = allocationSummary.reduce((sum: number, s: AllocationSummary) => sum + s.alloue, 0);
  const totalVendu = allocationSummary.reduce((sum: number, s: AllocationSummary) => sum + s.vendu, 0);
  const totalRestant = allocationSummary.reduce((sum: number, s: AllocationSummary) => sum + s.restant, 0);
  const totalCA = allocationSummary.reduce((sum: number, s: AllocationSummary) => sum + s.ca, 0);
  const totalEcarts = allocationSummary.reduce((sum: number, s: AllocationSummary) => sum + s.ecarts, 0);

  const totalExpected = collections.reduce((sum: number, c: Collection) => sum + Number(c.montant_attendu || 0), 0);
  const totalCollected = collections.reduce((sum: number, c: Collection) => sum + Number(c.montant_collecte || 0), 0);
  const totalDifference = totalCollected - totalExpected;
  const totalCommission = collections.reduce((sum: number, c: Collection) => sum + Number(c.commission || 0), 0);

  const getAllocatorName = (allouePar?: string) => {
    if (!allouePar) return 'Système';
    const profile = profiles.find((p: Profile) => p.id === allouePar);
    return profile?.nom || 'Utilisateur inconnu';
  };

  const getTicketTypeName = (ticketTypeId: string) => {
    const ticket = ticketTypes.find((t: TicketType) => t.id === ticketTypeId);
    return ticket?.nom || 'Type inconnu';
  };

  const getTicketTypePrix = (ticketTypeId: string) => {
    const ticket = ticketTypes.find((t: TicketType) => t.id === ticketTypeId);
    return ticket?.prix || 0;
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        Chargement du point de vente...
      </div>
    );
  }

  if (!pos) {
    return (
      <Card className="p-12 text-center space-y-3">
        <Info className="w-10 h-10 text-slate-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Point de vente introuvable</h3>
        <p className="text-xs text-slate-500">Le point de vente demandé n&apos;existe pas ou a été supprimé.</p>
        <Link href="/pos">
          <Button variant="secondary" size="sm">
            Retour aux points de vente
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/pos" className="shrink-0">
            <Button variant="ghost" size="sm" className="gap-1.5 px-2.5">
              <ArrowLeft className="w-4 h-4" /> <span className="hidden xs:inline">Retour</span>
            </Button>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 min-w-0 truncate">
            <Store className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
            <span className="truncate">{pos.nom}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {isAdmin && (
            <Button
              variant="ghost"
              onClick={() => setIsResetModalOpen(true)}
              className="flex-1 sm:flex-initial gap-1.5 font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs sm:text-sm px-3"
              title="Vider toutes les données de ce POS"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Vider</span>
            </Button>
          )}
          <Button
            onClick={() => setIsEditModalOpen(true)}
            className="flex-1 sm:flex-initial gap-1.5 font-semibold text-xs sm:text-sm px-3"
          >
            <Edit className="w-4 h-4 shrink-0" /> <span>Modifier</span>
          </Button>
        </div>
      </div>

      {/* POS Info Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-900/10 text-blue-900 dark:text-amber-400 border border-blue-900/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{pos.nom}</h2>
              <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                <MapPin className="w-4 h-4" />
                <span>{pos.adresse || pos.ville}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-slate-500 mt-0.5">
                <MapPin className="w-4 h-4" />
                <span>{pos.ville}</span>
              </div>
            </div>
          </div>
          <Badge variant={pos.statut === 'actif' ? 'success' : pos.statut === 'suspendu' ? 'danger' : 'neutral'}>
            {pos.statut}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <UserCheck className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">Collecteur :</span>
            <strong className="text-slate-800 dark:text-slate-200">
              {pos.collecteur?.nom || 'Non attribué'}
            </strong>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">Créé le :</span>
            <span className="text-slate-800 dark:text-slate-200">{formatDateFR(pos.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm md:col-span-2">
            <MapPin className="w-4 h-4 text-amber-500" />
            <span className="text-slate-500">Espace Wi-Fi :</span>
            {pos.space_id ? (
              <Link href="/spaces" className="font-semibold text-amber-600 hover:text-amber-700 hover:underline">
                {pos.space?.nom || spaces.find((s: WifiSpace) => s.id === pos.space_id)?.nom || 'Espace inconnu'}
              </Link>
            ) : (
              <strong className="text-slate-500 italic">Non rattaché à un espace</strong>
            )}
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tickets Alloués</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalAlloue}</p>
            <p className="text-xs text-slate-500 mt-1">Stock total alloué à ce POS</p>
          </div>
        </Card>

        <Card className="border-l-4 border-l-blue-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tickets Vendus</span>
            <div className="p-2 rounded-lg bg-blue-900/10 text-blue-900 dark:text-blue-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalVendu}</p>
            <p className="text-xs text-slate-500 mt-1">Nombre total de pass écoulés</p>
          </div>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tickets Restants</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalRestant}</p>
            <p className="text-xs text-slate-500 mt-1">Stock non encore vendu</p>
          </div>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chiffre d&apos;Affaires</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatCurrencyFCFA(totalCA)}
            </p>
            <p className="text-xs text-slate-500 mt-1">CA total depuis les collectes</p>
          </div>
        </Card>

        <Card className="border-l-4 border-l-amber-500 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Commission Totale</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatCurrencyFCFA(totalCommission)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Total commissions versées</p>
          </div>
        </Card>
      </div>

      {/* Allocation Summary Table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            Suivi des Allocations de Tickets
          </h2>
          {allocationSummary.length > 0 && (
            <span className="text-xs text-slate-500 font-medium">
              {allocationSummary.length} {allocationSummary.length > 1 ? 'types' : 'type'}
            </span>
          )}
        </div>

        {allocationSummary.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune allocation pour ce POS</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Aucun ticket n&apos;a été alloué à ce point de vente. Rendez-vous sur la page des allocations pour distribuer du stock.
            </p>
            <Link href="/allocations/new">
              <Button variant="secondary" size="sm" className="gap-2 font-bold">
                <Package className="w-4 h-4" /> Allouer des Tickets
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
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
                  {allocationSummary.map((s: AllocationSummary) => (
                    <tr key={s.ticketType.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            <Ticket className="w-4 h-4" />
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">{s.ticketType.nom}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {formatCurrencyFCFA(s.ticketType.prix)} / unité
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{s.alloue}</td>
                      <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{s.vendu}</td>
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
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{totalAlloue}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{totalVendu}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{totalRestant}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatCurrencyFCFA(totalCA)}</td>
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

            {/* Mobile Card Layout (< md) */}
            <div className="md:hidden p-3 space-y-3">
              {allocationSummary.map((s: AllocationSummary) => (
                <div
                  key={`mobile-summary-${s.ticketType.id}`}
                  className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-xs"
                >
                  {/* Header: Ticket Name + Price + Conforme badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {s.ticketType.nom}
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          {formatCurrencyFCFA(s.ticketType.prix)} / ticket
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {s.ecarts === 0 ? (
                        <Badge variant="success" className="text-[10px] px-2 py-0.5">
                          ✓ Conforme
                        </Badge>
                      ) : (
                        <Badge variant={s.ecarts < 0 ? 'danger' : 'success'} className="text-[10px] px-2 py-0.5">
                          {formatCurrencyFCFA(s.ecarts)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 3-column Counters: Alloués / Vendus / Restants */}
                  <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-center">
                    <div className="py-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Alloués</span>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block">{s.alloue}</span>
                    </div>
                    <div className="py-1 border-x border-slate-200 dark:border-slate-700/80">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Vendus</span>
                      <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 block">{s.vendu}</span>
                    </div>
                    <div className="py-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Restants</span>
                      <span className={`text-sm font-extrabold mt-0.5 block ${s.restant > 0 ? 'text-emerald-600 dark:text-emerald-400' : s.restant < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                        {s.restant > 0 ? s.restant : '0'}
                      </span>
                    </div>
                  </div>

                  {/* Footer: CA */}
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-500 font-medium">CA théorique</span>
                    <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                      {formatCurrencyFCFA(s.ca)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Totaux Mobile Card */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Totaux consolidés
                  </span>
                  <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400">
                    {formatCurrencyFCFA(totalCA)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-amber-200 dark:border-amber-800/50">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Total Alloué</span>
                    <strong className="text-slate-900 dark:text-white font-extrabold text-sm">{totalAlloue}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Total Vendu</span>
                    <strong className="text-blue-600 dark:text-blue-400 font-extrabold text-sm">{totalVendu}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Total Restant</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{totalRestant}</strong>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Allocation History */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Historique des Allocations
          </h2>
          {allocations.length > 0 && (
            <span className="text-xs text-slate-500 font-medium">
              {allocations.length} {allocations.length > 1 ? 'entrées' : 'entrée'}
            </span>
          )}
        </div>

        {allocations.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Clock className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune allocation enregistrée</h3>
            <p className="text-xs text-slate-500">
              Aucune allocation de tickets n&apos;a été effectuée pour ce point de vente.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type de Ticket</th>
                    <th className="px-4 py-3 text-right">Quantité</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3">Alloué par</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {allocations.map((a: TicketAllocation) => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDateFR(a.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                          {getTicketTypeName(a.ticket_type_id)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{a.quantite}</td>
                      <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                        {formatCurrencyFCFA(a.quantite * getTicketTypePrix(a.ticket_type_id))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {getAllocatorName(a.alloue_par)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{a.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout (< md) */}
            <div className="md:hidden p-3 space-y-3">
              {allocations.map((a: TicketAllocation) => {
                const isExchangeReturn = a.type === 'exchange_return';
                const isExchangeReceive = a.type === 'exchange_receive';
                const unitPrice = getTicketTypePrix(a.ticket_type_id);
                const totalAmount = a.quantite * unitPrice;

                return (
                  <div
                    key={`mobile-alloc-${a.id}`}
                    className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 space-y-2.5 shadow-xs"
                  >
                    {/* Top: Ticket Name + Type Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            isExchangeReturn
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : isExchangeReceive
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          <Ticket className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {getTicketTypeName(a.ticket_type_id)}
                          </h4>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{formatDateFR(a.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={isExchangeReturn ? 'warning' : isExchangeReceive ? 'info' : 'success'}
                        className="text-[10px] px-2 py-0.5 shrink-0"
                      >
                        {isExchangeReturn ? 'Retour' : isExchangeReceive ? 'Échange' : 'Allocation'}
                      </Badge>
                    </div>

                    {/* Stock & Value Card */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                          Quantité
                        </span>
                        <span className={`text-sm font-extrabold ${isExchangeReturn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                          {isExchangeReturn ? `-${a.quantite}` : `+${a.quantite}`}{' '}
                          <span className="text-xs font-normal text-slate-500">tickets</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                          Valeur Stock
                        </span>
                        <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                          {formatCurrencyFCFA(totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Alloué par & Notes */}
                    <div className="space-y-1 text-xs pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" /> Alloué par :
                        </span>
                        <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                          {getAllocatorName(a.alloue_par)}
                        </strong>
                      </div>
                      {a.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2 py-1 rounded-lg italic mt-1">
                          &ldquo;{a.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Collection History */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            Historique des Collectes
          </h2>
          {collections.length > 0 && (
            <span className="text-xs text-slate-500 font-medium">
              {collections.length} {collections.length > 1 ? 'collectes' : 'collecte'}
            </span>
          )}
        </div>

        {collections.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune collecte enregistrée</h3>
            <p className="text-xs text-slate-500">
              Aucune collecte de caisse n&apos;a été effectuée pour ce point de vente.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
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
                  {collections.map((c: Collection) => (
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
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout (< md) */}
            <div className="md:hidden p-3 space-y-3">
              {collections.map((c: Collection) => (
                <div
                  key={`mobile-col-${c.id}`}
                  className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 space-y-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDateFR(c.created_at)}</span>
                    </div>
                    <Badge variant={c.statut === 'validee' ? 'success' : c.statut === 'annulee' ? 'danger' : 'warning'} className="text-[10px] px-2 py-0.5">
                      {c.statut === 'validee' ? 'Validée' : c.statut === 'annulee' ? 'Annulée' : 'Brouillon'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">Attendu</span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {formatCurrencyFCFA(Number(c.montant_attendu))}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">Encaissé</span>
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyFCFA(Number(c.montant_collecte))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-500 text-[11px]">Écart de caisse</span>
                    {Number(c.difference) === 0 ? (
                      <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">✓ Conforme</span>
                    ) : (
                      <span className={`font-bold text-xs ${Number(c.difference) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrencyFCFA(Number(c.difference))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Financial Summary */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          Synthèse Financière
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant Attendu</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {formatCurrencyFCFA(totalExpected)}
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant Encaissé</p>
            <p className="text-xl font-extrabold text-emerald-600 mt-1">
              {formatCurrencyFCFA(totalCollected)}
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Écart Global</p>
            <p className={`text-xl font-extrabold mt-1 ${
              totalDifference === 0
                ? 'text-emerald-600'
                : totalDifference < 0
                ? 'text-red-600'
                : 'text-emerald-600'
            }`}>
              {formatCurrencyFCFA(totalDifference)}
            </p>
          </div>
        </div>
      </Card>

      {/* Edit POS Modal */}
      <EditPosModal
        key={`edit-pos-${pos?.id || 'new'}`}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        pos={pos}
        collectors={collectors}
        spaces={spaces}
        onSuccess={handlePosUpdated}
      />

      {/* Reset POS Modal */}
      {isAdmin && (
        <ResetPosModal
          isOpen={isResetModalOpen}
          posId={posId}
          posName={pos?.nom || ''}
          onClose={() => setIsResetModalOpen(false)}
          onSuccess={handleResetSuccess}
        />
      )}
    </div>
  );
}
