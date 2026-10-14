'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Plus,
  Store,
  Ticket,
  Loader2,
  Calendar,
  User,
  FileText,
  Repeat,
  Search,
  Package,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { PointOfSale, TicketAllocation, TicketType, Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

export default function AllocationsPage() {
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<TicketAllocation[]>([]);
  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedPosId, setSelectedPosId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const [posRes, allocRes, ticketRes, profileRes] = await Promise.all([
        supabase.from('points_of_sale').select('*').order('nom'),
        supabase
          .from('ticket_allocations')
          .select('*, pos:points_of_sale(*), ticket_type:ticket_types(*)')
          .order('created_at', { ascending: false }),
        supabase.from('ticket_types').select('*').order('nom'),
        supabase.from('profiles').select('*'),
      ]);

      if (posRes.data) setPosList(posRes.data);
      if (allocRes.data) setAllocations(allocRes.data);
      if (ticketRes.data) setTicketTypes(ticketRes.data);
      if (profileRes.data) setProfiles(profileRes.data);

      setLoading(false);
    }

    loadData();
  }, [supabase]);

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

  const getAllocationTypeLabel = (alloc: TicketAllocation) => {
    switch (alloc.type) {
      case 'exchange_return':
        return { label: 'Rendu (Échange)', color: 'text-red-600' };
      case 'exchange_receive':
        return { label: 'Reçu (Échange)', color: 'text-emerald-600' };
      default:
        return { label: 'Allocation', color: 'text-amber-600' };
    }
  };

  // Overall KPIs calculation
  const { totalNetTickets, totalNetValeur, uniquePosCount } = useMemo(() => {
    let tickets = 0;
    let valeur = 0;
    const posSet = new Set<string>();

    allocations.forEach((a) => {
      posSet.add(a.pos_id);
      const isReturn = a.type === 'exchange_return';
      const qty = isReturn ? -a.quantite : a.quantite;
      tickets += qty;
      const price = getTicketTypePrix(a.ticket_type_id);
      valeur += qty * price;
    });

    return {
      totalNetTickets: tickets,
      totalNetValeur: valeur,
      uniquePosCount: posSet.size,
    };
  }, [allocations, ticketTypes]);

  // Filtered allocations based on dropdown and search query
  const filteredAllocations = useMemo(() => {
    let list = allocations;
    if (selectedPosId !== 'all') {
      list = list.filter((a: TicketAllocation) => a.pos_id === selectedPosId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((a: TicketAllocation) => {
        const posName = (a.pos?.nom || '').toLowerCase();
        const ticketName = getTicketTypeName(a.ticket_type_id).toLowerCase();
        const allocator = getAllocatorName(a.alloue_par).toLowerCase();
        const notes = (a.notes || '').toLowerCase();
        return posName.includes(q) || ticketName.includes(q) || allocator.includes(q) || notes.includes(q);
      });
    }
    return list;
  }, [allocations, selectedPosId, searchQuery, ticketTypes, profiles]);

  // Group allocations by POS
  const allocationsByPos: Record<string, { pos: PointOfSale | undefined; allocations: TicketAllocation[] }> = useMemo(() => {
    return filteredAllocations.reduce((acc, alloc: TicketAllocation) => {
      const posId = alloc.pos_id;
      if (!acc[posId]) {
        acc[posId] = {
          pos: alloc.pos,
          allocations: [],
        };
      }
      acc[posId].allocations.push(alloc);
      return acc;
    }, {} as Record<string, { pos: PointOfSale | undefined; allocations: TicketAllocation[] }>);
  }, [filteredAllocations]);

  if (loading) {
    return (
      <div className="py-16 flex flex-col justify-center items-center gap-3 text-slate-500 text-sm font-medium">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        <span>Chargement des allocations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
            <span>Suivi des Allocations</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Historique complet des mouvements et attributions de tickets par point de vente.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link href="/allocations/exchange" className="flex-1 sm:flex-initial">
            <Button variant="outline" size="sm" className="w-full gap-1.5 font-semibold text-xs sm:text-sm">
              <Repeat className="w-4 h-4" />
              <span>Échange de Tickets</span>
            </Button>
          </Link>
          <Link href="/allocations/new" className="flex-1 sm:flex-initial">
            <Button size="sm" className="w-full gap-1.5 font-bold text-xs sm:text-sm">
              <Plus className="w-4 h-4" />
              <span>Nouvelle Allocation</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Highlights Cards */}
      {allocations.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <Card className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <Ticket className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
              <span>Tickets Alloués</span>
            </div>
            <p className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {totalNetTickets} tickets
            </p>
          </Card>

          <Card className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <DollarSign className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Valeur Stock</span>
            </div>
            <p className="text-base sm:text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 truncate">
              {formatCurrencyFCFA(totalNetValeur)}
            </p>
          </Card>

          <Card className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>POS Desservis</span>
            </div>
            <p className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {uniquePosCount} points de vente
            </p>
          </Card>

          <Card className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Total Mouvements</span>
            </div>
            <p className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {allocations.length} opérations
            </p>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
              Filtrer par Point de Vente
            </label>
            <select
              value={selectedPosId}
              onChange={(e) => setSelectedPosId(e.target.value)}
              className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium"
            >
              <option value="all">Tous les points de vente</option>
              {posList.map((pos: PointOfSale) => (
                <option key={pos.id} value={pos.id}>
                  {pos.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
              Rechercher
            </label>
            <Input
              placeholder="Rechercher par ticket, POS, utilisateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              rightElement={<Search className="w-4 h-4 text-slate-400" />}
              className="h-10 text-xs sm:text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Allocations Content */}
      {Object.keys(allocationsByPos).length === 0 ? (
        <Card className="p-10 sm:p-12 text-center space-y-3 border-slate-200 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <ArrowLeftRight className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune allocation trouvée</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {selectedPosId === 'all' && !searchQuery
              ? "Aucune allocation n'a été effectuée pour le moment."
              : 'Aucun enregistrement ne correspond à vos critères de recherche.'}
          </p>
          <div className="pt-2">
            <Link href="/allocations/new">
              <Button variant="secondary" className="font-bold gap-2">
                <Plus className="w-4 h-4" /> Créer une allocation
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {Object.entries(allocationsByPos).map(([posId, { pos, allocations: posAllocations }]) => {
            const netPosTickets = posAllocations.reduce((sum: number, a: TicketAllocation) => {
              const qty = a.type === 'exchange_return' ? -a.quantite : a.quantite;
              return sum + qty;
            }, 0);

            const netPosValeur = posAllocations.reduce((sum: number, a: TicketAllocation) => {
              const qty = a.type === 'exchange_return' ? -a.quantite : a.quantite;
              return sum + qty * getTicketTypePrix(a.ticket_type_id);
            }, 0);

            return (
              <Card key={posId} className="p-0 overflow-hidden border-slate-200 dark:border-slate-800">
                {/* POS Header */}
                <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-900/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/20">
                        <Store className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                          {pos?.nom || 'Point de vente inconnu'}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">
                          {pos?.ville || ''} {pos?.adresse ? `• ${pos.adresse}` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge variant="neutral" className="text-[11px] px-2.5 py-0.5 shrink-0">
                      {posAllocations.length} op.
                    </Badge>
                  </div>
                </div>

                {/* Desktop Allocations Table (hidden on mobile, visible from md upwards) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Nature</th>
                        <th className="px-4 py-3">Type de Ticket</th>
                        <th className="px-4 py-3 text-right">Quantité</th>
                        <th className="px-4 py-3 text-right">Montant</th>
                        <th className="px-4 py-3">Alloué par</th>
                        <th className="px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                      {posAllocations.map((alloc: TicketAllocation) => {
                        const typeInfo = getAllocationTypeLabel(alloc);
                        const isReturn = alloc.type === 'exchange_return';
                        const isReceive = alloc.type === 'exchange_receive';
                        return (
                          <tr key={alloc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{formatDateFR(alloc.created_at)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={isReturn ? 'danger' : isReceive ? 'success' : 'info'}>
                                {typeInfo.label}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <Ticket className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {getTicketTypeName(alloc.ticket_type_id)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`font-bold ${
                                  isReturn
                                    ? 'text-red-600 dark:text-red-400'
                                    : isReceive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {isReturn ? `-${alloc.quantite}` : `+${alloc.quantite}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                              {formatCurrencyFCFA(alloc.quantite * getTicketTypePrix(alloc.ticket_type_id))}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{getAllocatorName(alloc.alloue_par)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {alloc.notes ? (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[200px]">{alloc.notes}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards Layout (visible on mobile, hidden from md upwards) */}
                <div className="md:hidden p-3 space-y-2.5">
                  {posAllocations.map((alloc: TicketAllocation) => {
                    const typeInfo = getAllocationTypeLabel(alloc);
                    const isReturn = alloc.type === 'exchange_return';
                    const isReceive = alloc.type === 'exchange_receive';
                    const unitPrice = getTicketTypePrix(alloc.ticket_type_id);
                    const totalPrice = alloc.quantite * unitPrice;

                    return (
                      <div
                        key={`mobile-alloc-${alloc.id}`}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2.5 shadow-xs"
                      >
                        {/* Header: Ticket Name + Nature Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                              <Ticket className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                {getTicketTypeName(alloc.ticket_type_id)}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{formatDateFR(alloc.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant={isReturn ? 'danger' : isReceive ? 'success' : 'info'}
                            className="text-[10px] px-2 py-0.5 shrink-0"
                          >
                            {typeInfo.label}
                          </Badge>
                        </div>

                        {/* Inset Numbers: Quantité & Valeur */}
                        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                              Quantité
                            </span>
                            <span
                              className={`text-sm font-extrabold ${
                                isReturn
                                  ? 'text-red-600 dark:text-red-400'
                                  : isReceive
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {isReturn ? `-${alloc.quantite}` : `+${alloc.quantite}`} tickets
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                              Valeur Totale
                            </span>
                            <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                              {formatCurrencyFCFA(totalPrice)}
                            </span>
                          </div>
                          <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 truncate">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">Par : {getAllocatorName(alloc.alloue_par)}</span>
                            </span>
                            <span className="font-medium shrink-0">{formatCurrencyFCFA(unitPrice)} / u</span>
                          </div>
                        </div>

                        {/* Notes if present */}
                        {alloc.notes && (
                          <p className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                            &laquo; {alloc.notes} &raquo;
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* POS Footer Summary */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Total pour ce POS :
                  </span>
                  <div className="flex items-center gap-3 font-bold">
                    <span className="text-slate-900 dark:text-white">
                      {netPosTickets} tickets net
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      {formatCurrencyFCFA(netPosValeur)}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}