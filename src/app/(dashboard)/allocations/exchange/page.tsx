'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Package,
  Ticket,
  TrendingUp,
  TrendingDown,
  Info,
  Receipt,
  Plus,
  Trash2,
  Store,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { toast } from 'sonner';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { PointOfSale, TicketType, TicketAllocation, Collection, CollectionItem } from '@/types/database';

interface ExchangeItem {
  ticketTypeId: string;
  quantite: number;
}

interface TicketStockInfo {
  ticketType: TicketType;
  alloue: number;
  vendu: number;
  restant: number;
  prix_unitaire: number;
}

export default function ExchangePage() {
  const router = useRouter();
  const { currentSpaceId } = useSpaceStore();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [posStockInfo, setPosStockInfo] = useState<Record<string, TicketStockInfo>>({});
  const [loadingStock, setLoadingStock] = useState(false);

  const [posId, setPosId] = useState('');
  const [returns, setReturns] = useState<ExchangeItem[]>([]);
  const [receives, setReceives] = useState<ExchangeItem[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function loadOptions() {
      setLoading(true);
      let query = supabase.from('points_of_sale').select('*');
      if (currentSpaceId) {
        query = query.eq('space_id', currentSpaceId);
      }
      const { data: posData } = await query;
      if (posData && posData.length > 0) {
        setPosList(posData);
        setPosId(posData[0].id);
      }

      const { data: ticketData } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('actif', true)
        .order('prix', { ascending: true });
      if (ticketData) setTicketTypes(ticketData);

      setLoading(false);
    }
    loadOptions();
  }, [supabase, currentSpaceId]);

  const handlePosChange = (newPosId: string) => {
    setPosId(newPosId);
    setReturns([]);
    setReceives([]);
    setPosStockInfo({});
  };

  useEffect(() => {
    async function loadStock() {
      if (!posId) return;
      setLoadingStock(true);

      let allocQuery = supabase
        .from('ticket_allocations')
        .select('*, ticket_type:ticket_types(*)')
        .eq('pos_id', posId);

      let collectionsQuery = supabase
        .from('collections')
        .select('*, items:collection_items(*)')
        .eq('pos_id', posId);

      if (currentSpaceId) {
        allocQuery = allocQuery.or(`space_id.eq.${currentSpaceId},space_id.is.null`);
        collectionsQuery = collectionsQuery.or(`space_id.eq.${currentSpaceId},space_id.is.null`);
      }

      const { data: allocData } = await allocQuery;

      const stockMap: Record<string, TicketStockInfo> = {};

      if (allocData) {
        const ticketMap: Record<string, TicketType> = {};
        const allocatedMap: Record<string, number> = {};

        allocData.forEach((alloc: TicketAllocation) => {
          const typeId = alloc.ticket_type_id;
          const baseQty = alloc.type === 'exchange_return' ? -alloc.quantite : alloc.quantite;
          allocatedMap[typeId] = (allocatedMap[typeId] || 0) + baseQty;
          if (alloc.ticket_type) {
            ticketMap[typeId] = alloc.ticket_type;
          }
        });

        const { data: collectionsData } = await collectionsQuery;

        const soldMap: Record<string, number> = {};
        if (collectionsData) {
          collectionsData.forEach((c: Collection) => {
            const items = Array.isArray(c.items) ? c.items : c.items ? [c.items] : [];
            items.forEach((item: CollectionItem) => {
              soldMap[item.ticket_type_id] = (soldMap[item.ticket_type_id] || 0) + item.quantite_vendue;
            });
          });
        }

        Object.entries(allocatedMap).forEach(([typeId, allocQty]) => {
          const ticket = ticketMap[typeId];
          if (!ticket) return;
          const vendu = soldMap[typeId] || 0;
          const restant = allocQty - vendu;
          stockMap[typeId] = {
            ticketType: ticket,
            alloue: allocQty,
            vendu: vendu,
            restant: Math.max(0, restant),
            prix_unitaire: Number(ticket.prix),
          };
        });
      }

      setPosStockInfo(stockMap);
      setLoadingStock(false);
    }
    loadStock();
  }, [posId, currentSpaceId, supabase]);

  const getTicketTypeById = (id: string) => ticketTypes.find((t: TicketType) => t.id === id);

  const getTicketTypePrix = (ticketTypeId: string) => {
    const ticket = getTicketTypeById(ticketTypeId);
    return ticket ? Number(ticket.prix) : 0;
  };

  const totalReturnedValue = returns.reduce((sum: number, r: ExchangeItem) => {
    return sum + r.quantite * getTicketTypePrix(r.ticketTypeId);
  }, 0);

  const totalReceivedValue = receives.reduce((sum: number, r: ExchangeItem) => {
    return sum + r.quantite * getTicketTypePrix(r.ticketTypeId);
  }, 0);

  const valueDifference = totalReceivedValue - totalReturnedValue;
  const isExchangeBalanced = totalReturnedValue > 0 && valueDifference === 0;

  const updateReturn = (index: number, field: keyof ExchangeItem, value: string | number) => {
    const updated = [...returns];
    updated[index] = { ...updated[index], [field]: value };
    setReturns(updated);
  };

  const addReceiveLine = () => {
    setReceives([...receives, { ticketTypeId: '', quantite: 0 }]);
  };

  const removeReceiveLine = (index: number) => {
    setReceives(receives.filter((_, i) => i !== index));
  };

  const updateReceive = (index: number, field: keyof ExchangeItem, value: string | number) => {
    const updated = [...receives];
    updated[index] = { ...updated[index], [field]: value };
    setReceives(updated);
  };

  const autoCalculateReceive = (ticketTypeId: string) => {
    const ticket = getTicketTypeById(ticketTypeId);
    if (!ticket || ticket.prix <= 0 || totalReturnedValue <= 0) return 0;
    return Math.floor(totalReturnedValue / Number(ticket.prix));
  };

  const handleAutoFillAll = () => {
    if (totalReturnedValue <= 0 || receives.length === 0) return;
    const remaining = totalReturnedValue;
    const newReceives = [...receives];
    let remainingValue = remaining;

    for (let i = 0; i < newReceives.length; i++) {
      const ticket = getTicketTypeById(newReceives[i].ticketTypeId);
      if (!ticket || ticket.prix <= 0) continue;
      const qty = Math.floor(remainingValue / Number(ticket.prix));
      newReceives[i].quantite = qty;
      remainingValue -= qty * Number(ticket.prix);
    }

    setReceives(newReceives);
    toast.info(`Valeur d'échange: ${formatCurrencyFCFA(totalReturnedValue)}. Remise en équivalent sur les tickets sélectionnés.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posId) {
      toast.error('Veuillez sélectionner un point de vente.');
      return;
    }

    const validReturns = returns.filter((r: ExchangeItem) => r.ticketTypeId && r.quantite > 0);
    const validReceives = receives.filter((r: ExchangeItem) => r.ticketTypeId && r.quantite > 0);

    if (validReturns.length === 0) {
      toast.error('Veuillez sélectionner au moins un type de ticket à rendre.');
      return;
    }
    if (validReceives.length === 0) {
      toast.error('Veuillez sélectionner au moins un type de ticket à recevoir.');
      return;
    }

    if (valueDifference !== 0) {
      toast.error(
        `La valeur d'échange ne correspond pas. Rendu: ${formatCurrencyFCFA(totalReturnedValue)} — Reçu: ${formatCurrencyFCFA(totalReceivedValue)} (écart: ${formatCurrencyFCFA(Math.abs(valueDifference))}).`
      );
      return;
    }

    setSubmitting(true);

    const response = await fetch('/api/allocations/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pos_id: posId,
        space_id: currentSpaceId || null,
        notes: notes || null,
        returns: validReturns.map((r: ExchangeItem) => ({
          ticket_type_id: r.ticketTypeId,
          ticketTypeId: r.ticketTypeId,
          quantite: r.quantite,
        })),
        receives: validReceives.map((r: ExchangeItem) => ({
          ticket_type_id: r.ticketTypeId,
          ticketTypeId: r.ticketTypeId,
          quantite: r.quantite,
        })),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      toast.error(result.error || 'Échec de l\'échange.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSubmitted(true);
    toast.success(`Échange effectué avec succès. Référence: ${result.exchange_group_id?.slice(0, 8) || ''}`);
    setTimeout(() => {
      router.push('/allocations');
    }, 1500);
  };

  const stepIndicators = [
    { label: 'Point de Vente' },
    { label: 'Tickets à Rendre' },
    { label: 'Tickets à Recevoir' },
    { label: 'Validation' },
  ];

  if (loading) {
    return (
      <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        Chargement de l&apos;assistant d&apos;échange...
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/allocations" className={buttonClassName({ variant: 'ghost', size: 'sm', className: 'gap-2' })}>
            <ArrowLeft className="w-4 h-4" /> Retour
          </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <ArrowLeftRight className="size-6 text-muted" />
          Échange de Tickets
        </h1>
      </div>
      <p className="text-xs text-muted">
        Rendez des tickets existants pour en recevoir d&apos;autres à valeur équivalente au même point de vente.
      </p>

      {/* Step Indicator */}
      <div className="space-y-2 border-b border-border pb-4">
        <div className="flex items-center justify-between">
          {stepIndicators.map((s, idx) => {
            const stepNum = idx + 1;
            const isCompleted = step > stepNum;
            const isActive = step === stepNum;
            return (
              <div key={s.label} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs ${
                    isCompleted
                      ? 'bg-success text-success-foreground'
                      : isActive
                      ? 'bg-warning text-foreground font-semibold shadow-md ring-2 ring-warning/30'
                      : 'bg-default text-muted'
                  }`}
                >
                  {isCompleted ? '✓' : stepNum}
                </div>
                <span
                  className={`hidden sm:inline text-xs font-semibold ${
                    isActive ? 'text-foreground ' : 'text-muted'
                  }`}
                >
                  {s.label}
                </span>
                {idx < stepIndicators.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-muted hidden sm:inline" />
                )}
              </div>
            );
          })}
        </div>
        <p className="sm:hidden text-xs font-semibold text-warning-soft-foreground text-center pt-1">
          Étape {step} sur 4 : {stepIndicators[step - 1]?.label}
        </p>
      </div>

      {submitted ? (
        <Card className="text-center space-y-3 border-success py-8">
          <CheckCircle2 className="w-12 h-12 text-success-soft-foreground mx-auto animate-bounce" />
          <h3 className="text-xl font-semibold text-foreground">Échange Enregistré !</h3>
          <p className="text-xs text-muted">
            Les tickets ont été échangés avec succès dans la base de données.
          </p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Step 1: Select POS */}
          {step === 1 && (
            <Card className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">Étape 1 : Choix du Point de Vente</h3>
              <div className="space-y-2">
                <CustomSelect
                  label="Point de Vente concerné"
                  value={posId}
                  onChange={handlePosChange}
                  options={posList.map((p: PointOfSale) => ({
                    value: p.id,
                    label: p.nom,
                    sublabel: p.ville ? `Ville : ${p.ville}` : (p.adresse ? p.adresse : undefined),
                  }))}
                  placeholder="Sélectionner un point de vente..."
                  title="Point de Vente concerné"
                  searchPlaceholder="Rechercher par nom ou ville..."
                  leadingIcon={<Store className="w-4 h-4 text-warning-soft-foreground" />}
                />
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="button" onClick={() => setStep(2)} className="gap-2">
                  Suivant <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Step 2: Tickets to Return */}
          {step === 2 && (
            <Card className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">Étape 2 : Sélection des Tickets à Rendre</h3>
              <p className="text-xs text-muted">
                Sélectionnez les types de tickets que vous souhaitez rendre. Seuls les tickets disponibles (alloués - vendus) peuvent être rendus.
              </p>

              {loadingStock ? (
                <div className="py-8 flex justify-center items-center gap-2 text-muted text-sm font-medium">
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  Calcul du stock disponible...
                </div>
              ) : Object.keys(posStockInfo).length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <Package className="w-10 h-10 text-muted mx-auto" />
                  <h3 className="text-base font-semibold text-foreground">Aucun ticket alloué à ce POS</h3>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    Aucun ticket n&apos;a été alloué à ce point de vente. <Link href="/allocations/new" className="text-warning-soft-foreground hover:underline">Allouer des tickets</Link>.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.values(posStockInfo)
                    .filter((s: TicketStockInfo) => s.restant > 0)
                    .map((stock: TicketStockInfo) => (
                      <div key={stock.ticketType.id} className="flex items-start gap-4 p-3 bg-surface-secondary rounded-xl">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Ticket className="w-4 h-4 text-success-soft-foreground" />
                              <span className="font-semibold text-sm text-foreground">{stock.ticketType.nom}</span>
                            </div>
                            <Badge variant="neutral" className="text-xs">
                              {formatCurrencyFCFA(stock.prix_unitaire)} / unité
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                            <div className="text-center p-2 bg-surface rounded-xl">
                              <span className="text-muted">Alloués</span>
                              <span className="block font-semibold text-foreground">{stock.alloue}</span>
                            </div>
                            <div className="text-center p-2 bg-surface rounded-xl">
                              <span className="text-muted">Vendus</span>
                              <span className="block font-semibold text-foreground">{stock.vendu}</span>
                            </div>
                            <div className="text-center p-2 bg-success-soft rounded-xl">
                              <span className="text-success-soft-foreground">Disponibles</span>
                              <span className="block font-semibold text-success-soft-foreground">{stock.restant}</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="0"
                            max={stock.restant}
                            value={returns.find((r: ExchangeItem) => r.ticketTypeId === stock.ticketType.id)?.quantite || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const capped = Math.min(val, stock.restant);
                              const existing = returns.find((r: ExchangeItem) => r.ticketTypeId === stock.ticketType.id);
                              if (existing) {
                                const idx = returns.findIndex((r) => r.ticketTypeId === stock.ticketType.id);
                                updateReturn(idx, 'quantite', capped);
                              } else {
                                setReturns([...returns, { ticketTypeId: stock.ticketType.id, quantite: capped }]);
                              }
                            }}
                            placeholder="0"
                            helperText="à rendre"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {totalReturnedValue > 0 && (
                <div className="pt-4 p-4 bg-accent-soft rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-accent" />
                    <span className="font-semibold text-foreground">Valeur totale à rendre</span>
                  </div>
                  <span className="text-xl font-semibold text-accent">
                    {formatCurrencyFCFA(totalReturnedValue)}
                  </span>
                </div>
              )}

              <div className="flex pt-4 gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:w-full">
                <Button type="button" variant="ghost" onClick={() => setStep(1)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={totalReturnedValue === 0}
                  className="gap-2"
                >
                  Suivant <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Step 3: Tickets to Receive */}
          {step === 3 && (
            <Card className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">Étape 3 : Sélection des Tickets à Recevoir</h3>
              <p className="text-xs text-muted">
                Choisissez les types de tickets à recevoir en échange. La valeur totale reçue doit correspondre à la valeur rendue ({formatCurrencyFCFA(totalReturnedValue)}).
              </p>

              <div className="flex items-center justify-between p-3 bg-default rounded-xl">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-warning-soft-foreground" />
                  <span className="text-sm font-medium text-foreground">Valeur à échanger</span>
                </div>
                <span className="text-lg font-semibold text-foreground">
                  {formatCurrencyFCFA(totalReturnedValue)}
                </span>
              </div>

              {receives.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <Button onClick={addReceiveLine} variant="secondary" className="gap-2 font-semibold">
                    <Plus className="w-4 h-4" /> Ajouter un type de ticket
                  </Button>
                </div>
              ) : (
                receives.map((line, index) => {
                  const ticket = getTicketTypeById(line.ticketTypeId);
                  const suggestedQty = line.ticketTypeId ? autoCalculateReceive(line.ticketTypeId) : 0;

                  return (
                    <div key={index} className="flex items-start gap-3 p-3 bg-surface-secondary rounded-xl">
                      <div className="flex-1 space-y-2">
                        <CustomSelect
                          value={line.ticketTypeId}
                          onChange={(val) => updateReceive(index, 'ticketTypeId', val)}
                          options={ticketTypes
                            .filter((t: TicketType) => !receives.some((r, i) => r.ticketTypeId === t.id && i !== index))
                            .map((t: TicketType) => ({
                              value: t.id,
                              label: t.nom,
                              sublabel: formatCurrencyFCFA(Number(t.prix)),
                            }))}
                          placeholder="Sélectionner un type..."
                          title="Ticket à Recevoir"
                          size="sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            label="Quantité à recevoir"
                            type="number"
                            min="0"
                            value={line.quantite || ''}
                            onChange={(e) => updateReceive(index, 'quantite', parseInt(e.target.value) || 0)}
                            placeholder="0"
                          />
                          <div className="flex items-end">
                            {ticket && suggestedQty > 0 && (
                              <button
                                type="button"
                                onClick={() => updateReceive(index, 'quantite', suggestedQty)}
                                className="text-xs text-warning-soft-foreground hover:text-warning-soft-foreground font-medium underline"
                              >
                                Suggestion: {suggestedQty}
                              </button>
                            )}
                          </div>
                        </div>
                        {ticket && (
                          <p className="text-xs text-muted">
                            {formatCurrencyFCFA(Number(ticket.prix))} × {line.quantite || 0} = {formatCurrencyFCFA((line.quantite || 0) * Number(ticket.prix))}
                          </p>
                        )}
                      </div>
                      {receives.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeReceiveLine(index)}
                          className="text-danger hover:text-danger mt-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}

              <div className="flex pt-2 gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:w-full">
                <Button type="button" size="sm" variant="ghost" onClick={addReceiveLine} className="gap-1 text-xs">
                  <Plus className="w-4 h-4" /> Ajouter un type
                </Button>
                {receives.some((r) => r.ticketTypeId) && (
                  <Button type="button" size="sm" variant="ghost" onClick={handleAutoFillAll} className="text-xs">
                    Auto-calculer
                  </Button>
                )}
              </div>

              {totalReceivedValue > 0 && (
                <div className="pt-4 p-4 bg-accent-soft rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-accent" />
                    <span className="font-semibold text-foreground">Valeur totale à recevoir</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-semibold text-accent">
                      {formatCurrencyFCFA(totalReceivedValue)}
                    </span>
                    {valueDifference !== 0 && (
                      <p className={`text-xs font-semibold ${valueDifference > 0 ? 'text-danger' : 'text-warning-soft-foreground'}`}>
                        {valueDifference > 0 ? 'Excédent' : 'Manquant'}: {formatCurrencyFCFA(Math.abs(valueDifference))}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex pt-4 gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:w-full">
                <Button type="button" variant="ghost" onClick={() => setStep(2)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={!isExchangeBalanced}
                  className="gap-2"
                >
                  Suivant <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Step 4: Review & Submit */}
          {step === 4 && (
            <Card className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">Étape 4 : Vérification et Validation</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {/* Returns Summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <TrendingDown className="w-5 h-5 text-danger" />
                    <h4 className="font-semibold text-foreground">Tickets à Rendre</h4>
                  </div>
                  {returns.filter((r: ExchangeItem) => r.quantite > 0).map((r, idx) => {
                    const ticket = getTicketTypeById(r.ticketTypeId);
                    if (!ticket) return null;
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-surface-secondary rounded-xl">
                        <div>
                          <span className="font-semibold text-sm text-foreground">{ticket.nom}</span>
                          <span className="text-xs text-muted block">{formatCurrencyFCFA(Number(ticket.prix))} / unité</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-foreground">{r.quantite}</span>
                          <span className="text-xs text-muted block">{formatCurrencyFCFA(r.quantite * Number(ticket.prix))}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between p-3 bg-danger-soft rounded-xl">
                    <span className="font-semibold text-danger">Total Rendu</span>
                    <span className="font-semibold text-danger">
                      {formatCurrencyFCFA(totalReturnedValue)}
                    </span>
                  </div>
                </div>

                {/* Receives Summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <TrendingUp className="w-5 h-5 text-success-soft-foreground" />
                    <h4 className="font-semibold text-foreground">Tickets à Recevoir</h4>
                  </div>
                  {receives.filter((r: ExchangeItem) => r.quantite > 0).map((r, idx) => {
                    const ticket = getTicketTypeById(r.ticketTypeId);
                    if (!ticket) return null;
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-surface-secondary rounded-xl">
                        <div>
                          <span className="font-semibold text-sm text-foreground">{ticket.nom}</span>
                          <span className="text-xs text-muted block">{formatCurrencyFCFA(Number(ticket.prix))} / unité</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-foreground">{r.quantite}</span>
                          <span className="text-xs text-muted block">{formatCurrencyFCFA(r.quantite * Number(ticket.prix))}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between p-3 bg-success-soft rounded-xl">
                    <span className="font-semibold text-success-soft-foreground">Total Reçu</span>
                    <span className="font-semibold text-success-soft-foreground">
                      {formatCurrencyFCFA(totalReceivedValue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance Check */}
              <div className={`p-4 rounded-xl flex items-center justify-between ${
                isExchangeBalanced
                  ? 'bg-success-soft text-success-soft-foreground '
                  : 'bg-danger-soft text-danger '
              }`}>
                <div className="flex items-center gap-2">
                  <Badge variant={isExchangeBalanced ? 'success' : 'danger'}>
                    {isExchangeBalanced ? 'Équilibré ✓' : 'Non équilibré ⚠️'}
                  </Badge>
                  <span className="font-semibold">Écart de valeur</span>
                </div>
                <span className="font-semibold">{formatCurrencyFCFA(Math.abs(valueDifference))}</span>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-foreground">
                  Référence / Observations
                </label>
                <Input
                  placeholder="ex: ÉchangeTicket #001 - Rendu 24h, reçu 7j"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="pt-4 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:w-full">
                <Button type="button" variant="ghost" onClick={() => setStep(3)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
                <Button
                  type="submit"
                  variant="secondary"
                  className="px-8 font-semibold gap-2"
                  isLoading={submitting}
                  disabled={!isExchangeBalanced}
                >
                  <Receipt className="w-4 h-4" />
                  Valider l&apos;Échange
                </Button>
              </div>
            </Card>
          )}
        </form>
      )}
    </div>
  );
}
