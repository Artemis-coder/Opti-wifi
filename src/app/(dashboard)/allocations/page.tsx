'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, Plus, Store, Ticket, Loader2, Calendar, User, FileText, Repeat } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const [posRes, allocRes, ticketRes, profileRes] = await Promise.all([
        supabase.from('points_of_sale').select('*').order('nom'),
        supabase.from('ticket_allocations').select('*, pos:points_of_sale(*), ticket_type:ticket_types(*)').order('created_at', { ascending: false }),
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

  const filteredAllocations = selectedPosId === 'all'
    ? allocations
    : allocations.filter((a) => a.pos_id === selectedPosId);

  const allocationsByPos = filteredAllocations.reduce((acc, alloc) => {
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

  const getAllocatorName = (allouePar?: string) => {
    if (!allouePar) return 'Système';
    const profile = profiles.find((p) => p.id === allouePar);
    return profile?.nom || 'Utilisateur inconnu';
  };

  const getTicketTypeName = (ticketTypeId: string) => {
    const ticket = ticketTypes.find((t) => t.id === ticketTypeId);
    return ticket?.nom || 'Type inconnu';
  };

  const getTicketTypePrix = (ticketTypeId: string) => {
    const ticket = ticketTypes.find((t) => t.id === ticketTypeId);
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

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        Chargement des allocations...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-amber-500" />
            Suivi des Allocations
          </h1>
          <p className="text-xs text-slate-500">Historique complet des allocations de tickets par point de vente.</p>
        </div>
        <Link href="/allocations/new">
          <Button className="gap-2 font-semibold">
            <Plus className="w-4 h-4" />
            Nouvelle Allocation
          </Button>
        </Link>
        <Link href="/allocations/exchange">
          <Button variant="outline" className="gap-2 font-semibold">
            <Repeat className="w-4 h-4" />
            Échange de Tickets
          </Button>
        </Link>
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Filtrer par Point de Vente
            </label>
            <select
              value={selectedPosId}
              onChange={(e) => setSelectedPosId(e.target.value)}
              className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium"
            >
              <option value="all">Tous les points de vente</option>
              {posList.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.nom}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Allocations by POS */}
      {Object.keys(allocationsByPos).length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <ArrowLeftRight className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune allocation trouvée</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {selectedPosId === 'all'
              ? 'Aucune allocation n\'a été effectuée pour le moment.'
              : 'Ce point de vente n\'a aucune allocation enregistrée.'}
          </p>
          <Link href="/allocations/new">
            <Button variant="secondary" className="font-bold gap-2">
              <Plus className="w-4 h-4" /> Créer une allocation
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(allocationsByPos).map(([posId, { pos, allocations: posAllocations }]) => (
            <Card key={posId} className="overflow-hidden">
              {/* POS Header */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-900/10 text-blue-900 dark:text-blue-400">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {pos?.nom || 'Point de vente inconnu'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {pos?.ville || ''} {pos?.adresse ? `• ${pos.adresse}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant="neutral">
                    {posAllocations.length} allocation{posAllocations.length > 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>

              {/* Allocations Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Nature</th>
                      <th className="px-4 py-3">Type de Ticket</th>
                      <th className="px-4 py-3">Quantité</th>
                      <th className="px-4 py-3">Montant</th>
                      <th className="px-4 py-3">Alloué par</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {posAllocations.map((alloc) => {
                      const typeInfo = getAllocationTypeLabel(alloc);
                      const isReturn = alloc.type === 'exchange_return';
                      const isReceive = alloc.type === 'exchange_receive';
                      return (
                        <tr key={alloc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {formatDateFR(alloc.created_at)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={isReturn ? 'danger' : isReceive ? 'success' : 'info'}>
                              {typeInfo.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                              {getTicketTypeName(alloc.ticket_type_id)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${
                              isReturn ? 'text-red-600' : isReceive ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                            }`}>
                              {isReturn ? `-${alloc.quantite}` : alloc.quantite}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {formatCurrencyFCFA(alloc.quantite * getTicketTypePrix(alloc.ticket_type_id))}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {getAllocatorName(alloc.alloue_par)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {alloc.notes ? (
                              <div className="flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-slate-400" />
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

              {/* POS Footer Summary */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  Total pour ce POS :
                </span>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {posAllocations.reduce((sum, a) => {
                      const qty = a.type === 'exchange_return' ? -a.quantite : a.quantite;
                      return sum + qty;
                    }, 0)} tickets net
                  </span>
                  <span className="font-bold text-amber-600">
                    {formatCurrencyFCFA(
                      posAllocations.reduce(
                        (sum, a) => {
                          const qty = a.type === 'exchange_return' ? -a.quantite : a.quantite;
                          return sum + qty * getTicketTypePrix(a.ticket_type_id);
                        },
                        0
                      )
                    )}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}