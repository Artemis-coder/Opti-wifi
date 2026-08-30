'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Receipt, CheckCircle2, ArrowRight, ArrowLeft, Loader2, Package } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { PointOfSale, TicketType, CollectionItem } from '@/types/database';

export default function NewCollectionWizard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentSpaceId } = useSpaceStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [allocatedTickets, setAllocatedTickets] = useState<TicketType[]>([]);
  const [allocationMap, setAllocationMap] = useState<Record<string, number>>({});
  const [availableQtyMap, setAvailableQtyMap] = useState<Record<string, number>>({});
  const [alreadySoldMap, setAlreadySoldMap] = useState<Record<string, number>>({});
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  const [posId, setPosId] = useState('');
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const [montantCollecte, setMontantCollecte] = useState('');
  const [commission, setCommission] = useState('');
  const [dateCollecte, setDateCollecte] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const supabase = createClient();

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
      } else {
        setPosList([]);
      }
      setLoading(false);
    }
    loadOptions();
  }, [currentSpaceId, supabase]);

  const handlePosChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPosId(e.target.value);
    setQuantities({});
  };

  useEffect(() => {
    async function loadAllocations() {
      if (!posId) return;
      setLoadingAllocations(true);

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

      const allocMap: Record<string, number> = {};
      const ticketMap: Record<string, TicketType> = {};

      if (allocData) {
        allocData.forEach((alloc) => {
          const typeId = alloc.ticket_type_id;
          allocMap[typeId] = (allocMap[typeId] || 0) + alloc.quantite;
          if (alloc.ticket_type) {
            ticketMap[typeId] = alloc.ticket_type;
          }
        });
      }

      setAllocationMap(allocMap);

      const tickets = Object.entries(ticketMap).map(([id, ticket]) => ({ ...ticket, id }));
      setAllocatedTickets(tickets);

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

      setAlreadySoldMap(soldMap);

      const availMap: Record<string, number> = {};
      Object.keys(allocMap).forEach((typeId) => {
        availMap[typeId] = (allocMap[typeId] || 0) - (soldMap[typeId] || 0);
      });
      setAvailableQtyMap(availMap);

      setLoadingAllocations(false);
    }

    loadAllocations();
  }, [posId, currentSpaceId, supabase]);

  const montantAttendu = allocatedTickets.reduce((sum, t) => {
    const q = quantities[t.id] || 0;
    return sum + q * t.prix;
  }, 0);

  const collecteNum = parseFloat(montantCollecte) || 0;
  const difference = collecteNum - montantAttendu;

  const handleQtyChange = (id: string, value: string) => {
    const val = parseInt(value) || 0;
    setQuantities({ ...quantities, [id]: val });
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    for (const t of allocatedTickets) {
      const entered = quantities[t.id] || 0;
      const available = availableQtyMap[t.id] || 0;
      if (entered > available) {
        toast.error(`Quantité invalide pour ${t.nom}: ${entered} > ${available} disponible(s)`);
        setSubmitting(false);
        return;
      }
    }

    const { data: collection } = await supabase
      .from('collections')
      .insert({
        pos_id: posId,
        collecteur_id: user?.id || '00000000-0000-0000-0000-000000000000',
        space_id: currentSpaceId || null,
        statut: 'validee',
        montant_attendu: montantAttendu,
        montant_collecte: collecteNum,
        commission: parseFloat(commission) || 0,
        date_collecte: dateCollecte || new Date().toISOString().split('T')[0],
        notes,
      })
      .select('id')
      .single();

    if (collection) {
      const itemsToInsert = allocatedTickets
        .filter((t) => (quantities[t.id] || 0) > 0)
        .map((t) => ({
          collection_id: collection.id,
          ticket_type_id: t.id,
          stock_debut: 0,
          quantite_vendue: quantities[t.id] || 0,
          prix_unitaire: t.prix,
          space_id: currentSpaceId || null,
        }));

      if (itemsToInsert.length > 0) {
        await supabase.from('collection_items').insert(itemsToInsert);
      }
    }

    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      router.push('/collections');
    }, 1500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Receipt className="w-6 h-6 text-amber-500" />
          Assistant de Collecte & Encaissement Caisse
        </h1>
        <p className="text-xs text-slate-500">Enregistrement direct et sécurisé dans la base de données.</p>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                step === s
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : step > s
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {step > s ? '✓' : s}
            </div>
            <span className={`hidden sm:inline text-xs font-semibold ${step === s ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              {s === 1 && 'Point de Vente'}
              {s === 2 && 'Quantités Vendues'}
              {s === 3 && 'Calcul Attendu'}
              {s === 4 && 'Montant Réel'}
              {s === 5 && 'Validation'}
            </span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          Chargement de l&apos;assistant...
        </div>
      ) : submitted ? (
        <Card className="p-8 text-center space-y-3 border-emerald-500">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Collecte Enregistrée !</h3>
          <p className="text-xs text-slate-500">L&apos;encaissement a été validé et archivé dans la base de données.</p>
        </Card>
      ) : (
        <Card className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 1 : Choix du Point de Vente</h3>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Point de Vente concerné</label>
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
              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(2)} className="gap-2">
                  Suivant <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 2 : Saisie des Quantités Vendues</h3>

              {loadingAllocations ? (
                <div className="py-8 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  Chargement des allocations...
                </div>
              ) : allocatedTickets.filter((t) => (availableQtyMap[t.id] || 0) > 0).length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <Package className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun ticket alloué à ce POS</h3>
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
                <div className="space-y-3">
                  {allocatedTickets.map((t) => {
                    const allocated = allocationMap[t.id] || 0;
                    const sold = alreadySoldMap[t.id] || 0;
                    const available = availableQtyMap[t.id] || 0;

                    if (available <= 0) return null;

                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{t.nom}</p>
                          <p className="text-xs text-slate-500">Prix unitaire : {formatCurrencyFCFA(t.prix)}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Alloué: {allocated} — Déjà vendu: {sold} — Restant: {Math.max(0, available)}
                          </p>
                        </div>
                        <div className="w-28">
                          <Input
                            type="number"
                            min="0"
                            max={Math.max(0, available)}
                            value={quantities[t.id] || ''}
                            onChange={(e) => handleQtyChange(t.id, e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
                <Button onClick={() => setStep(3)} className="gap-2">
                  Suivant <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 3 : Calcul Automatique du Montant Attendu</h3>
              <div className="p-4 bg-blue-900/10 dark:bg-blue-950/40 rounded-xl border border-blue-900/20 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant Théorique à Encaisser</p>
                <p className="text-3xl font-extrabold text-[#0b1a3a] dark:text-amber-400">{formatCurrencyFCFA(montantAttendu)}</p>
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(2)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
                <Button onClick={() => setStep(4)} className="gap-2">
                  Confirmer le calcul <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 4 : Saisie du Montant Réellement Encaissé</h3>
              <Input
                label="Montant en espèces compté (FCFA)"
                type="number"
                value={montantCollecte}
                onChange={(e) => setMontantCollecte(e.target.value)}
                placeholder="ex: 50000"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Commission versée au POS (FCFA)"
                  type="number"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  placeholder="ex: 2000"
                />
                <Input
                  label="Date de collecte"
                  type="date"
                  value={dateCollecte}
                  onChange={(e) => setDateCollecte(e.target.value)}
                />
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(3)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
                <Button onClick={() => setStep(5)} className="gap-2">
                  Vérifier l&apos;Écart <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <form onSubmit={handleFinish} className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 5 : Bilan & Validation Finale</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase">Attendu</p>
                  <p className="text-lg font-bold">{formatCurrencyFCFA(montantAttendu)}</p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase">Compté Réel</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrencyFCFA(collecteNum)}</p>
                </div>
              </div>

              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                difference === 0
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">Écart Constaté</p>
                  <p className="text-2xl font-extrabold">{formatCurrencyFCFA(difference)}</p>
                </div>
                <Badge variant={difference === 0 ? 'success' : 'danger'}>
                  {difference === 0 ? 'Caisse Conforme ✓' : 'Écart Détecté ⚠️'}
                </Badge>
              </div>

              <Input
                label="Observations / Justification (si écart)"
                placeholder="ex: Billet défectueux ou monnaie manquante..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <div className="flex justify-between pt-4">
                <Button type="button" variant="ghost" onClick={() => setStep(4)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
                <Button type="submit" variant="secondary" className="px-8 font-extrabold" isLoading={submitting}>
                  Enregistrer
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
