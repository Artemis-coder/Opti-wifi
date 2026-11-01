'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Receipt,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Package,
  Store,
  AlertTriangle,
  AlertCircle,
  DollarSign,
  Info,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { toast } from 'sonner';
import { formatCurrencyFCFA, toDateInputValue } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { PointOfSale, TicketType, Collection, CollectionInsert, CollectionItem, CollectionItemInsert, TicketAllocation } from '@/types/database';
import { DateField } from '@/components/ui/DateField';

export default function NewCollectionWizard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isCollector = user?.role === 'collecteur';
  const { currentSpaceId } = useSpaceStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form errors per step
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [allocatedTickets, setAllocatedTickets] = useState<TicketType[]>([]);
  const [allocationMap, setAllocationMap] = useState<Record<string, number>>({});
  const [availableQtyMap, setAvailableQtyMap] = useState<Record<string, number>>({});
  const [alreadySoldMap, setAlreadySoldMap] = useState<Record<string, number>>({});
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  const [posId, setPosId] = useState('');
  const [remainingTickets, setRemainingTickets] = useState<{ [key: string]: number }>({});
  const [montantCollecte, setMontantCollecte] = useState('');
  const [commission, setCommission] = useState('');
  const [dateCollecte, setDateCollecte] = useState(() => toDateInputValue());
  const [notes, setNotes] = useState('');

  const supabase = useMemo(() => createClient(), []);

  // Fetch points of sale
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
        // Lien « Collecter » depuis la tournée : point de vente présélectionné
        const requested = new URLSearchParams(window.location.search).get('pos');
        setPosId(posData.some((p: PointOfSale) => p.id === requested) ? requested! : posData[0].id);
      } else {
        setPosList([]);
        setPosId('');
      }
      setLoading(false);
    }
    loadOptions();
  }, [currentSpaceId, supabase]);

  const handlePosChange = (newPosId: string) => {
    setPosId(newPosId);
    setRemainingTickets({});
    setErrors({});
  };

  // Fetch ticket allocations for selected POS
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
        allocData.forEach((alloc: TicketAllocation) => {
          const typeId = alloc.ticket_type_id;
          const qty = alloc.type === 'exchange_return' ? -alloc.quantite : alloc.quantite;
          allocMap[typeId] = (allocMap[typeId] || 0) + qty;
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
        collectionsData.forEach((c: Collection) => {
          const items = Array.isArray(c.items) ? c.items : c.items ? [c.items] : [];
          items.forEach((item: CollectionItem) => {
            soldMap[item.ticket_type_id] = (soldMap[item.ticket_type_id] || 0) + item.quantite_vendue;
          });
        });
      }

      setAlreadySoldMap(soldMap);

      const availMap: Record<string, number> = {};
      Object.keys(allocMap).forEach((typeId: string) => {
        availMap[typeId] = (allocMap[typeId] || 0) - (soldMap[typeId] || 0);
      });
      setAvailableQtyMap(availMap);

      setLoadingAllocations(false);
    }

    loadAllocations();
  }, [posId, currentSpaceId, supabase]);

  // Selected POS object
  const selectedPos = useMemo(() => posList.find((p) => p.id === posId), [posList, posId]);

  // Available tickets (with stock > 0)
  const availableTickets = useMemo(
    () => allocatedTickets.filter((t: TicketType) => (availableQtyMap[t.id] || 0) > 0),
    [allocatedTickets, availableQtyMap]
  );

  // Total tickets sold
  const totalSoldTickets = useMemo(() => {
    return availableTickets.reduce((sum, t) => {
      const remaining = remainingTickets[t.id] ?? 0;
      const available = availableQtyMap[t.id] || 0;
      return sum + Math.max(0, available - remaining);
    }, 0);
  }, [availableTickets, remainingTickets, availableQtyMap]);

  // Montant attendu
  const montantAttendu = useMemo(() => {
    return availableTickets.reduce((sum: number, t: TicketType) => {
      const remaining = remainingTickets[t.id] ?? 0;
      const available = availableQtyMap[t.id] || 0;
      const sold = Math.max(0, available - remaining);
      return sum + sold * t.prix;
    }, 0);
  }, [availableTickets, remainingTickets, availableQtyMap]);

  const collecteNum = parseFloat(montantCollecte) || 0;
  const commissionNum = parseFloat(commission) || 0;
  const difference = collecteNum - montantAttendu;

  // Change handler for remaining tickets with error clearing
  const handleRemainingChange = (id: string, value: string) => {
    const nextErrors = { ...errors };
    delete nextErrors[id];
    setErrors(nextErrors);

    if (value === '') {
      const nextRemaining = { ...remainingTickets };
      delete nextRemaining[id];
      setRemainingTickets(nextRemaining);
      return;
    }

    const val = parseInt(value, 10);
    setRemainingTickets({ ...remainingTickets, [id]: isNaN(val) ? 0 : val });
  };

  // Quick action: all sold (set 0 remaining)
  const setAllSold = () => {
    const allZeros: Record<string, number> = {};
    availableTickets.forEach((t) => {
      allZeros[t.id] = 0;
    });
    setRemainingTickets(allZeros);
    setErrors({});
    toast.info('Quantités restantes définies à 0 (tous vendus).');
  };

  // Quick action: none sold (set full stock remaining)
  const setNoneSold = () => {
    const fullStock: Record<string, number> = {};
    availableTickets.forEach((t) => {
      fullStock[t.id] = Math.max(0, availableQtyMap[t.id] || 0);
    });
    setRemainingTickets(fullStock);
    setErrors({});
    toast.info('Quantités restantes définies au stock plein (aucun vendu).');
  };

  // ==========================================
  // LEVEL 1 VALIDATION : Point of sale
  // ==========================================
  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!posId || !posList.some((p) => p.id === posId)) {
      errs.posId = 'Veuillez sélectionner un point de vente valide.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Veuillez sélectionner un point de vente pour continuer.');
      return false;
    }
    return true;
  };

  const goToStep2 = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  // ==========================================
  // LEVEL 2 VALIDATION : Remaining tickets count
  // ==========================================
  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};

    if (availableTickets.length === 0) {
      toast.error('Aucun stock de ticket disponible pour ce point de vente.');
      return false;
    }

    for (const t of availableTickets) {
      const val = remainingTickets[t.id];
      const available = availableQtyMap[t.id] || 0;

      if (val === undefined || val === null || isNaN(val)) {
        errs[t.id] = 'Quantité restante requise (saisir 0 si tout a été vendu).';
      } else if (val < 0) {
        errs[t.id] = 'La quantité ne peut pas être négative.';
      } else if (val > available) {
        errs[t.id] = `Dépasse le stock disponible (${available} tickets max).`;
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Veuillez corriger les quantités en rouge avant de continuer.');
      return false;
    }

    if (totalSoldTickets === 0) {
      toast.warning('Attention : 0 ticket vendu calculé. Vérifiez vos saisies.');
    }

    return true;
  };

  const goToStep3 = () => {
    if (validateStep2()) {
      setStep(3);
    }
  };

  // ==========================================
  // LEVEL 3 VALIDATION : Expected calculation check
  // ==========================================
  const validateStep3 = (): boolean => {
    if (montantAttendu < 0) {
      toast.error('Le montant théorique attendu ne peut pas être négatif.');
      return false;
    }
    return true;
  };

  const goToStep4 = () => {
    if (validateStep3()) {
      setStep(4);
    }
  };

  // ==========================================
  // LEVEL 4 VALIDATION : Collected amount & fees
  // ==========================================
  const validateStep4 = (): boolean => {
    const errs: Record<string, string> = {};
    const cNum = parseFloat(montantCollecte);

    if (!montantCollecte || montantCollecte.trim() === '' || isNaN(cNum)) {
      errs.montantCollecte = 'Le montant en espèces compté est obligatoire.';
    } else if (cNum < 0) {
      errs.montantCollecte = 'Le montant collecté ne peut pas être négatif.';
    }

    if (commission.trim() !== '') {
      const commNum = parseFloat(commission);
      if (isNaN(commNum) || commNum < 0) {
        errs.commission = 'La commission doit être un montant positif ou nul.';
      } else if (!isNaN(cNum) && cNum > 0 && commNum > cNum) {
        errs.commission = `La commission (${formatCurrencyFCFA(commNum)}) ne peut pas dépasser la recette totale (${formatCurrencyFCFA(cNum)}).`;
      }
    }

    if (!dateCollecte) {
      errs.dateCollecte = 'La date de la collecte est obligatoire.';
    } else {
      // "YYYY-MM-DD" est interprété en UTC par new Date(), ce qui décale le
      // jour selon le fuseau du collecteur. On compare donc sur les parties
      // de la date uniquement.
      const [year, month, day] = dateCollecte.split('-').map(Number);
      const selected = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selected > today) {
        errs.dateCollecte = 'La date de collecte ne peut pas être dans le futur.';
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Veuillez corriger les informations de collecte indiquées.');
      return false;
    }
    return true;
  };

  const goToStep5 = () => {
    if (validateStep4()) {
      setStep(5);
    }
  };

  // ==========================================
  // LEVEL 5 VALIDATION : Final check & audit
  // ==========================================
  const validateStep5 = (): boolean => {
    const errs: Record<string, string> = {};

    // Mandatory justification if cash discrepancy
    if (difference !== 0) {
      if (!notes || notes.trim().length < 5) {
        errs.notes = 'Une justification détaillée est obligatoire en cas d\'écart de caisse (minimum 5 caractères).';
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(
        `Justification requise : Veuillez expliquer la cause de l'écart de caisse (${difference > 0 ? '+' : ''}${formatCurrencyFCFA(difference)}).`
      );
      return false;
    }
    return true;
  };

  // ==========================================
  // FINAL SUBMISSION
  // ==========================================
  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();

    // Re-verify all levels
    if (!validateStep1() || !validateStep2() || !validateStep4() || !validateStep5()) {
      return;
    }

    setSubmitting(true);

    try {
      // `difference` est une colonne générée en base
      // (GENERATED ALWAYS AS (montant_collecte - montant_attendu) STORED) :
      // elle est calculée par PostgreSQL et ne doit pas figurer dans l'INSERT.
      const collectionPayload: CollectionInsert = {
        pos_id: posId,
        collecteur_id: user?.id || '00000000-0000-0000-0000-000000000000',
        space_id: currentSpaceId || selectedPos?.space_id || null,
        organization_id: user?.organization_id || null,
        statut: 'validee',
        montant_attendu: montantAttendu,
        montant_collecte: collecteNum,
        commission: commissionNum,
        date_collecte: dateCollecte || toDateInputValue(),
        notes: notes.trim() || null,
      };

      const inserted = await supabase
        .from('collections')
        .insert(collectionPayload)
        .select('id')
        .single();
      const { data: collection, error: colError } = inserted;
      // Hors ligne : gardée sur l'appareil, envoyée automatiquement au retour du réseau
      const savedOffline = inserted.queued === true;

      if (colError || !collection) {
        throw new Error(colError?.message || "Erreur lors de la création de l'enregistrement de collecte.");
      }

      // Insert collection items for sold tickets
      // `montant_total` est une colonne générée en base
      // (GENERATED ALWAYS AS (quantite_vendue * prix_unitaire) STORED) :
      // PostgreSQL la calcule, elle ne doit pas être fournie.
      const itemsToInsert: CollectionItemInsert[] = availableTickets
        .map((t: TicketType): CollectionItemInsert => {
          const remaining = remainingTickets[t.id] ?? 0;
          const available = availableQtyMap[t.id] || 0;
          const sold = Math.max(0, available - remaining);
          return {
            collection_id: collection.id,
            ticket_type_id: t.id,
            stock_debut: available,
            quantite_vendue: sold,
            prix_unitaire: t.prix,
            space_id: currentSpaceId || selectedPos?.space_id || null,
            organization_id: user?.organization_id || null,
          };
        })
        .filter((item) => item.quantite_vendue > 0);

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('collection_items').insert(itemsToInsert);
        if (itemsError) {
          console.error('Erreur insertion items collecte:', itemsError);
        }
      }

      if (savedOffline) {
        toast.success(`Collecte de ${formatCurrencyFCFA(collecteNum)} enregistrée sur l'appareil.`, {
          description: 'Elle sera envoyée automatiquement dès le retour du réseau.',
        });
      } else {
        toast.success(`Collecte de ${formatCurrencyFCFA(collecteNum)} enregistrée avec succès.`);
      }
      setSubmitting(false);
      setSubmitted(true);

      setTimeout(() => {
        router.push(isCollector ? '/dashboard' : '/collections');
      }, 1500);
    } catch (err: unknown) {
      console.error('Erreur enregistrement collecte:', err);
      const msg = err instanceof Error ? err.message : 'Une erreur inattendue est survenue.';
      toast.error(`Échec de l'enregistrement : ${msg}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Receipt className="w-6 h-6 text-amber-500" />
          Assistant de Collecte & Encaissement Caisse
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Vérification rigoureuse à chaque niveau et traçabilité financière intégrale.
        </p>
      </div>

      {/* Stepper Header */}
      <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((s: number) => {
            const isCompleted = step > s;
            const isCurrent = step === s;
            return (
              <div key={s} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!isCompleted}
                  onClick={() => isCompleted && setStep(s)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition ${
                    isCurrent
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md ring-2 ring-amber-500/30'
                      : isCompleted
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                  aria-label={`Aller à l'étape ${s}`}
                >
                  {isCompleted ? '✓' : s}
                </button>
                <span
                  className={`hidden sm:inline text-xs font-semibold ${
                    isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                  }`}
                >
                  {s === 1 && 'Point de Vente'}
                  {s === 2 && 'Tickets Restants'}
                  {s === 3 && 'Calcul Attendu'}
                  {s === 4 && 'Montant Réel'}
                  {s === 5 && 'Validation'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mobile active step indicator */}
        <p className="sm:hidden text-xs font-bold text-amber-600 dark:text-amber-400 text-center pt-1">
          Étape {step}/5 :{' '}
          {step === 1 && 'Choix du Point de Vente'}
          {step === 2 && 'Comptage des Tickets Restants'}
          {step === 3 && 'Vérification du Calcul Attendu'}
          {step === 4 && 'Montant Réel & Commission'}
          {step === 5 && 'Validation Finale & Bilan'}
        </p>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          Chargement de l&apos;assistant de collecte...
        </div>
      ) : submitted ? (
        <Card className="p-8 text-center space-y-3 border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Collecte Enregistrée avec Succès !</h3>
          <p className="text-xs text-slate-500">
            L&apos;encaissement a été validé et archivé dans la base de données. Redirection en cours...
          </p>
        </Card>
      ) : (
        <Card className="p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          {/* ========================================================
              LEVEL 1 : Point of Sale Selection
             ======================================================== */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-emerald-600" />
                  Niveau 1 : Sélection du Point de Vente
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Identifiez le point de vente physique pour lequel vous effectuez la collecte de caisse.
                </p>
              </div>

              {posList.length === 0 ? (
                <div className="p-6 text-center space-y-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Aucun point de vente disponible</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {isCollector
                      ? 'Aucun point de vente ne vous est attribué pour cet espace Wi-Fi. Demandez à votre administrateur de vous en confier.'
                      : 'Aucun point de vente n’a été trouvé pour cet espace Wi-Fi. Veuillez d’abord en créer un.'}
                  </p>
                  {!isCollector && (
                    <Link href="/pos">
                      <Button size="sm" variant="secondary" className="font-bold">
                        Gérer les Points de Vente
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <CustomSelect
                    label="Point de Vente concerné *"
                    value={posId}
                    onChange={handlePosChange}
                    options={posList.map((p: PointOfSale) => ({
                      value: p.id,
                      label: p.nom,
                      sublabel: p.ville ? `Ville : ${p.ville}` : (p.adresse ? p.adresse : undefined),
                    }))}
                    placeholder="Sélectionner un point de vente..."
                    title="Choisir le Point de Vente"
                    searchPlaceholder="Rechercher par nom ou ville..."
                    leadingIcon={<Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                    error={errors.posId}
                  />

                  {selectedPos && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Localisation :</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {selectedPos.ville || 'Non renseignée'}
                        {selectedPos.adresse ? ` — ${selectedPos.adresse}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  onClick={goToStep2}
                  disabled={!posId || posList.length === 0}
                  className="w-full sm:w-auto gap-2 font-bold"
                >
                  Continuer vers les Tickets <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================
              LEVEL 2 : Remaining Tickets Count
             ======================================================== */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Package className="w-5 h-5 text-amber-500" />
                    Niveau 2 : Comptage des Tickets Restants
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Comptez physiquement les tickets invendus restant chez le gérant.
                  </p>
                </div>
                {selectedPos && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 w-fit">
                    <Store className="w-3.5 h-3.5" />
                    {selectedPos.nom}
                  </span>
                )}
              </div>

              {loadingAllocations ? (
                <div className="py-8 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  Vérification du stock alloué...
                </div>
              ) : availableTickets.length === 0 ? (
                <div className="py-8 text-center space-y-3 bg-amber-50/50 dark:bg-amber-950/10 rounded-xl border border-amber-200 dark:border-amber-800 p-6">
                  <Package className="w-10 h-10 text-amber-500 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun stock de ticket disponible</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Aucun ticket n&apos;est actuellement alloué à ce point de vente (ou tous les tickets ont déjà été collectés). Vous ne pouvez pas initier de collecte sans stock préalable.
                  </p>
                  <Link href="/allocations/new">
                    <Button variant="secondary" size="sm" className="gap-2 font-bold">
                      <Package className="w-4 h-4" /> Allouer du Stock
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Quick-fill action bar */}
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-500" />
                      Remplissage rapide :
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={setAllSold}
                        className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 font-semibold hover:border-emerald-500 hover:text-emerald-600 transition"
                      >
                        Tous vendus (0)
                      </button>
                      <button
                        type="button"
                        onClick={setNoneSold}
                        className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 font-semibold hover:border-blue-500 hover:text-blue-600 transition"
                      >
                        Aucun vendu
                      </button>
                    </div>
                  </div>

                  {availableTickets.map((t: TicketType) => {
                    const allocated = allocationMap[t.id] || 0;
                    const soldAlready = alreadySoldMap[t.id] || 0;
                    const available = availableQtyMap[t.id] || 0;
                    const remainingVal = remainingTickets[t.id];
                    const remaining = remainingVal ?? 0;
                    const soldNow = Math.max(0, available - remaining);
                    const subtotal = soldNow * t.prix;
                    const fieldError = errors[t.id];

                    return (
                      <div
                        key={t.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition ${
                          fieldError
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {t.nom}
                            <span className="text-[11px] font-normal text-slate-500">
                              ({formatCurrencyFCFA(t.prix)} / ticket)
                            </span>
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/60 font-medium">
                              Alloué : {allocated}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-100/70 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium">
                              Déjà collecté : {soldAlready}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                              Stock en main : {available}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:items-end gap-1">
                          <div className="flex items-center justify-between sm:justify-end gap-2 w-full">
                            <span className="sm:hidden text-xs font-semibold text-slate-600 dark:text-slate-400">
                              Restants comptés :
                            </span>
                            <div className="w-28">
                              <Input
                                type="number"
                                min="0"
                                max={available}
                                value={remainingVal === undefined ? '' : remainingVal}
                                onChange={(e) => handleRemainingChange(t.id, e.target.value)}
                                placeholder="0"
                                className={`text-center font-bold rounded-xl px-3 py-2 bg-white dark:bg-slate-900 ${
                                  fieldError ? 'border-rose-500 focus:ring-rose-500' : ''
                                }`}
                              />
                            </div>
                          </div>

                          {/* Calculated sold tickets & subtotal */}
                          <div className="text-[11px] text-right text-slate-500 font-medium flex items-center justify-between sm:justify-end gap-2 w-full">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              {soldNow} vendu{soldNow > 1 ? 's' : ''}
                            </span>
                            <span>= {formatCurrencyFCFA(subtotal)}</span>
                          </div>

                          {/* Inline Error Message */}
                          {fieldError && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 mt-0.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              {fieldError}
                            </p>
                          )}
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
                <Button
                  onClick={goToStep3}
                  disabled={availableTickets.length === 0}
                  className="gap-2 font-bold"
                >
                  Valider le Comptage <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================
              LEVEL 3 : Expected Amount Calculation
             ======================================================== */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    Niveau 3 : Calcul Automatique du Montant Attendu
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Vérifiez la concordance mathématique entre les tickets vendus et la recette théorique.
                  </p>
                </div>
                {selectedPos && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 w-fit">
                    <Store className="w-3.5 h-3.5" />
                    {selectedPos.nom}
                  </span>
                )}
              </div>

              {/* Big KPI summary banner */}
              <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 text-center space-y-1.5">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Montant Théorique à Encaisser en Caisse
                </p>
                <p className="text-3xl sm:text-4xl font-extrabold text-emerald-700 dark:text-emerald-400">
                  {formatCurrencyFCFA(montantAttendu)}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Correspondant à <strong>{totalSoldTickets}</strong> ticket{totalSoldTickets > 1 ? 's' : ''} vendu{totalSoldTickets > 1 ? 's' : ''} au total.
                </p>
              </div>

              {/* Breakdown table */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Détail par Type de Ticket
                </p>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                  {availableTickets.map((t) => {
                    const available = availableQtyMap[t.id] || 0;
                    const remaining = remainingTickets[t.id] ?? 0;
                    const sold = Math.max(0, available - remaining);
                    const subtotal = sold * t.prix;

                    return (
                      <div key={t.id} className="p-3 flex items-center justify-between text-xs sm:text-sm">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{t.nom}</p>
                          <p className="text-[11px] text-slate-500">
                            {available} stock − {remaining} restant = <strong className="text-emerald-600 dark:text-emerald-400">{sold} vendu{sold > 1 ? 's' : ''}</strong> à {formatCurrencyFCFA(t.prix)}
                          </p>
                        </div>
                        <div className="text-right font-extrabold text-slate-900 dark:text-white">
                          {formatCurrencyFCFA(subtotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {totalSoldTickets === 0 && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-bold">Aucune vente constatée (0 ticket)</p>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      Si le point de vente a réalisé des ventes, cliquez sur &quot;Modifier le comptage&quot; pour corriger le stock de tickets restants.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(2)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Modifier le comptage
                </Button>
                <Button onClick={goToStep4} className="gap-2 font-bold">
                  Confirmer et Passer à la Caisse <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================
              LEVEL 4 : Physical Cash Count & Commission
             ======================================================== */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-amber-500" />
                    Niveau 4 : Saisie du Montant Réellement Encaissé
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Saisissez les espèces remises en main propre par le gérant du POS.
                  </p>
                </div>
                {selectedPos && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 w-fit">
                    <Store className="w-3.5 h-3.5" />
                    {selectedPos.nom}
                  </span>
                )}
              </div>

              {/* Cash input */}
              <div className="space-y-1.5">
                <Input
                  label="Montant en espèces compté (FCFA) *"
                  type="number"
                  min="0"
                  value={montantCollecte}
                  onChange={(e) => {
                    setMontantCollecte(e.target.value);
                    if (errors.montantCollecte) {
                      const next = { ...errors };
                      delete next.montantCollecte;
                      setErrors(next);
                    }
                  }}
                  placeholder="ex: 50000"
                  error={errors.montantCollecte}
                  className="font-bold text-base"
                />
                {montantCollecte && !isNaN(collecteNum) && (
                  <p className="text-xs text-slate-500 font-medium">
                    Montant saisi : <strong>{formatCurrencyFCFA(collecteNum)}</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Input
                    label="Commission versée au POS (FCFA)"
                    type="number"
                    min="0"
                    value={commission}
                    onChange={(e) => {
                      setCommission(e.target.value);
                      if (errors.commission) {
                        const next = { ...errors };
                        delete next.commission;
                        setErrors(next);
                      }
                    }}
                    placeholder="ex: 2500"
                    error={errors.commission}
                  />
                  <p className="text-[11px] text-slate-500">
                    Optionnel. Rémunération du gérant déduite ou remise.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <DateField
                    label="Date effective de collecte *"
                    value={dateCollecte}
                    max={toDateInputValue()}
                    onChange={(v) => {
                      setDateCollecte(v);
                      if (errors.dateCollecte) {
                        const next = { ...errors };
                        delete next.dateCollecte;
                        setErrors(next);
                      }
                    }}
                    error={errors.dateCollecte}
                    helperText="La date ne peut pas être dans le futur."
                  />
                </div>
              </div>

              {/* Real-time discrepancy preview */}
              {montantCollecte.trim() !== '' && !isNaN(collecteNum) && (
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition ${
                    difference === 0
                      ? 'bg-emerald-50/70 text-emerald-900 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                      : difference < 0
                      ? 'bg-rose-50/70 text-rose-900 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800'
                      : 'bg-amber-50/70 text-amber-900 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-600 dark:text-slate-400">
                      Attendu : <strong>{formatCurrencyFCFA(montantAttendu)}</strong> • Compté : <strong>{formatCurrencyFCFA(collecteNum)}</strong>
                    </p>
                    <p className="font-bold text-sm">
                      Écart estimé : {difference > 0 ? '+' : ''}{formatCurrencyFCFA(difference)}
                    </p>
                  </div>
                  <Badge variant={difference === 0 ? 'success' : difference < 0 ? 'danger' : 'warning'}>
                    {difference === 0 ? 'Conforme' : difference < 0 ? 'Déficit' : 'Excédent'}
                  </Badge>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(3)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
                <Button onClick={goToStep5} className="gap-2 font-bold">
                  Vérifier l&apos;Écart & Bilan <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================
              LEVEL 5 : Final Audit, Justification & Submission
             ======================================================== */}
          {step === 5 && (
            <form onSubmit={handleFinish} className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Niveau 5 : Bilan de Contrôle & Validation Finale
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Contrôlez l&apos;ensemble des chiffres avant l&apos;enregistrement comptable définitif.
                  </p>
                </div>
                {selectedPos && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 w-fit">
                    <Store className="w-3.5 h-3.5" />
                    {selectedPos.nom}
                  </span>
                )}
              </div>

              {/* Financial Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase">Attendu</p>
                  <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {formatCurrencyFCFA(montantAttendu)}
                  </p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase">Compté Réel</p>
                  <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyFCFA(collecteNum)}
                  </p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase">Commission</p>
                  <p className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-300">
                    {formatCurrencyFCFA(commissionNum)}
                  </p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase">Net Caisse</p>
                  <p className="text-base sm:text-lg font-bold text-brand-900 dark:text-brand-400">
                    {formatCurrencyFCFA(collecteNum - commissionNum)}
                  </p>
                </div>
              </div>

              {/* Discrepancy Card */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  difference === 0
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800'
                    : difference < 0
                    ? 'bg-rose-50 text-rose-950 border-rose-300 dark:bg-rose-950/30 dark:border-rose-800'
                    : 'bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800'
                }`}
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Écart de Caisse Constaté
                  </p>
                  <p className="text-2xl font-extrabold mt-0.5">
                    {difference > 0 ? '+' : ''}{formatCurrencyFCFA(difference)}
                  </p>
                  <p className="text-xs mt-1 opacity-90">
                    {difference === 0
                      ? 'Aucun écart : la caisse est parfaitement conforme aux tickets vendus.'
                      : difference < 0
                      ? 'Déficit : les espèces remises sont inférieures au total théorique des ventes.'
                      : 'Excédent : les espèces remises sont supérieures au total théorique des ventes.'}
                  </p>
                </div>
                <Badge
                  variant={difference === 0 ? 'success' : difference < 0 ? 'danger' : 'warning'}
                  className="text-xs font-bold px-3 py-1 self-start sm:self-auto"
                >
                  {difference === 0
                    ? 'Caisse Conforme ✓'
                    : difference < 0
                    ? 'Déficit de Caisse ⚠️'
                    : 'Excédent Détecté ⚠️'}
                </Badge>
              </div>

              {/* Justification / Notes Input */}
              <div className="space-y-1.5">
                <Input
                  label={
                    difference !== 0
                      ? 'Justification de l\'écart de caisse * (Obligatoire)'
                      : 'Observations / Notes de collecte (Optionnel)'
                  }
                  placeholder={
                    difference !== 0
                      ? 'Ex: Erreur de rendu de monnaie signalée par le gérant, billet déchiré...'
                      : 'Observations particulières sur le point de vente ou la collecte...'
                  }
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    if (errors.notes) {
                      const next = { ...errors };
                      delete next.notes;
                      setErrors(next);
                    }
                  }}
                  error={errors.notes}
                  className="rounded-xl"
                />
                {difference !== 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    Conformément aux règles de contrôle comptable, tout écart doit être documenté avec une explication claire.
                  </p>
                )}
              </div>

              {/* Final Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(4)}
                  className="gap-2 w-full sm:w-auto"
                >
                  <ArrowLeft className="w-4 h-4" /> Modifier les Montants
                </Button>
                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full sm:w-auto px-8 font-extrabold gap-2"
                  isLoading={submitting}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  Valider & Enregistrer la Collecte
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
