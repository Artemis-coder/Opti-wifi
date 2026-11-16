'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  KeyRound,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button, buttonClassName } from '@/components/ui/Button';
import { WriteButton } from '@/components/ui/WriteButton';
import { Badge } from '@/components/ui/Badge';
import { EditPosModal } from '../edit-pos-modal';
import { ResetPosModal } from './reset-pos-modal';
import { formatAmountShort, formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { PointOfSale, Profile, TicketType, TicketAllocation, Collection, CollectionItem, WifiSpace } from '@/types/database';
import { isActiveProfile } from '@/lib/utils/profiles';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { cn } from '@/lib/utils/cn';
import { PosAccessCard } from '@/components/pos/PosAccessCard';
import type { PlanLimits } from '@/components/team/PlanLimitDialog';

interface AllocationSummary {
  ticketType: TicketType;
  alloue: number;
  vendu: number;
  restant: number;
  ca: number;
  ecarts: number;
}

export default function PosDetailPage() {
  // useSearchParams impose une frontière Suspense
  return (
    <Suspense fallback={null}>
      <PosDetailContent />
    </Suspense>
  );
}

function PosDetailContent() {
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
      setCollectors((colData || []).filter(isActiveProfile));

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

  // Onglets (administrateur) : détails du point de vente / accès du point de vente (?tab=acces)
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: 'details' | 'acces' = searchParams.get('tab') === 'acces' ? 'acces' : 'details';
  const selectTab = (value: 'details' | 'acces') =>
    router.replace(value === 'acces' ? `${pathname}?tab=acces` : pathname, { scroll: false });

  // Limites du forfait : l'accès point de vente n'est inclus qu'à partir de certains forfaits
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const loadPlanLimits = () =>
    fetch('/api/account/plan-limits')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => res?.data && setPlanLimits(res.data as PlanLimits))
      .catch(() => {});
  useEffect(() => {
    if (isAdmin) loadPlanLimits();
  }, [isAdmin]);

  // Accès en consultation seule du point de vente (un seul compte non supprimé)
  const posAccount =
    profiles.find((p: Profile) => p.role === 'point_de_vente' && p.pos_id === posId && !p.deleted_at) ?? null;
  const handlePosAccountChanged = (account: Profile | null) => {
    loadPlanLimits();
    setProfiles((prev) => {
      const others = prev.filter((p) => !(p.role === 'point_de_vente' && p.pos_id === posId));
      return account ? [account, ...others] : others;
    });
  };

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
      <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        Chargement du point de vente...
      </div>
    );
  }

  if (!pos) {
    return (
      <Card className="text-center space-y-3 py-8">
        <Info className="w-10 h-10 text-muted mx-auto" />
        <h3 className="text-base font-semibold text-foreground">Point de vente introuvable</h3>
        <p className="text-xs text-muted">Le point de vente demandé n&apos;existe pas ou a été supprimé.</p>
        <Link href="/pos" className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
            Retour aux points de vente
          </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/pos" aria-label="Retour aux points de vente" className={buttonClassName({ variant: 'ghost', size: 'sm', className: 'shrink-0 px-2.5' })}>
            <ArrowLeft className="size-4" /> <span className="hidden xs:inline">Retour</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2 min-w-0 truncate">
            <Store className="w-5 h-5 sm:w-6 sm:h-6 text-muted shrink-0" />
            <span className="truncate">{pos.nom}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {isAdmin && (
            <WriteButton
              variant="outline"
              size="sm"
              onClick={() => setIsResetModalOpen(true)}
              className="flex-1 sm:flex-initial text-danger border-danger/30 hover:bg-danger-soft hover:text-danger"
              title="Vider les données de ce POS"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Vider</span>
            </WriteButton>
          )}
          {isAdmin ? (
            <WriteButton
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="flex-1 sm:flex-initial"
            >
              <Edit className="w-4 h-4 shrink-0" /> <span>Modifier</span>
            </WriteButton>
          ) : (
            pos.statut === 'actif' && (
              <Link
                href={`/collections/new?pos=${pos.id}`}
                className={buttonClassName({ size: 'sm', className: 'flex-1 sm:flex-initial' })}
              >
                <Receipt className="w-4 h-4 shrink-0" /> <span>Collecter</span>
              </Link>
            )
          )}
        </div>
      </div>

      {isAdmin && (
        <div role="tablist" aria-label="Rubriques du point de vente" className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
          {(
            [
              { value: 'details', label: 'Détails du point de vente', icon: Store },
              { value: 'acces', label: 'Accès point de vente', icon: KeyRound },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(t.value)}
                className={cn(
                  'shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold border transition',
                  active
                    ? 'bg-foreground text-background border-border'
                    : 'bg-surface text-muted border-border hover:border-border',
                )}
              >
                <Icon className="w-4 h-4" /> {t.label}
                {t.value === 'acces' && posAccount && (
                  <span className={cn('w-2 h-2 rounded-full', posAccount.is_active === false ? 'bg-muted' : 'bg-success')} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {isAdmin && tab === 'acces' && (
        <PosAccessCard pos={pos} account={posAccount} onChanged={handlePosAccountChanged} limits={planLimits} />
      )}

      {(!isAdmin || tab === 'details') && (
      <>
      {/* POS Info Card */}
      <Card className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-accent-soft text-accent">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{pos.nom}</h2>
              <div className="flex items-center gap-1 text-sm text-muted mt-1">
                <MapPin className="w-4 h-4" />
                <span>{pos.adresse || pos.ville}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted mt-0.5">
                <MapPin className="w-4 h-4" />
                <span>{pos.ville}</span>
              </div>
            </div>
          </div>
          <Badge variant={pos.statut === 'actif' ? 'success' : pos.statut === 'suspendu' ? 'danger' : 'neutral'}>
            {pos.statut}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <UserCheck className="w-4 h-4 text-muted" />
            <span className="text-muted">Collecteur :</span>
            <strong className="text-foreground">
              {pos.collecteur?.nom || 'Non attribué'}
            </strong>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted" />
            <span className="text-muted">Créé le :</span>
            <span className="text-foreground">{formatDateFR(pos.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm md:col-span-2">
            <MapPin className="w-4 h-4 text-warning-soft-foreground" />
            <span className="text-muted">Espace Wi-Fi :</span>
            {pos.space_id ? (
              isAdmin ? (
                <Link href="/spaces" className="font-semibold text-warning-soft-foreground hover:text-warning-soft-foreground hover:underline">
                  {pos.space?.nom || spaces.find((s: WifiSpace) => s.id === pos.space_id)?.nom || 'Espace inconnu'}
                </Link>
              ) : (
                <strong className="text-foreground">
                  {pos.space?.nom || spaces.find((s: WifiSpace) => s.id === pos.space_id)?.nom || 'Espace inconnu'}
                </strong>
              )
            ) : (
              <strong className="text-muted italic">Non rattaché à un espace</strong>
            )}
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <KpiGrid cols={{ base: 2, sm: 3, xl: 5 }}>
        <StatTile
          label="Tickets Alloués"
          value={totalAlloue}
          icon={Package}
          accent="amber"
          hint="Stock total alloué à ce POS"
        />

        <StatTile
          label="Tickets Vendus"
          value={totalVendu}
          icon={ShoppingCart}
          accent="indigo"
          hint="Nombre total de pass écoulés"
        />

        <StatTile
          label="Tickets Restants"
          value={totalRestant}
          icon={Package}
          accent="emerald"
          hint="Stock non encore vendu"
        />

        <StatTile
          label="Chiffre d'Affaires"
          value={formatAmountShort(totalCA)}
          icon={BarChart3}
          accent="amber"
          hint="CA total depuis les collectes"
        />

        <StatTile
          label="Commission Totale"
          value={formatAmountShort(totalCommission)}
          icon={Receipt}
          accent="amber"
          hint="Total commissions versées"
        />
      </KpiGrid>

      {/* Allocation Summary Table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Package className="w-5 h-5 text-warning-soft-foreground" />
            Suivi des Allocations de Tickets
          </h2>
          {allocationSummary.length > 0 && (
            <span className="text-xs text-muted font-medium">
              {allocationSummary.length} {allocationSummary.length > 1 ? 'types' : 'type'}
            </span>
          )}
        </div>

        {allocationSummary.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Package className="w-10 h-10 text-muted mx-auto" />
            <h3 className="text-base font-semibold text-foreground">Aucune allocation pour ce POS</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Aucun ticket n&apos;a été alloué à ce point de vente.
            </p>
            <Link href={`/allocations/new?pos=${pos.id}`} className={buttonClassName({ variant: 'secondary', size: 'sm', className: 'gap-2 font-semibold' })}>
                <Package className="w-4 h-4" /> Allouer des Tickets
              </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-default text-muted font-semibold">
                  <tr>
                    <th className="px-4 py-3">Type de Ticket</th>
                    <th className="px-4 py-3 text-right">Alloués</th>
                    <th className="px-4 py-3 text-right">Vendus</th>
                    <th className="px-4 py-3 text-right">Restants</th>
                    <th className="px-4 py-3 text-right">CA (FCFA)</th>
                    <th className="px-4 py-3 text-right">Écarts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator font-medium">
                  {allocationSummary.map((s: AllocationSummary) => (
                    <tr key={s.ticketType.id} className="hover:bg-surface-secondary transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-success-soft-foreground">
                            <Ticket className="w-4 h-4" />
                          </span>
                          <span className="font-semibold text-foreground">{s.ticketType.nom}</span>
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          {formatCurrencyFCFA(s.ticketType.prix)} / unité
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">{s.alloue}</td>
                      <td className="px-4 py-3 text-right text-foreground">{s.vendu}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`${s.restant > 0 ? 'text-success-soft-foreground' : s.restant < 0 ? 'text-danger' : 'text-muted'}`}>
                          {s.restant > 0 ? s.restant : '0'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {formatCurrencyFCFA(s.ca)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.ecarts === 0 ? (
                          <span className="text-success-soft-foreground flex items-center justify-end gap-1">
                            <Info className="w-3.5 h-3.5" /> Conforme
                          </span>
                        ) : (
                          <span className={s.ecarts < 0 ? 'text-danger' : 'text-success-soft-foreground'}>
                            {formatCurrencyFCFA(s.ecarts)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="px-4 py-3 text-foreground">Totaux</td>
                    <td className="px-4 py-3 text-right text-foreground">{totalAlloue}</td>
                    <td className="px-4 py-3 text-right text-foreground">{totalVendu}</td>
                    <td className="px-4 py-3 text-right text-foreground">{totalRestant}</td>
                    <td className="px-4 py-3 text-right text-warning-soft-foreground">{formatCurrencyFCFA(totalCA)}</td>
                    <td className="px-4 py-3 text-right">
                      {totalEcarts === 0 ? (
                        <span className="text-success-soft-foreground">Conforme</span>
                      ) : (
                        <span className={totalEcarts < 0 ? 'text-danger' : 'text-success-soft-foreground'}>
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
                  className="p-3.5 rounded-2xl bg-surface-secondary/80 space-y-3 shadow-xs"
                >
                  {/* Header: Ticket Name + Price + Conforme badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-warning-soft text-warning-soft-foreground flex items-center justify-center shrink-0">
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-foreground truncate">
                          {s.ticketType.nom}
                        </h4>
                        <span className="text-xs text-muted">
                          {formatCurrencyFCFA(s.ticketType.prix)} / ticket
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {s.ecarts === 0 ? (
                        <Badge variant="success" className="text-xs px-2 py-0.5">
                          ✓ Conforme
                        </Badge>
                      ) : (
                        <Badge variant={s.ecarts < 0 ? 'danger' : 'success'} className="text-xs px-2 py-0.5">
                          {formatCurrencyFCFA(s.ecarts)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 3-column Counters: Alloués / Vendus / Restants */}
                  <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-surface border border-border text-center">
                    <div className="py-1">
                      <span className="block text-xs font-semibold text-muted">Alloués</span>
                      <span className="text-sm font-semibold text-foreground mt-0.5 block">{s.alloue}</span>
                    </div>
                    <div className="py-1 border-x border-border">
                      <span className="block text-xs font-semibold text-muted">Vendus</span>
                      <span className="text-sm font-semibold text-accent mt-0.5 block">{s.vendu}</span>
                    </div>
                    <div className="py-1">
                      <span className="block text-xs font-semibold text-muted">Restants</span>
                      <span className={`text-sm font-semibold mt-0.5 block ${s.restant > 0 ? 'text-success-soft-foreground ' : s.restant < 0 ? 'text-danger ' : 'text-muted'}`}>
                        {s.restant > 0 ? s.restant : '0'}
                      </span>
                    </div>
                  </div>

                  {/* Footer: CA */}
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
                    <span className="text-muted font-medium">CA théorique</span>
                    <span className="font-semibold text-warning-soft-foreground text-sm">
                      {formatCurrencyFCFA(s.ca)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Totaux Mobile Card */}
              <div className="p-3.5 rounded-xl bg-warning-soft space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-warning-soft-foreground">
                    Totaux consolidés
                  </span>
                  <span className="text-sm font-semibold text-warning-soft-foreground">
                    {formatCurrencyFCFA(totalCA)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-warning/30">
                  <div>
                    <span className="text-xs text-muted block font-medium">Total Alloué</span>
                    <strong className="text-foreground font-semibold text-sm">{totalAlloue}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-muted block font-medium">Total Vendu</span>
                    <strong className="text-accent font-semibold text-sm">{totalVendu}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-muted block font-medium">Total Restant</span>
                    <strong className="text-success-soft-foreground font-semibold text-sm">{totalRestant}</strong>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Allocation History */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning-soft-foreground" />
            Historique des Allocations
          </h2>
          {allocations.length > 0 && (
            <span className="text-xs text-muted font-medium">
              {allocations.length} {allocations.length > 1 ? 'entrées' : 'entrée'}
            </span>
          )}
        </div>

        {allocations.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Clock className="w-10 h-10 text-muted mx-auto" />
            <h3 className="text-base font-semibold text-foreground">Aucune allocation enregistrée</h3>
            <p className="text-xs text-muted">
              Aucune allocation de tickets n&apos;a été effectuée pour ce point de vente.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-default text-muted font-semibold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type de Ticket</th>
                    <th className="px-4 py-3 text-right">Quantité</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3">Alloué par</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator font-medium">
                  {allocations.map((a: TicketAllocation) => (
                    <tr key={a.id} className="hover:bg-surface-secondary transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-muted" />
                          {formatDateFR(a.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Ticket className="w-3.5 h-3.5 text-success-soft-foreground" />
                          {getTicketTypeName(a.ticket_type_id)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">{a.quantite}</td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {formatCurrencyFCFA(a.quantite * getTicketTypePrix(a.ticket_type_id))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-muted" />
                          {getAllocatorName(a.alloue_par)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{a.notes || '—'}</td>
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
                    className="p-3.5 rounded-2xl bg-surface-secondary/80 space-y-2.5 shadow-xs"
                  >
                    {/* Top: Ticket Name + Type Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isExchangeReturn
                              ? 'bg-warning-soft text-warning-soft-foreground '
                              : isExchangeReceive
                              ? 'bg-accent-soft text-accent '
                              : 'bg-success-soft text-success-soft-foreground '
                          }`}
                        >
                          <Ticket className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm text-foreground truncate">
                            {getTicketTypeName(a.ticket_type_id)}
                          </h4>
                          <div className="flex items-center gap-1 text-xs text-muted mt-0.5">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{formatDateFR(a.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={isExchangeReturn ? 'warning' : isExchangeReceive ? 'info' : 'success'}
                        className="text-xs px-2 py-0.5 shrink-0"
                      >
                        {isExchangeReturn ? 'Retour' : isExchangeReceive ? 'Échange' : 'Allocation'}
                      </Badge>
                    </div>

                    {/* Stock & Value Card */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-surface border border-border">
                      <div>
                        <span className="text-xs font-semibold text-muted block">
                          Quantité
                        </span>
                        <span className={`text-sm font-semibold ${isExchangeReturn ? 'text-warning-soft-foreground ' : 'text-foreground '}`}>
                          {isExchangeReturn ? `-${a.quantite}` : `+${a.quantite}`}{' '}
                          <span className="text-xs font-normal text-muted">tickets</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-muted block">
                          Valeur Stock
                        </span>
                        <span className="text-sm font-semibold text-warning-soft-foreground">
                          {formatCurrencyFCFA(totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Alloué par & Notes */}
                    <div className="space-y-1 text-xs pt-1.5 border-t border-border">
                      <div className="flex items-center justify-between text-muted text-xs">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-muted" /> Alloué par :
                        </span>
                        <strong className="text-foreground font-semibold">
                          {getAllocatorName(a.alloue_par)}
                        </strong>
                      </div>
                      {a.notes && (
                        <p className="text-xs text-muted bg-default px-2 py-1 rounded-xl italic mt-1">
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
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Receipt className="w-5 h-5 text-accent" />
            Historique des Collectes
          </h2>
          {collections.length > 0 && (
            <span className="text-xs text-muted font-medium">
              {collections.length} {collections.length > 1 ? 'collectes' : 'collecte'}
            </span>
          )}
        </div>

        {collections.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Receipt className="w-10 h-10 text-muted mx-auto" />
            <h3 className="text-base font-semibold text-foreground">Aucune collecte enregistrée</h3>
            <p className="text-xs text-muted">
              Aucune collecte de caisse n&apos;a été effectuée pour ce point de vente.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-default text-muted font-semibold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Montant Attendu</th>
                    <th className="px-4 py-3">Montant Encaissé</th>
                    <th className="px-4 py-3">Écart</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator font-medium">
                  {collections.map((c: Collection) => (
                    <tr key={c.id} className="hover:bg-surface-secondary transition">
                      <td className="px-4 py-3 text-muted">
                        {formatDateFR(c.created_at)}
                      </td>
                      <td className="px-4 py-3 text-muted">{formatCurrencyFCFA(Number(c.montant_attendu))}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {formatCurrencyFCFA(Number(c.montant_collecte))}
                      </td>
                      <td className="px-4 py-3">
                        {Number(c.difference) === 0 ? (
                          <span className="text-success-soft-foreground font-semibold flex items-center gap-1">Conforme</span>
                        ) : (
                          <span className={Number(c.difference) < 0 ? 'text-danger' : 'text-success-soft-foreground'}>
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
                  className="p-3.5 rounded-2xl bg-surface-secondary/80 space-y-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Clock className="w-3.5 h-3.5 text-muted" />
                      <span className="font-semibold text-foreground">{formatDateFR(c.created_at)}</span>
                    </div>
                    <Badge variant={c.statut === 'validee' ? 'success' : c.statut === 'annulee' ? 'danger' : 'warning'} className="text-xs px-2 py-0.5">
                      {c.statut === 'validee' ? 'Validée' : c.statut === 'annulee' ? 'Annulée' : 'Brouillon'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-surface border border-border">
                    <div>
                      <span className="text-xs font-semibold text-muted block">Attendu</span>
                      <span className="text-xs font-semibold text-muted">
                        {formatCurrencyFCFA(Number(c.montant_attendu))}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-muted block">Encaissé</span>
                      <span className="text-sm font-semibold text-success-soft-foreground">
                        {formatCurrencyFCFA(Number(c.montant_collecte))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
                    <span className="text-muted text-xs">Écart de caisse</span>
                    {Number(c.difference) === 0 ? (
                      <span className="text-success-soft-foreground font-semibold text-xs flex items-center gap-1">✓ Conforme</span>
                    ) : (
                      <span className={`font-semibold text-xs ${Number(c.difference) < 0 ? 'text-danger' : 'text-success-soft-foreground'}`}>
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
      <Card>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-success-soft-foreground" />
          Synthèse Financière
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-4 bg-surface-secondary rounded-xl text-center">
            <p className="text-xs font-semibold text-muted">Montant Attendu</p>
            <p className="text-xl font-semibold text-foreground mt-1">
              {formatCurrencyFCFA(totalExpected)}
            </p>
          </div>
          <div className="p-4 bg-surface-secondary rounded-xl text-center">
            <p className="text-xs font-semibold text-muted">Montant Encaissé</p>
            <p className="text-xl font-semibold text-success-soft-foreground mt-1">
              {formatCurrencyFCFA(totalCollected)}
            </p>
          </div>
          <div className="p-4 bg-surface-secondary rounded-xl text-center">
            <p className="text-xs font-semibold text-muted">Écart Global</p>
            <p className={`text-xl font-semibold mt-1 ${
              totalDifference === 0
                ? 'text-success-soft-foreground'
                : totalDifference < 0
                ? 'text-danger'
                : 'text-success-soft-foreground'
            }`}>
              {formatCurrencyFCFA(totalDifference)}
            </p>
          </div>
        </div>
      </Card>

      </>
      )}

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
