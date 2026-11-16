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
import { Button, buttonClassName } from '@/components/ui/Button';
import { WriteButton } from '@/components/ui/WriteButton';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { formatAmountShort, formatCurrencyFCFA, formatDateFR, formatNumber } from '@/lib/utils/format';
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
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';

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
      spaceCollections.forEach((c: Collection) => {
        if (c.items) {
          if (Array.isArray(c.items)) {
            spaceItems.push(...c.items);
          } else if (typeof c.items === 'object') {
            spaceItems.push(c.items as CollectionItem);
          }
        }
      });

      const soldTotal = spaceItems.reduce(
        (acc: number, curr: CollectionItem) => acc + (curr.quantite_vendue || 0),
        0
      );
      setTicketsSoldTotal(soldTotal);

      let totalExpected = 0;
      let totalCollected = 0;
      let totalDiff = 0;
      spaceCollections.forEach((c: Collection) => {
        totalExpected += Number(c.montant_attendu || 0);
        totalCollected += Number(c.montant_collecte || 0);
        totalDiff += Number(c.difference || 0);
      });
      setChiffreAffairesTotal(totalExpected);
      setMontantCollecteTotal(totalCollected);
      setEcartTotal(totalDiff);

      const totalAllocated = spaceAllocations.reduce(
        (acc: number, curr: TicketAllocation) => acc + (curr.quantite || 0),
        0
      );
      setTicketsAllouesTotal(totalAllocated);

      const commissionTotal = spaceCollections.reduce(
        (acc: number, curr: Collection) => acc + Number(curr.commission || 0),
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
    if (!(await confirmAction(message, { title: 'Supprimer l’espace', confirmLabel: 'Supprimer' }))) return;

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
      setUnlinkedPos((prev) => prev.filter((p: PointOfSale) => p.id !== posId));
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
      const pos = linkedPos.find((p: PointOfSale) => p.id === posId);
      if (pos) {
        const updatedPos = { ...pos, space_id: undefined };
        setLinkedPos((prev) => prev.filter((p: PointOfSale) => p.id !== posId));
        setUnlinkedPos((prev) => [...prev, updatedPos]);
      }
      toast.success('POS détaché de l\'espace');
    } else {
      toast.error('Erreur lors du détachement du POS');
    }
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        Chargement du tableau de bord...
      </div>
    );
  }

  if (!space) {
    return (
      <Card className="text-center space-y-3 py-8">
        <Info className="w-10 h-10 text-muted mx-auto" />
        <h3 className="text-base font-semibold text-foreground">
          Espace introuvable
        </h3>
        <p className="text-xs text-muted">
          L'espace demandé n'existe pas ou a été supprimé.
        </p>
        <Link href="/spaces" className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
            Retour aux espaces
          </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* En-tête de page */}
      <div className="space-y-3">
        <Link href="/spaces" className={buttonClassName({ variant: 'ghost', size: 'sm', className: '-ml-3' })}>
          <ArrowLeft className="size-4" /> Retour aux espaces
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 break-words text-2xl font-semibold tracking-tight text-foreground">
              <MapPin className="size-6 shrink-0 text-muted" />
              {space.nom}
            </h1>
            {space.description && <p className="mt-1 text-sm text-muted">{space.description}</p>}
            {(space.adresse || space.ville) && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                <MapPin className="size-3.5 shrink-0" />
                <span>{[space.adresse, space.ville].filter(Boolean).join(', ')}</span>
              </p>
            )}
          </div>
          {user?.role === 'administrateur' && (
            <div className="flex flex-wrap gap-2">
              <WriteButton size="sm" onClick={() => setIsEditModalOpen(true)}>
                <Edit className="size-4" /> Modifier
              </WriteButton>
              <WriteButton size="sm" variant="danger-soft" onClick={handleDeleteSpace}>
                <Trash2 className="size-4" /> Supprimer
              </WriteButton>
            </div>
          )}
        </div>
      </div>

