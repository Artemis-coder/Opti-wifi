'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA } from '@/lib/utils/format';

export default function NewCollectionWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Form State
  const [posId, setPosId] = useState('1');
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({
    '1': 25,  // Pass 1h
    '2': 40,  // Pass 2h
    '4': 15,  // Pass 24h
  });
  const [montantCollecte, setMontantCollecte] = useState('34000');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const ticketTypes = [
    { id: '1', nom: 'Pass 1 Heure', prix: 200 },
    { id: '2', nom: 'Pass 2 Heures', prix: 350 },
    { id: '4', nom: 'Pass 24 Heures Journée', prix: 1000 },
  ];

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

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
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
        <p className="text-xs text-slate-500">Suivez les 5 étapes guidées pour enregistrer la levée de fond d'un POS.</p>
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

      {submitted ? (
        <Card className="p-8 text-center space-y-3 border-emerald-500">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Collecte Enregistrée avec Succès !</h3>
          <p className="text-xs text-slate-500">L'encaissement a été validé et archivé dans les journaux comptables.</p>
        </Card>
      ) : (
        <Card className="p-6">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Étape 1 : Choix du Point de Vente</h3>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Point de Vente concerne</label>
                <select
                  value={posId}
                  onChange={(e) => setPosId(e.target.value)}
                  className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium"
                >
                  <option value="1">POS Cocody St Jean (Kouassi Jean)</option>
                  <option value="2">POS Yopougon Maroc (Diallo Oumar)</option>
                  <option value="3">POS Marcory Zone 4 (Kouassi Jean)</option>
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
                        value={quantities[t.id] || 0}
                        onChange={(e) => handleQtyChange(t.id, e.target.value)}
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
                <Button type="submit" variant="secondary" className="px-8 font-extrabold">
                  Valider & Clôturer la Collecte
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
