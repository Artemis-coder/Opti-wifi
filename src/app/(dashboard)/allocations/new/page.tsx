'use client';

import React, { useState } from 'react';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';

export default function NewAllocationPage() {
  const router = useRouter();
  const [posId, setPosId] = useState('1');
  const [ticketTypeId, setTicketTypeId] = useState('4');
  const [quantite, setQuantite] = useState('100');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const posList = [
    { id: '1', nom: 'POS Cocody St Jean' },
    { id: '2', nom: 'POS Yopougon Maroc' },
    { id: '3', nom: 'POS Marcory Zone 4' },
  ];

  const ticketTypes = [
    { id: '1', nom: 'Pass 1 Heure', prix: 200 },
    { id: '2', nom: 'Pass 2 Heures', prix: 350 },
    { id: '3', nom: 'Pass 5 Heures', prix: 500 },
    { id: '4', nom: 'Pass 24 Heures Journée', prix: 1000 },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-amber-500" />
          Allocation de Tickets aux Points de Vente
        </h1>
        <p className="text-xs text-slate-500">Distribuez du stock de tickets physiquement ou virtuellement à un POS.</p>
      </div>

      {submitted ? (
        <Card className="p-8 text-center space-y-3 border-emerald-500">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Allocation Réussie !</h3>
          <p className="text-xs text-slate-500">Le stock du point de vente sélectionné a été mis à jour instantanément.</p>
        </Card>
      ) : (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Point de Vente Cible
              </label>
              <select
                value={posId}
                onChange={(e) => setPosId(e.target.value)}
                className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
              >
                {posList.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Type de Ticket
              </label>
              <select
                value={ticketTypeId}
                onChange={(e) => setTicketTypeId(e.target.value)}
                className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
              >
                {ticketTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.nom} ({t.prix} FCFA)</option>
                ))}
              </select>
            </div>

            <Input
              label="Quantité à Allouer"
              type="number"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              required
              min="1"
            />

            <Input
              label="Notes / Référence de livraison"
              placeholder="ex: Reçu bordereau N° 4589"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => router.back()}>Annuler</Button>
              <Button type="submit" variant="secondary" className="px-6 font-bold">
                Valider l'Allocation
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
