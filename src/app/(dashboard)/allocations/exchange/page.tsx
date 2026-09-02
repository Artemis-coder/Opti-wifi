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
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { PointOfSale, TicketType, CollectionItem } from '@/types/database';

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

  const handlePosChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPosId(e.target.value);
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
        allocQuery = allocQuery.eq('space_id', currentSpaceId);
        collectionsQuery = collectionsQuery.eq('space_id', currentSpaceId);
      }

      const { data: allocData } = await allocQuery;

      const stockMap: Record<string, TicketStockInfo> = {};

      if (allocData) {
        const ticketMap: Record<string, TicketType> = {};
        const allocatedMap: Record<string, number> = {};

        allocData.forEach((alloc) => {
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
          collectionsData.forEach((c) => {
            if (c.items) {
              c.items!.forEach((item: CollectionItem) => {
                soldMap[item.ticket_type_id] = (soldMap[item.ticket_type_id] || 0) + item.quantite_vendue;
              });
            }
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

  const getTicketTypeById = (id: string) => ticketTypes.find((t) => t.id === id);

  const getTicketTypePrix = (ticketTypeId: string) => {
    const ticket = getTicketTypeById(ticketTypeId);
    return ticket ? Number(ticket.prix) : 0;
  };

  const totalReturnedValue = returns.reduce((sum, r) => {
    return sum + r.quantite * getTicketTypePrix(r.ticketTypeId);
  }, 0);

  const totalReceivedValue = receives.reduce((sum, r) => {
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

    const validReturns = returns.filter((r) => r.ticketTypeId && r.quantite > 0);
    const validReceives = receives.filter((r) => r.ticketTypeId && r.quantite > 0);

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
        returns: validReturns,
        receives: validReceives,
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
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        Chargement de l&apos;assistant d&apos;échange...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/allocations">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-amber-500" />
          Échange de Tickets
        </h1>
      </div>
      <p className="text-xs text-slate-500">
        Rendez des tickets existants pour en recevoir d&apos;autres à valeur équivalente au même point de vente.
      </p>

      {/* Step Indicator */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        {stepIndicators.map((s, idx) => {
          const stepNum = idx + 1;
          const isCompleted = step > stepNum;
          const isActive = step === stepNum;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {isCompleted ? '✓' : stepNum}
              </div>
              <span
                className={`hidden sm:inline text-xs font-semibold ${
                  isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
              {idx < stepIndicators.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700 hidden sm:inline" />
              )}
            </div>
          );
        })}
      </div>

      {submitted ? (
        <Card className="p-8 text-center space-y-3 border-emerald-500">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Échange Enregistré !</h3>
          <p className="text-xs text-slate-500">
            Les tickets ont été échangés avec succès dans la base de données.
          </p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Step 1: Select POS */}
          {step === 1 && (
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 1 : Choix du Point de Vente</h3>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Point de Vente concerné
                </label>
                <select
                  value={posId}
                  onChange={handlePosChange}
                  className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium"
                >
                  {posList.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom} ({p.ville})</option>
                  ))}
                </select>
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
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 2 : Sélection des Tickets à Rendre</h3>
              <p className="text-xs text-slate-500">
                Sélectionnez les types de tickets que vous souhaitez rendre. Seuls les tickets disponibles (alloués - vendus) peuvent être rendus.
              </p>

              {loadingStock ? (
                <div className="py-8 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  Calcul du stock disponible...
                </div>
              ) : Object.keys(posStockInfo).length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <Package className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun ticket alloué à ce POS</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Aucun ticket n&apos;a été alloué à ce point de vente. <Link href="/allocations/new" className="text-amber-600 hover:underline">Allouer des tickets</Link>.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.values(posStockInfo)
                    .filter((s) => s.restant > 0)
                    .map((stock) => (
                      <div key={stock.ticketType.id} className="flex items-start gap-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Ticket className="w-4 h-4 text-emerald-600" />
                              <span className="font-bold text-sm text-slate-900 dark:text-white">{stock.ticketType.nom}</span>
                            </div>
                            <Badge variant="neutral" className="text-xs">
                              {formatCurrencyFCFA(stock.prix_unitaire)} / unité
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                            <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg">
                              <span className="text-slate-500">Alloués</span>
                              <span className="block font-bold text-slate-900 dark:text-white">{stock.alloue}</span>
                            </div>
                            <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg">
                              <span className="text-slate-500">Vendus</span>
                              <span className="block font-bold text-slate-900 dark:text-white">{stock.vendu}</span>
                            </div>
                            <div className="text-center p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                              <span className="text-emerald-700 dark:text-emerald-300">Disponibles</span>
                              <span className="block font-bold text-emerald-700 dark:text-emerald-400">{stock.restant}</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="0"
                            max={stock.restant}
                            value={returns.find((r) => r.ticketTypeId === stock.ticketType.id)?.quantite || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const capped = Math.min(val, stock.restant);
                              const existing = returns.find((r) => r.ticketTypeId === stock.ticketType.id);
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
                <div className="pt-4 p-4 bg-blue-900/10 dark:bg-blue-950/40 rounded-xl border border-blue-900/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-slate-900 dark:text-white">Valeur totale à rendre</span>
                  </div>
                  <span className="text-xl font-extrabold text-blue-700 dark:text-blue-300">
                    {formatCurrencyFCFA(totalReturnedValue)}
                  </span>
                </div>
              )}

              <div className="flex justify-between pt-4">
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
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 3 : Sélection des Tickets à Recevoir</h3>
              <p className="text-xs text-slate-500">
                Choisissez les types de tickets à recevoir en échange. La valeur totale reçue doit correspondre à la valeur rendue ({formatCurrencyFCFA(totalReturnedValue)}).
              </p>

              <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Valeur à échanger</span>
                </div>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {formatCurrencyFCFA(totalReturnedValue)}
                </span>
              </div>

              {receives.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <Button onClick={addReceiveLine} variant="secondary" className="gap-2 font-bold">
                    <Plus className="w-4 h-4" /> Ajouter un type de ticket
                  </Button>
                </div>
              ) : (
                receives.map((line, index) => {
                  const ticket = getTicketTypeById(line.ticketTypeId);
                  const suggestedQty = line.ticketTypeId ? autoCalculateReceive(line.ticketTypeId) : 0;

                  return (
                    <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="flex-1 space-y-2">
                        <select
                          value={line.ticketTypeId}
                          onChange={(e) => updateReceive(index, 'ticketTypeId', e.target.value)}
                          className="w-full h-9 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium"
                        >
                          <option value="">Sélectionner un type</option>
                          {ticketTypes
                            .filter((t) => !receives.some((r, i) => r.ticketTypeId === t.id && i !== index))
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.nom} — {formatCurrencyFCFA(Number(t.prix))}
                              </option>
                            ))}
                        </select>
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
                                className="text-xs text-amber-600 hover:text-amber-700 font-medium underline"
                              >
                                Suggestion: {suggestedQty}
                              </button>
                            )}
                          </div>
                        </div>
                        {ticket && (
                          <p className="text-xs text-slate-500">
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
                          className="text-red-600 hover:text-red-700 mt-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}

              <div className="flex justify-between pt-2">
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
                <div className="pt-4 p-4 bg-purple-900/10 dark:bg-purple-950/40 rounded-xl border border-purple-900/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-slate-900 dark:text-white">Valeur totale à recevoir</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-purple-700 dark:text-purple-300">
                      {formatCurrencyFCFA(totalReceivedValue)}
                    </span>
                    {valueDifference !== 0 && (
                      <p className={`text-xs font-bold ${valueDifference > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {valueDifference > 0 ? 'Excédent' : 'Manquant'}: {formatCurrencyFCFA(Math.abs(valueDifference))}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
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
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 4 : Vérification et Validation</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Returns Summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    <h4 className="font-bold text-slate-900 dark:text-white">Tickets à Rendre</h4>
                  </div>
                  {returns.filter((r) => r.quantite > 0).map((r, idx) => {
                    const ticket = getTicketTypeById(r.ticketTypeId);
                    if (!ticket) return null;
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div>
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{ticket.nom}</span>
                          <span className="text-xs text-slate-500 block">{formatCurrencyFCFA(Number(ticket.prix))} / unité</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 dark:text-white">{r.quantite}</span>
                          <span className="text-xs text-slate-500 block">{formatCurrencyFCFA(r.quantite * Number(ticket.prix))}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
                    <span className="font-bold text-red-800 dark:text-red-300">Total Rendu</span>
                    <span className="font-extrabold text-red-700 dark:text-red-300">
                      {formatCurrencyFCFA(totalReturnedValue)}
                    </span>
                  </div>
                </div>

                {/* Receives Summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    <h4 className="font-bold text-slate-900 dark:text-white">Tickets à Recevoir</h4>
                  </div>
                  {receives.filter((r) => r.quantite > 0).map((r, idx) => {
                    const ticket = getTicketTypeById(r.ticketTypeId);
                    if (!ticket) return null;
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div>
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{ticket.nom}</span>
                          <span className="text-xs text-slate-500 block">{formatCurrencyFCFA(Number(ticket.prix))} / unité</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 dark:text-white">{r.quantite}</span>
                          <span className="text-xs text-slate-500 block">{formatCurrencyFCFA(r.quantite * Number(ticket.prix))}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">Total Reçu</span>
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                      {formatCurrencyFCFA(totalReceivedValue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance Check */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                isExchangeBalanced
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Badge variant={isExchangeBalanced ? 'success' : 'danger'}>
                    {isExchangeBalanced ? 'Équilibré ✓' : 'Non équilibré ⚠️'}
                  </Badge>
                  <span className="font-semibold">Écart de valeur</span>
                </div>
                <span className="font-extrabold">{formatCurrencyFCFA(Math.abs(valueDifference))}</span>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Référence / Observations
                </label>
                <Input
                  placeholder="ex: ÉchangeTicket #001 - Rendu 24h, reçu 7j"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="pt-4 flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(3)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
                <Button
                  type="submit"
                  variant="secondary"
                  className="px-8 font-bold gap-2"
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