{/* Linked POS Summary */}
       <Card>
         <div className="flex items-center justify-between">
           <PosSummary
             linkedPosCount={linkedPos.length}
             activePosCount={linkedPos.filter((p: PointOfSale) => p.statut === 'actif').length}
           />
           {user?.role === 'administrateur' && (
             <Button
               variant="ghost"
               size="sm"
               onClick={() => setManagePosSpaceId(spaceId)}
               className="gap-1 text-xs font-semibold text-accent"
             >
               <Link2 className="w-3.5 h-3.5" />
               Gérer les POS
             </Button>
           )}
         </div>
       </Card>

      {/* KPI Cards Grid */}
      <KpiGrid cols={{ base: 2, sm: 3, xl: 6 }}>
        {/* Tickets Alloués */}
        <StatTile
          label="Tickets Alloués"
          value={formatNumber(ticketsAllouesTotal)}
          icon={Package}
          accent="purple"
          hint="Stock distribué aux POS de cet espace"
        />

        {/* Tickets Vendus */}
        <StatTile
          label="Tickets Vendus"
          value={formatNumber(ticketsSoldTotal)}
          icon={Ticket}
          accent="amber"
          hint="Nombre total de pass écoulés"
        />

        {/* Chiffre d'Affaires */}
        <StatTile
          label="Chiffre d'Affaires"
          value={formatAmountShort(chiffreAffairesTotal)}
          icon={Banknote}
          accent="indigo"
          hint="Montant théorique attendu"
        />

         {/* Montant Encaissé */}
          <StatTile
            label="Total Encaissé"
            value={formatAmountShort(montantCollecteTotal)}
            icon={Receipt}
            accent="emerald"
            hint="Total espèces perçues"
          />

          {/* Commission Versée */}
          <StatTile
            label="Commission Versée"
            value={formatAmountShort(totalCommission)}
            icon={Receipt}
            accent="slate"
            hint="Total commissions aux POS de l&apos;espace"
          />

          {/* Écart / Différence */}
          <StatTile
            label="Écart / Différence"
            value={formatAmountShort(ecartTotal)}
            icon={ArrowDownRight}
            accent="emerald"
            alert={ecartTotal < 0}
            hint="Écart entre attendu et encaissé"
          />
       </KpiGrid>

      {/* Main Content Grid: Raccourcis & Recent Encaissements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Left Column: Raccourcis Métier */}
        <div className="lg:col-span-1 space-y-4 max-w-[405px]">
          <h2 className="text-lg font-semibold text-foreground">
            Raccourcis Métier (Espace)
          </h2>

          <Card className="grid grid-cols-1 gap-3">
            {user?.role === 'administrateur' && (
              <Link
                href="/allocations/new"
                className="flex items-center justify-between p-3 rounded-xl bg-accent-soft hover:scale-[1.01] transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-accent text-accent-foreground">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Allouer des Tickets</p>
                    <p className="text-xs text-muted">Distribuer du stock aux POS</p>
                  </div>
                </div>
                <span className="text-accent font-semibold">→</span>
              </Link>
            )}

            <Link
              href="/collections/new"
              className="flex items-center justify-between p-3 rounded-xl bg-warning-soft hover:scale-[1.01] transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-warning text-foreground">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Nouvelle Collecte</p>
                  <p className="text-xs text-muted">Saisir un encaissement de caisse</p>
                </div>
              </div>
              <span className="text-warning-soft-foreground font-semibold">→</span>
            </Link>

            <Link
              href="/pos"
              className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary hover:scale-[1.01] transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-accent text-accent-foreground">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Points de Vente</p>
                  <p className="text-xs text-muted">Gérer le réseau de distribution</p>
                </div>
              </div>
              <span className="text-muted font-semibold">→</span>
            </Link>

            <Link
              href="/tickets"
              className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary hover:scale-[1.01] transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success text-success-foreground">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Types de Tickets</p>
                  <p className="text-xs text-muted">Consulter et modifier les tarifs</p>
                </div>
              </div>
              <span className="text-muted font-semibold">→</span>
            </Link>
          </Card>
        </div>

        {/* Right Column: Derniers Encaissements */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Derniers Encaissements (Espace)
            </h2>
            <Link
              href="/collections"
              className="text-xs font-semibold text-warning-soft-foreground hover:text-warning-soft-foreground"
            >
              Voir tout →
            </Link>
          </div>

          {loading ? (
            <Card className="text-center text-muted py-8">
              <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
              <p className="text-xs font-medium mt-2">Chargement des encaissements...</p>
            </Card>
          ) : recentCollections.length === 0 ? (
            <Card className="text-center space-y-3 py-8">
              <div className="w-12 h-12 rounded-full bg-default text-muted flex items-center justify-center mx-auto">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Aucun encaissement enregistré</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Aucune collecte n'a été effectuée pour les points de vente rattachés à cet espace.
              </p>
              <div className="pt-2">
                <Link href="/collections/new" className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
                  <PlusCircle className="size-4" /> Effectuer une collecte
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <ResponsiveTable>
                <table className="w-full text-left text-xs">
                  <thead className="bg-default text-muted font-semibold">
                    <tr>
                      <th className="px-4 py-3">Point de Vente</th>
                      <th className="px-4 py-3">Collecteur</th>
                      <th className="px-4 py-3">Montant Encaissé</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-separator font-medium">
                    {recentCollections.map((col: Collection) => (
                      <tr key={col.id} className="hover:bg-surface-secondary transition">
                        <td className="px-4 py-3 font-semibold text-foreground">{col.pos?.nom || 'POS'}</td>
                        <td className="px-4 py-3 text-muted">{col.collecteur?.nom || 'Collecteur'}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">{formatCurrencyFCFA(col.montant_collecte)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={col.statut === 'validee' ? 'success' : 'warning'}>
                            {col.statut === 'validee' ? 'Validée' : 'Brouillon'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDateFR(col.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTable>
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
                <h2 className="text-lg font-semibold text-foreground">
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
                <h3 className="text-sm font-semibold text-muted">
                  POS liés à cet espace ({linkedPos.length})
                </h3>
                {linkedPos.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">
                    Aucun POS n'est rattaché à cet espace.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {linkedPos.map((p: PointOfSale) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 bg-surface-secondary rounded-xl"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Store className="w-4 h-4 text-success-soft-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {p.nom}
                            </p>
                            <p className="text-xs text-muted truncate">
                              {p.ville}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkPos(p.id)}
                          className="gap-1 text-xs text-danger hover:text-danger"
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
                <h3 className="text-sm font-semibold text-muted">
                  POS disponibles ({unlinkedPos.length})
                </h3>
                {unlinkedPos.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">
                    Tous les POS sont déjà rattachés à un espace.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {unlinkedPos.map((p: PointOfSale) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Store className="w-4 h-4 text-accent shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {p.nom}
                            </p>
                            <p className="text-xs text-muted truncate">
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
              <h2 className="text-lg font-semibold text-foreground">
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
                  <label className="block text-xs font-semibold text-foreground">
                    Nom de l'espace *
                  </label>
                  <input
                    name="nom"
                    defaultValue={space.nom}
                    required
                    className="w-full h-10 px-3 bg-surface border border-border rounded-field text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Description
                  </label>
                  <input
                    name="description"
                    defaultValue={space.description || ''}
                    className="w-full h-10 px-3 bg-surface border border-border rounded-field text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Adresse
                  </label>
                  <input
                    name="adresse"
                    defaultValue={space.adresse || ''}
                    className="w-full h-10 px-3 bg-surface border border-border rounded-field text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Ville
                  </label>
                  <input
                    name="ville"
                    defaultValue={space.ville || ''}
                    className="w-full h-10 px-3 bg-surface border border-border rounded-field text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Statut
                  </label>
                  <StatusField name="statut" defaultValue={space.statut} />
                </div>
                <div className="flex gap-3 pt-2 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:w-full">
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

/** Statut de l'espace dans le formulaire de modification (valeur envoyée via un champ caché). */
function StatusField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <CustomSelect
        value={value}
        onChange={setValue}
        options={[
          { value: 'actif', label: 'Actif' },
          { value: 'inactif', label: 'Inactif' },
          { value: 'suspendu', label: 'Suspendu' },
        ]}
      />
    </>
  );
}
