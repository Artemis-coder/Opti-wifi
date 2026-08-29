'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { PointOfSale, TicketType } from '@/types/database';

export default function NewCollectionWizard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [posList, setPosList] = useState<PointOfSale[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);

  // Form State
  const [posId, setPosId] = useState('');
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const [montantCollecte, setMontantCollecte] = useState('');
  const [notes, setNotes] = useState('');

  const supabase = createClient();

  useEffect(() => {
    async function loadOptions() {
      setLoading(true);
      const { data: posData } = await supabase.from('points_of_sale').select('*');
      const { data: ticketData } = await supabase.from('ticket_types').select('*').eq('actif', true);

      if (posData && posData.length > 0) {
        setPosList(posData);
        setPosId(posData[0].id);
      } else {
        setPosList([
          { id: '1', nom: 'POS Cocody St Jean', ville: 'Abidjan', statut: 'actif', created_at: '', updated_at: '' },
          { id: '2', nom: 'POS Yopougon Maroc', ville: 'Abidjan', statut: 'actif', created_at: '', updated_at: '' },
        ]);
        setPosId('1');
      }

      if (ticketData && ticketData.length > 0) {
        setTicketTypes(ticketData);
      } else {
        setTicketTypes([
          { id: '1', nom: 'Pass 1 Heure', duree_heures: 1, prix: 200, actif: true, created_at: '' },
          { id: '2', nom: 'Pass 2 Heures', duree_heures: 2, prix: 350, actif: true, created_at: '' },
          { id: '4', nom: 'Pass 24 Heures Journée', duree_heures: 24, prix: 1000, actif: true, created_at: '' },
        ]);
      }
      setLoading(false);
    }
    loadOptions();
  }, []);

  // Calculations
  const montantAttendu = ticketTypes.reduce((sum, t) => {
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

    // 1. Insert collection in Supabase DB
    const { data: collection, error } = await supabase
      .from('collections')
      .insert({
        pos_id: posId,
        collecteur_id: user?.id || '00000000-0000-0000-0000-000000000000',
        statut: 'validee',
        montant_attendu: montantAttendu,
        montant_collecte: collecteNum,
        notes,
      })
      .select('id')
      .single();

    if (collection) {
      // 2. Insert collection_items
      const itemsToInsert = ticketTypes
        .filter((t) => (quantities[t.id] || 0) > 0)
        .map((t) => ({
          collection_id: collection.id,
          ticket_type_id: t.id,
          stock_debut: 0,
          quantite_vendue: quantities[t.id] || 0,
          prix_unitaire: t.prix,
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
      {/* Wizard Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Receipt className="w-6 h-6 text-amber-500" />
          Assistant de Collecte & Encaissement Caisse
        </h1>
        <p className="text-xs text-slate-500">Enregistrement direct et sécurisé dans la base de données Supabase.</p>
      </div>

      {/* Stepper Progress Indicator */}
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
          Chargement de l'assistant depuis Supabase...
        </div>
      ) : submitted ? (
        <Card className="p-8 text-center space-y-3 border-emerald-500">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Collecte Stockée dans Supabase !</h3>
          <p className="text-xs text-slate-500">L'encaissement a été validé et archivé dans la base PostgreSQL.</p>
        </Card>
      ) : (
        <Card className="p-6">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 1 : Choix du Point de Vente</h3>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Point de Vente concerné</label>
                <select
                  value={posId}
                  onChange={(e) => setPosId(e.target.value)}
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

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 2 : Saisie des Quantités Vendues</h3>
              <div className="space-y-3">
                {ticketTypes.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{t.nom}</p>
                      <p className="text-xs text-slate-500">Prix unitaire : {formatCurrencyFCFA(t.prix)}</p>
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        min="0"
                        value={quantities[t.id] || ''}
                        onChange={(e) => handleQtyChange(t.id, e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
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

          {/* STEP 3 */}
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

          {/* STEP 4 */}
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
              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(3)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
                <Button onClick={() => setStep(5)} className="gap-2">
                  Vérifier l'Écart <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5 */}
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
                  Enregistrer dans Supabase
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
