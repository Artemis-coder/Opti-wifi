'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  Store,
  Ticket,
  Loader2,
  Calendar,
  User,
  FileText,
  Repeat,
  Search,
  DollarSign,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { formatAmountShort, formatCurrencyFCFA, formatDateFR, formatNumber } from '@/lib/utils/format';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { PointOfSale, TicketAllocation, TicketType, Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { AddButton } from '@/components/ui/AddButton';
import { useAuthStore } from '@/lib/stores/authStore';

export default function AllocationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<TicketAllocation[]>([]);
  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedPosId, setSelectedPosId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const supabase = createClient();
  const role = useAuthStore((s) => s.user?.role);
  const isCollector = role === 'collecteur';
  // Compte point de vente : consultation seule de ses propres allocations
  const isPosAccount = role === 'point_de_vente';

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
    return profile?.nom || (isPosAccount ? 'Votre fournisseur' : 'Utilisateur inconnu');
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
        return { label: 'Rendu (Échange)', color: 'text-danger' };
      case 'exchange_receive':
        return { label: 'Reçu (Échange)', color: 'text-success-soft-foreground' };
      default:
        return { label: 'Allocation', color: 'text-warning-soft-foreground' };
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
      <div className="py-10 flex flex-col justify-center items-center gap-3 text-muted text-sm font-medium">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <span>Chargement des allocations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6 text-muted" />
            <span>{isCollector || isPosAccount ? 'Mes allocations' : 'Suivi des Allocations'}</span>
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {isPosAccount
              ? 'Les tickets reçus par votre point de vente (consultation seule).'
              : isCollector
              ? 'Les tickets attribués à vos points de vente.'
              : 'Historique complet des mouvements et attributions de tickets par point de vente.'}
          </p>
        </div>

        {/* Action Buttons */}
        {!isPosAccount && (
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link href="/allocations/exchange" className={buttonClassName({ variant: 'outline', size: 'sm', className: 'flex-1 sm:flex-initial' })}>
            <Repeat className="size-4" />
            <span>Échange de tickets</span>
          </Link>
          <AddButton what="une allocation" tour="add:allocation" href="/allocations/new" className="flex-1 sm:flex-initial" />
        </div>
        )}
      </div>

      {/* Chiffres clés : mêmes cadres que le tableau de bord et les rapports */}
      {allocations.length > 0 && (
        // Point de vente : 3 tuiles (2 + 1 sur mobile, la dernière sur toute la ligne)
        <KpiGrid cols={{ base: 2, lg: isPosAccount ? 3 : 4 }}>
          <StatTile label="Tickets alloués" value={formatNumber(totalNetTickets)} icon={Ticket} accent="indigo" hint="Stock net confié aux points de vente" />
          <StatTile label="Valeur du stock" value={formatAmountShort(totalNetValeur)} icon={DollarSign} accent="amber" hint="Au prix de vente des tickets" />
          {!isPosAccount && (
            <StatTile
              label="Points de vente servis"
              value={formatNumber(uniquePosCount)}
              icon={Store}
              accent="blue"
              hint={uniquePosCount > 1 ? 'points de vente' : 'point de vente'}
            />
          )}
          <StatTile label="Mouvements" value={formatNumber(allocations.length)} icon={TrendingUp} accent="emerald" hint="Allocations et échanges" />
        </KpiGrid>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-3.5 bg-surface border-border">
        <div className="flex flex-col sm:flex-row gap-3">
          {!isPosAccount && (
          <div className="flex-1">
            <CustomSelect
              label="Filtrer par Point de Vente"
              value={selectedPosId}
              onChange={(val) => setSelectedPosId(val)}
              options={[
                { value: 'all', label: 'Tous les points de vente' },
                ...posList.map((pos: PointOfSale) => ({
                  value: pos.id,
                  label: pos.nom,
                  sublabel: pos.ville ? `Ville : ${pos.ville}` : (pos.adresse ? pos.adresse : undefined),
                }))
              ]}
              placeholder="Tous les points de vente"
              title="Filtrer par Point de Vente"
              searchPlaceholder="Rechercher par nom ou ville..."
              leadingIcon={<Store className="w-4 h-4 text-success-soft-foreground" />}
            />
          </div>
          )}

          <div className="flex-1">
            <label className="block text-xs font-semibold text-muted mb-1">
              Rechercher
            </label>
            <Input
              placeholder="Rechercher par ticket, POS, utilisateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              rightElement={<Search className="w-4 h-4 text-muted" />}
              className="h-10 text-xs sm:text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Allocations Content */}
      {Object.keys(allocationsByPos).length === 0 ? (
        <Card className="text-center space-y-3 border-border py-8">
          <div className="w-14 h-14 rounded-xl bg-warning-soft text-warning-soft-foreground flex items-center justify-center mx-auto">
            <ArrowLeftRight className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Aucune allocation trouvée</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {selectedPosId === 'all' && !searchQuery
              ? "Aucune allocation n'a été effectuée pour le moment."
              : 'Aucun enregistrement ne correspond à vos critères de recherche.'}
          </p>
          {!isPosAccount && (
            <div className="pt-2">
              <AddButton what="une allocation" tour="add:allocation" href="/allocations/new" />
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
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
              <Card key={posId} className="p-0 overflow-hidden border-border">
                {/* POS Header */}
                <div className="p-3.5 sm:p-4 bg-surface-secondary">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-semibold text-foreground truncate">
                          {pos?.nom || 'Point de vente inconnu'}
                        </h3>
                        <p className="text-xs text-muted truncate">
                          {pos?.ville || ''} {pos?.adresse ? `• ${pos.adresse}` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge variant="neutral" className="text-xs px-2.5 py-0.5 shrink-0">
                      {posAllocations.length} op.
                    </Badge>
                  </div>
                </div>

                {/* Desktop Allocations Table (hidden on mobile, visible from md upwards) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-default text-muted font-semibold">
                      <tr>
                        <th className="px-4 py-3">Enregistré le</th>
                        <th className="px-4 py-3">Nature</th>
                        <th className="px-4 py-3">Type de Ticket</th>
                        <th className="px-4 py-3 text-right">Quantité</th>
                        <th className="px-4 py-3 text-right">Montant</th>
                        <th className="px-4 py-3">Alloué par</th>
                        <th className="px-4 py-3">Notes</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-separator font-medium">
                      {posAllocations.map((alloc: TicketAllocation) => {
                        const typeInfo = getAllocationTypeLabel(alloc);
                        const isReturn = alloc.type === 'exchange_return';
                        const isReceive = alloc.type === 'exchange_receive';
                        return (
                          <tr
                            key={alloc.id}
                            onClick={() => router.push(`/allocations/${alloc.id}`)}
                            className="hover:bg-surface-secondary transition cursor-pointer group"
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-muted">
                                <Calendar className="w-3.5 h-3.5 text-muted shrink-0" />
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
                                <Ticket className="w-3.5 h-3.5 text-success-soft-foreground shrink-0" />
                                <span className="font-semibold text-foreground">
                                  {getTicketTypeName(alloc.ticket_type_id)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`font-semibold ${
                                  isReturn
                                    ? 'text-danger '
                                    : isReceive
                                    ? 'text-success-soft-foreground '
                                    : 'text-foreground '
                                }`}
                              >
                                {isReturn ? `-${alloc.quantite}` : `+${alloc.quantite}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-foreground">
                              {formatCurrencyFCFA(alloc.quantite * getTicketTypePrix(alloc.ticket_type_id))}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-muted">
                                <User className="w-3.5 h-3.5 text-muted shrink-0" />
                                <span>{getAllocatorName(alloc.alloue_par)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {alloc.notes ? (
                                <div className="flex items-center gap-1.5 text-muted">
                                  <FileText className="w-3.5 h-3.5 text-muted shrink-0" />
                                  <span className="truncate max-w-[200px]">{alloc.notes}</span>
                                </div>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <ChevronRight className="w-4 h-4 text-muted group-hover:text-accent transition" />
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
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/allocations/${alloc.id}`)}
                        onKeyDown={(e) => e.key === 'Enter' && router.push(`/allocations/${alloc.id}`)}
                        className="p-3.5 rounded-2xl bg-surface border border-border space-y-2.5 shadow-xs cursor-pointer hover:border-accent/50 hover:shadow-sm transition active:scale-[0.99]"
                      >
                        {/* Header: Ticket Name + Nature Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-success-soft text-success-soft-foreground flex items-center justify-center shrink-0">
                              <Ticket className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs sm:text-sm text-foreground truncate">
                                {getTicketTypeName(alloc.ticket_type_id)}
                              </h4>
                              <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                                <Calendar className="w-3 h-3 text-muted shrink-0" />
                                <span>{formatDateFR(alloc.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant={isReturn ? 'danger' : isReceive ? 'success' : 'info'}
                            className="text-xs px-2 py-0.5 shrink-0"
                          >
                            {typeInfo.label}
                          </Badge>
                        </div>

                        {/* Inset Numbers: Quantité & Valeur */}
                        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-surface-secondary text-xs">
                          <div>
                            <span className="text-xs font-semibold text-muted block">
                              Quantité
                            </span>
                            <span
                              className={`text-sm font-semibold ${
                                isReturn
                                  ? 'text-danger '
                                  : isReceive
                                  ? 'text-success-soft-foreground '
                                  : 'text-foreground '
                              }`}
                            >
                              {isReturn ? `-${alloc.quantite}` : `+${alloc.quantite}`} tickets
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold text-muted block">
                              Valeur Totale
                            </span>
                            <span className="text-sm font-semibold text-warning-soft-foreground">
                              {formatCurrencyFCFA(totalPrice)}
                            </span>
                          </div>
                          <div className="col-span-2 pt-1 border-t border-border flex items-center justify-between text-xs text-muted">
                            <span className="flex items-center gap-1 truncate">
                              <User className="w-3 h-3 text-muted shrink-0" />
                              <span className="truncate">Par : {getAllocatorName(alloc.alloue_par)}</span>
                            </span>
                            <span className="font-medium shrink-0">{formatCurrencyFCFA(unitPrice)} / u</span>
                          </div>
                        </div>

                        {/* Notes if present */}
                        {alloc.notes && (
                          <p className="text-xs text-muted italic bg-surface-secondary p-2 rounded-xl">
                            &laquo; {alloc.notes} &raquo;
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* POS Footer Summary */}
                <div className="p-3 bg-surface-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                  <span className="text-muted font-medium">
                    Total pour ce POS :
                  </span>
                  <div className="flex items-center gap-3 font-semibold">
                    <span className="text-foreground">
                      {netPosTickets} tickets net
                    </span>
                    <span className="text-muted">•</span>
                    <span className="text-warning-soft-foreground">
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